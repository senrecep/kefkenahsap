import { mkdir, readdir, rm, writeFile } from 'fs/promises'
import path from 'path'
import sharp from 'sharp'
import {
  type CollectionAfterChangeHook,
  type CollectionAfterDeleteHook,
  type CollectionBeforeChangeHook,
  type CollectionBeforeOperationHook,
  type CollectionConfig,
} from 'payload'

import { publicError } from '@/lib/http/public-error'
import { Result } from 'tsentials/result'

import { approvedOrStaff, isStaff, roleOf } from '@/access'
import { mediaFileURL } from '@/lib/media/url'
import { checkPublishable, type MediaStatus } from '@/lib/media/publish'
import { applyWatermark, WATERMARK_MIME_TYPES } from '@/lib/media/watermark'
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

// Clean originals of stamped uploads (#169): a private server volume like lead photos, never the public CDN bucket and
// never served, so the mark can be re-applied or removed later. Named <stored stem><uploaded extension>.
export const MEDIA_ORIGINALS_DIR = process.env.MEDIA_ORIGINALS_DIR || path.resolve(process.cwd(), 'data/media-originals')
const stemOf = (filename: string) => path.parse(filename).name

/**
 * #169: stamp "kefkenahsap.com" on a newly uploaded file. beforeOperation runs before Payload's generateFileData, which
 * writes the main file and every image size from req.file, so all of them inherit the one mark. Saves without a new
 * file (re-saves, focal point/crop edits regenerated from the stored file) never reach here, so nothing is stamped twice.
 */
const stampUpload: CollectionBeforeOperationHook = async ({ args, operation, req }) => {
  const file = req.file
  if ((operation !== 'create' && operation !== 'update') || !file?.data?.length) return args
  const data = (args.data ??= {}) as { watermark?: string | null; skipWatermark?: boolean }
  // Seeds/imports declare files that already carry the pipeline's mark. On update the admin echoes the stored state,
  // which describes the replaced file, not the new one.
  if (operation === 'create' && data.watermark === 'already') return args
  if (data.skipWatermark || !WATERMARK_MIME_TYPES.includes(file.mimetype)) {
    data.watermark = 'none'
    return args
  }
  const stamped = await applyWatermark(file.data, file.mimetype)
  req.context.mediaOriginal = { data: file.data, ext: path.extname(file.name) }
  file.data = stamped
  file.size = stamped.length
  data.watermark = 'applied'
  return args
}

/** A new document is 'applied' only if this request stamped it: a duplicate copies the marked file, not its clean original. */
const truthfulWatermark: CollectionBeforeChangeHook = ({ data, operation, req }) => {
  if (operation === 'create' && data.watermark === 'applied' && !req.context.mediaOriginal) data.watermark = 'already'
  return data
}

async function removeOriginal(filename: string) {
  const stem = stemOf(filename)
  const files = await readdir(MEDIA_ORIGINALS_DIR).catch(() => [] as string[])
  await Promise.all(files.filter((f) => stemOf(f) === stem).map((f) => rm(path.join(MEDIA_ORIGINALS_DIR, f), { force: true })))
}

/** Keeps the clean upload once the stored filename is known; failing here rolls the upload back rather than lose it. */
const keepOriginal: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  const original = req.context.mediaOriginal as { data: Buffer; ext: string } | undefined
  if (!original || !doc.filename) return doc
  delete req.context.mediaOriginal
  if (previousDoc?.filename) await removeOriginal(previousDoc.filename) // the file was replaced
  await mkdir(MEDIA_ORIGINALS_DIR, { recursive: true })
  await writeFile(path.join(MEDIA_ORIGINALS_DIR, `${stemOf(doc.filename)}${original.ext}`), original.data)
  return doc
}

const deleteOriginal: CollectionAfterDeleteHook = async ({ doc }) => {
  if (doc.filename) await removeOriginal(doc.filename)
  return doc
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
    beforeChange: [truthfulWatermark, placeholder, publishGate],
    afterChange: [keepOriginal, revalidateAfterChange('media', 'categories', 'projects'), queueAiSuggestion],
    afterDelete: [revalidateAfterDelete('media', 'categories', 'projects'), deleteOriginal],
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
        { label: 'Eklendi (temiz orijinal saklı)', value: 'applied' },
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
