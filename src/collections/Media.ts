import sharp from 'sharp'
import {
  APIError,
  type CollectionAfterChangeHook,
  type CollectionAfterDeleteHook,
  type CollectionBeforeChangeHook,
  type CollectionBeforeOperationHook,
  type CollectionAfterOperationHook,
  type CollectionConfig,
  type PayloadRequest,
} from 'payload'

import { publicError } from '@/lib/http/public-error'
import { Result } from 'tsentials/result'
import { SystemDateTimeProvider } from 'tsentials/time'

import { approvedOrStaff, isStaff, roleOf } from '@/access'
import { isFakeAi } from '@/ai/models'
import { routing } from '@/i18n/routing'
import { changedFields, type I18nSync } from '@/lib/media/i18nSync'
import { mediaFileURL } from '@/lib/media/url'
import { createCdnPurger, mediaPublicURLs } from '@/lib/media/cdn-purge'
import { createReporter } from '@/lib/observability/report'
import { checkPublishable, type MediaStatus } from '@/lib/media/publish'
import { needsSeoRename } from '@/lib/media/seoName'
import { approvalTags, type TagRef } from '@/lib/media/taxonomy'
import { applyWatermark, isStampable } from '@/lib/media/watermark'
import { revalidateAfterChange, revalidateAfterDelete } from '@/hooks/revalidate'

// WebP only: sources are already WebP; AVIF would double storage and encode time (PLAN §3.3).
// 480: 2-column phone grids render ~184 CSS px, which at DPR 1.75–2.6 needs 322–480 px; without it they fetched 640 (#116).
// Existing media gets it from scripts/media/add-sizes.ts.
// 800: page heroes on phones (~380 CSS px × DPR 1.75–2 ≈ 665–760 px) fetched w960 (#129).
export const MEDIA_WIDTHS = [320, 480, 640, 800, 960, 1280, 1920] as const
// Phone home hero (#129): a 9:16 crop around the focal point. Cover-cropping a landscape into the tall phone hero shows
// ~1 image px per CSS px even at w960 (148 KB); this crop shows the same framing at that sharpness in ~45 KB, which
// moves mobile LCP by ~1 s. q70 at phone scale was indistinguishable from today's w960 in a side-by-side.
export const PORTRAIT = { width: 400, height: 711, quality: 70 } as const

/**
 * #169: stamp "kefkenahsap.com" on a newly uploaded file. beforeOperation runs before Payload's generateFileData, which
 * writes the main file and every image size from req.file, so all of them inherit the one mark. Saves without a new
 * file (re-saves, focal point/crop edits regenerated from the stored file) never reach here, so nothing is stamped twice.
 * Relies on Payload's default `upload.useTempFiles: false`: with temp files req.file.data is empty and Payload reads
 * tempFilePath instead, so the mark would silently be skipped.
 */
const stampUpload: CollectionBeforeOperationHook = async ({ args, operation, req }) => {
  const file = req.file
  if ((operation !== 'create' && operation !== 'update') || !file?.data?.length) return args
  // One file for many documents is not supported.
  if (operation === 'update' && 'where' in args && args.where) throw new APIError('Dosya yalnızca tek bir görselde değiştirilebilir.', 400, null, true)
  const data = (args.data ??= {}) as { watermark?: string | null; skipWatermark?: boolean; seoRenamed?: boolean }
  // Any new file on an existing document replaces the old one (purgeReplacedFile).
  if (operation === 'update') {
    req.context.mediaFileReplaced = true
    // #209: the new file has the upload's name again: the seoRename job gives it its SEO name.
    data.seoRenamed = false
  }
  // Seeds/imports declare files that already carry the pipeline's mark. On update the admin echoes the stored state,
  // which describes the replaced file, not the new one.
  if (operation === 'create' && data.watermark === 'already') return args
  if (data.skipWatermark || !(await isStampable(file.data, file.mimetype))) {
    data.watermark = 'none'
    return args
  }
  const stamped = await applyWatermark(file.data, file.mimetype)
  req.context.mediaStamped = true
  file.data = stamped
  file.size = stamped.length
  data.watermark = 'applied'
  return args
}

/** A new document is 'applied' only if this request stamped it: a duplicate copies the already marked file. */
const truthfulWatermark: CollectionBeforeChangeHook = ({ data, operation, req }) => {
  if (operation === 'create') {
    if (data.watermark === 'applied' && !req.context.mediaStamped) data.watermark = 'already'
    delete req.context.mediaStamped
  }
  return data
}

let purgeSkipLogged = false
let reportPurge: ReturnType<typeof createReporter> | undefined
const PURGE_URLS = 'cdnPurgeURLs'
const purgeBase = () => process.env.MEDIA_PUBLIC_URL ?? ''

/** Collects URLs during the operation; sendCdnPurge sends them once the storage plugin has deleted the objects. */
function queuePurge(req: PayloadRequest, urls: string[]) {
  if (urls.length) ((req.context[PURGE_URLS] ??= []) as string[]).push(...urls)
}

/**
 * A new file (flag set by stampUpload) → every previous URL: the old objects are
 * deleted, or (same name) now hold other content. Otherwise only URLs that disappeared (admin crop/focal regeneration
 * under new names); added sizes purge nothing.
 */
const purgeReplacedFile: CollectionAfterChangeHook = ({ doc, operation, previousDoc, req }) => {
  // #209: the seoRename job purges its own old URLs, after it has deleted the old objects.
  if (operation !== 'update' || !previousDoc || req.context.seoRenameJob) return doc
  const before = mediaPublicURLs(previousDoc, purgeBase())
  const after = new Set(mediaPublicURLs(doc, purgeBase()))
  const replaced = req.context.mediaFileReplaced === true
  // Payload runs afterChange again for the internal follow-up save of the same request: only the first one is the replacement.
  delete req.context.mediaFileReplaced
  queuePurge(req, replaced ? before : before.filter((u) => !after.has(u)))
  return doc
}

const purgeDeletedFile: CollectionAfterDeleteHook = ({ doc, req }) => {
  queuePurge(req, mediaPublicURLs(doc, purgeBase()))
  return doc
}

/**
 * #185: the CDN caches media for a year, so a deleted or replaced file stays public until its URLs are purged.
 * afterOperation runs after every afterChange/afterDelete hook, including the storage plugin's (appended after ours),
 * which deletes the old objects: purging earlier would let a request in between re-cache them for a year.
 * Fire-and-forget: the save/delete never waits on, or fails because of, Cloudflare. Without the env it is skipped.
 */
const sendCdnPurge: CollectionAfterOperationHook<'media'> = ({ req, result }) => {
  // The storage plugin's nested metadata update runs inside the outer operation, before its deletes.
  const urls = req.context[PURGE_URLS] as string[] | undefined
  if (!urls?.length || req.context.skipCloudStorage) return result
  delete req.context[PURGE_URLS]
  void purgeURLs(req, urls)
  return result
}

/** Purges these CDN URLs (fire-and-forget callers ignore the promise; it never rejects). Without the env it only warns. */
export function purgeURLs(req: PayloadRequest, urls: string[]): Promise<void> {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID
  const token = process.env.CLOUDFLARE_PURGE_TOKEN
  if (!zoneId || !token) {
    if (!purgeSkipLogged) req.payload.logger.warn('media: CLOUDFLARE_ZONE_ID / CLOUDFLARE_PURGE_TOKEN not set; deleted or replaced files stay in the CDN cache')
    purgeSkipLogged = true
    return Promise.resolve()
  }
  const unique = [...new Set(urls)]
  const failed = (err: unknown) => {
    req.payload.logger.error({ err, urls: unique }, 'media: CDN purge failed; the old files stay cached')
    const dsn = process.env.SENTRY_DSN
    if (!dsn) return
    reportPurge ??= createReporter({ dsn, environment: process.env.SITE_ENV ?? 'local', clock: SystemDateTimeProvider })
    const detail = Array.isArray(err) ? err.map((e: { description?: string }) => e.description).join('; ') : String(err)
    // Local API calls (scripts, jobs) get a placeholder URL from Payload, not a real path or method.
    const http = req.payloadAPI !== 'local'
    reportPurge(new Error(`Cloudflare.PurgeFailed: ${detail}`), { path: http ? req.pathname : '(local api)', method: (http && req.method) || '(local api)' }, 'media.cdnPurge')
  }
  return createCdnPurger({ zoneId, token })(unique).then((r) => void (r.ok || failed(r.errors)), failed)
}

/** Tiny blurred placeholder + dominant colour, computed once at upload (skeleton/LQIP, CLS-free gallery). */
const placeholder: CollectionBeforeChangeHook = async ({ data, req }) => {
  const file = req.file?.data
  if (!file) return data
  try {
    const img = sharp(file)
    const [lqip, stats] = await Promise.all([img.clone().resize(16).webp({ quality: 40 }).toBuffer(), img.clone().stats()])
    const { r, g, b } = stats.dominant
    return {
      ...data,
      lqip: `data:image/webp;base64,${lqip.toString('base64')}`,
      dominantColor: `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`,
    }
  } catch (err) {
    // A placeholder is cosmetic; never fail the upload because of it.
    req.payload.logger.warn({ err }, 'media: placeholder generation failed')
    return data
  }
}

/** Approved images need Turkish alt text, whichever locale is being edited. */
const publishGate: CollectionBeforeChangeHook = async ({ data, req, originalDoc, operation }) => {
  const status = (data.status ?? originalDoc?.status ?? 'pending') as MediaStatus
  if (status !== 'approved') return data
  // The Turkish alt that will be stored after this write: sent value first, else what is already saved.
  let trAlt: string | null | undefined
  if (req.locale === 'all') trAlt = (data.alt as Record<string, string> | undefined)?.tr
  else if (req.locale === 'tr') trAlt = data.alt ?? originalDoc?.alt
  if (trAlt === undefined && operation === 'update' && originalDoc?.id) {
    // No `req` here: Payload would switch req.locale to 'tr' and the rest of this write would land in the Turkish row.
    const tr = await req.payload.findByID({ collection: 'media', id: originalDoc.id, locale: 'tr', depth: 0 })
    trAlt = tr.alt
  }
  const r = checkPublishable({ status, alt: { tr: trAlt ?? '' } })
  if (Result.isFailure(r)) throw publicError(r.errors[0]!.description, 'alt')
  return data
}

/** #183: a photo becoming approved gets the existing tags its AI suggestion names, in the same write (add-only). */
const attachSuggestedTags: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req }) => {
  if (operation !== 'update' || data.status !== 'approved' || originalDoc?.status === 'approved') return data
  const suggestion = data.aiSuggestion ?? originalDoc?.aiSuggestion
  if (!suggestion) return data
  // Sent tags (even an explicit null/empty list) win over the stored ones.
  const sent = data.tags !== undefined ? (data.tags ?? []) : (originalDoc?.tags ?? [])
  const current = (sent as (number | { id: number })[]).map((t) => (typeof t === 'number' ? t : t.id))
  // No `req`: Payload would switch req.locale to 'tr' (see publishGate). Tags are only read here, once per request (bulk approve).
  const tags = (req.context.approvalTagRefs ??= await req.payload
    .find({ collection: 'tags', locale: 'tr', pagination: false, depth: 0, select: { axis: true, slug: true, name: true } })
    .then((r) => r.docs.map((t) => ({ id: t.id, axis: t.axis, slug: t.slug ?? '', name: t.name })))) as TagRef[]
  const next = approvalTags(suggestion, tags, current)
  return next === current ? data : { ...data, tags: next }
}

/** New upload → queue an AI suggestion job (skipped in tests, without a key, when disabled, or for seeded media). */
const queueAiSuggestion: CollectionAfterChangeHook = async ({ doc, operation, req, context }) => {
  if (operation !== 'create' || context?.skipAi || doc.status === 'approved') return doc
  if (!process.env.OPENROUTER_API_KEY || process.env.NODE_ENV === 'test') return doc
  try {
    const settings = await req.payload.findGlobal({ slug: 'aiSettings', req })
    if (settings.enabled === false) return doc
    await req.payload.jobs.queue({ task: 'tagImage', input: { mediaId: String(doc.id) }, req })
  } catch (err) {
    // A suggestion is optional; never fail an upload because queueing it failed.
    req.payload.logger.warn({ err, media: doc.id }, 'media: could not queue AI suggestion')
  }
  return doc
}

/**
 * #209: an approved photo whose file still has its upload name gets a seoRename job (src/jobs/seoRename.ts). Queued with
 * `req`, so the job row exists only if this save commits; the job re-checks the photo, so a duplicate is a no-op.
 * The storage plugin's nested metadata update and the job's own update never queue.
 */
const queueSeoRename: CollectionAfterChangeHook = async ({ doc, req }) => {
  if (req.context.skipCloudStorage || req.context.seoRenameJob || !needsSeoRename(doc)) return doc
  try {
    await req.payload.jobs.queue({ task: 'seoRename', input: { mediaId: String(doc.id) }, req })
  } catch (err) {
    // The photo stays under its upload name; scripts/seed/seo-filenames.ts renames it later.
    req.payload.logger.warn({ err, media: doc.id }, 'media: could not queue seoRename')
  }
  return doc
}

const TRANSLATE_QUEUED = 'translateMediaIds'

/**
 * #203: keeps the other locales in step with the TR title/alt/caption. A TR edit marks the changed fields pending and
 * queues translateMedia (queueTranslation); a person editing another locale takes it off the stale list. Writes with
 * `skipAi` (the translate job itself, tagImage, seed/import scripts) set i18nSync themselves and never queue; from
 * anyone else a sent i18nSync is ignored (the edit form resubmits the hidden field with whatever it loaded).
 */
const trackTranslations: CollectionBeforeChangeHook = async ({ data, operation, originalDoc, req }) => {
  if (req.context.skipAi) return data
  let sync = (originalDoc?.i18nSync ?? null) as I18nSync | null
  const changed = operation === 'update' && originalDoc ? changedFields(data, originalDoc) : []
  if (changed.length && req.locale === routing.defaultLocale) {
    // No `req`: Payload would switch req.locale (see publishGate). A failed read counts as AI off: the save goes on.
    const settings = await req.payload.findGlobal({ slug: 'aiSettings', depth: 0 }).catch((err: unknown) => {
      req.payload.logger.warn({ err }, 'media: aiSettings unreadable; not queueing translateMedia')
      return null
    })
    if ((process.env.OPENROUTER_API_KEY || isFakeAi()) && settings && settings.enabled !== false) {
      sync = { ...sync, pending: [...new Set([...(sync?.pending ?? []), ...changed])] }
      ;((req.context[TRANSLATE_QUEUED] ??= []) as unknown[]).push(originalDoc!.id)
    } else {
      const others = routing.locales.filter((l) => l !== routing.defaultLocale)
      sync = { ...sync, stale: { ...Object.fromEntries(others.map((l) => [l, 'failed'])), ...sync?.stale } }
    }
  } else if (changed.length && req.locale && sync?.stale?.[req.locale]) {
    const { [req.locale]: _, ...stale } = sync.stale
    sync = { ...sync, stale }
  }
  return { ...data, i18nSync: sync }
}

/** Queues the translation marked by trackTranslations. Never fails the save; the card then shows the pending state. */
const queueTranslation: CollectionAfterChangeHook = async ({ doc, req }) => {
  const ids = req.context[TRANSLATE_QUEUED] as unknown[] | undefined
  if (!ids?.includes(doc.id)) return doc
  req.context[TRANSLATE_QUEUED] = ids.filter((i) => i !== doc.id)
  try {
    // No `req`: a failed insert inside the save's transaction would abort the save itself.
    await req.payload.jobs.queue({ task: 'translateMedia', input: { mediaId: String(doc.id) } })
  } catch (err) {
    req.payload.logger.warn({ err, media: doc.id }, 'media: could not queue translateMedia')
  }
  return doc
}

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Görsel', plural: 'Görseller' },
  admin: {
    useAsTitle: 'title',
    // `filename` is the only list cell Payload renders with a thumbnail (and keeps drawer selection working).
    defaultColumns: ['filename', 'title', 'status', 'category'],
    group: 'İçerik',
    pagination: { defaultLimit: 50 },
  },
  defaultSort: '-createdAt',
  access: { read: approvedOrStaff, create: isStaff, update: isStaff, delete: isStaff },
  hooks: {
    beforeOperation: [stampUpload],
    afterOperation: [sendCdnPurge],
    beforeChange: [truthfulWatermark, placeholder, publishGate, attachSuggestedTags, trackTranslations],
    afterChange: [purgeReplacedFile, revalidateAfterChange('media', 'categories', 'projects'), queueAiSuggestion, queueTranslation, queueSeoRename],
    afterDelete: [revalidateAfterDelete('media', 'categories', 'projects'), purgeDeletedFile],
  },
  fields: [
    {
      name: 'status',
      type: 'select',
      defaultValue: 'pending',
      index: true,
      label: 'Durum',
      options: [
        { label: 'Onay bekliyor', value: 'pending' },
        { label: 'Yayında', value: 'approved' },
        { label: 'Gizli', value: 'hidden' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'title', type: 'text', localized: true, label: 'Başlık' },
    { name: 'alt', type: 'text', localized: true, label: 'Alt metin', maxLength: 125 },
    { name: 'caption', type: 'textarea', localized: true, label: 'Açıklama' },
    {
      // #203: other locales vs the TR texts, and "Diğer dillere yeniden çevir".
      name: 'localesSync',
      type: 'ui',
      admin: { components: { Field: '/components/admin/ai/MediaLocalesSync#MediaLocalesSyncField' } },
    },
    // #203: provenance of the AI-made locale texts, pending TR fields, stale locales (src/lib/media/i18nSync.ts).
    { name: 'i18nSync', type: 'json', access: { read: ({ req }) => Boolean(roleOf(req.user)) }, admin: { hidden: true } },
    { name: 'seoFilename', type: 'text', label: 'SEO dosya adı', index: true, admin: { position: 'sidebar' } },
    { name: 'category', type: 'relationship', relationTo: 'categories', index: true, label: 'Kategori' },
    { name: 'tags', type: 'relationship', relationTo: 'tags', hasMany: true, label: 'Etiketler' },
    { name: 'project', type: 'relationship', relationTo: 'projects', index: true, label: 'Proje' },
    { name: 'featured', type: 'checkbox', label: 'Öne çıkan', admin: { position: 'sidebar' } },
    { name: 'capturedAt', type: 'date', label: 'Çekim tarihi', admin: { position: 'sidebar' } },
    {
      // Set by stampUpload; seeds/imports send 'already'. Not editable: it records what happened to the stored file.
      name: 'watermark',
      type: 'select',
      label: 'Filigran',
      options: [
        { label: 'Eklendi', value: 'applied' },
        { label: 'Dosyada zaten var', value: 'already' },
        { label: 'Eklenmedi', value: 'none' },
      ],
      admin: { position: 'sidebar', readOnly: true, condition: (data) => Boolean(data?.watermark) },
    },
    {
      name: 'skipWatermark',
      type: 'checkbox',
      virtual: true,
      label: 'Filigran ekleme',
      // Payload makes virtual fields read-only unless told otherwise; this one is an instruction for the upload, not stored.
      admin: { position: 'sidebar', readOnly: false, description: 'İşaretlenirse yeni yüklenen dosyaya "kefkenahsap.com" filigranı basılmaz.' },
    },
    // #209: set by the seoRename job once the stored files carry the SEO name; cleared when the file is replaced. Never renamed twice.
    { name: 'seoRenamed', type: 'checkbox', defaultValue: false, admin: { readOnly: true, hidden: true } },
    { name: 'lqip', type: 'text', admin: { readOnly: true, hidden: true } },
    // Stable identity of seeded images (<category>/<source file>) so the seed is idempotent.
    { name: 'seedKey', type: 'text', unique: true, index: true, admin: { readOnly: true, hidden: true } },
    { name: 'dominantColor', type: 'text', admin: { readOnly: true, hidden: true } },
    {
      // Unnamed: no schema change. Editors never need these; Galeri still reads aiSuggestion through the API.
      type: 'collapsible',
      label: 'Teknik bilgiler',
      admin: { initCollapsed: true, condition: (_data, _siblings, { user }) => roleOf(user) === 'admin' },
      fields: [
        {
          name: 'aiSuggestion',
          type: 'json',
          label: 'AI önerisi',
          admin: { readOnly: true, description: 'Model, prompt sürümü ve önerilen metinler (yalnızca öneri).' },
        },
        {
          name: 'legacy',
          type: 'group',
          label: 'Eski site',
          admin: { condition: (d) => Boolean(d?.legacy?.urls?.length) },
          fields: [
            { name: 'urls', type: 'array', fields: [{ name: 'url', type: 'text', required: true }] },
            { name: 'attachmentUrl', type: 'text' },
          ],
        },
      ],
    },
  ],
  upload: {
    mimeTypes: ['image/*'],
    // A size name would make Payload build thumbnailURL from the stored /api/media/file path, which 500s (files are on the CDN, #165).
    adminThumbnail: ({ doc }) => {
      const sizes = doc.sizes as Record<string, { filename?: string | null } | undefined> | undefined
      const filename = sizes?.w320?.filename ?? (doc.filename as string | undefined)
      return filename ? mediaFileURL(filename, doc.prefix as string | undefined) : null
    },
    focalPoint: true,
    formatOptions: { format: 'webp', options: { quality: 82 } },
    imageSizes: [
      ...MEDIA_WIDTHS.map((w) => ({
        name: `w${w}`,
        width: w,
        withoutEnlargement: true,
        formatOptions: { format: 'webp' as const, options: { quality: 80 } },
      })),
      {
        name: 'portrait',
        width: PORTRAIT.width,
        height: PORTRAIT.height,
        withoutEnlargement: true,
        formatOptions: { format: 'webp' as const, options: { quality: PORTRAIT.quality } },
      },
    ],
  },
}
