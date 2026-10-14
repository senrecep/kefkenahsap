import sharp from 'sharp'
import { type CollectionAfterChangeHook, type CollectionBeforeChangeHook, type CollectionConfig } from 'payload'

import { publicError } from '@/lib/http/public-error'
import { Result } from 'tsentials/result'

import { approvedOrStaff, isStaff } from '@/access'
import { checkPublishable, type MediaStatus } from '@/lib/media/publish'
import { revalidateAfterChange, revalidateAfterDelete } from '@/hooks/revalidate'

// WebP only: sources are already WebP; AVIF would double storage and encode time (PLAN §3.3).
// 480: 2-column phone grids render ~184 CSS px, which at DPR 1.75–2.6 needs 322–480 px; without it they fetched 640 (#116).
// Existing media gets it from scripts/media/add-sizes.ts.
const widths = [320, 480, 640, 960, 1280, 1920] as const

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
  admin: { useAsTitle: 'title', defaultColumns: ['filename', 'title', 'category', 'status'], group: 'İçerik' },
  access: { read: approvedOrStaff, create: isStaff, update: isStaff, delete: isStaff },
  hooks: { beforeChange: [placeholder, publishGate], afterChange: [revalidateAfterChange('media', 'categories', 'projects'), queueAiSuggestion], afterDelete: [revalidateAfterDelete('media', 'categories', 'projects')] },
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
    { name: 'seoFilename', type: 'text', label: 'SEO dosya adı', index: true },
    { name: 'category', type: 'relationship', relationTo: 'categories', index: true, label: 'Kategori' },
    { name: 'tags', type: 'relationship', relationTo: 'tags', hasMany: true, label: 'Etiketler' },
    { name: 'project', type: 'relationship', relationTo: 'projects', index: true, label: 'Proje' },
    { name: 'featured', type: 'checkbox', label: 'Öne çıkan', admin: { position: 'sidebar' } },
    { name: 'capturedAt', type: 'date', label: 'Çekim tarihi', admin: { position: 'sidebar' } },
    {
      name: 'aiSuggestion',
      type: 'json',
      label: 'AI önerisi',
      admin: { readOnly: true, description: 'Model, prompt sürümü ve önerilen metinler (yalnızca öneri).' },
    },
    { name: 'lqip', type: 'text', admin: { readOnly: true, hidden: true } },
    // Stable identity of seeded images (<category>/<source file>) so the seed is idempotent.
    { name: 'seedKey', type: 'text', unique: true, index: true, admin: { readOnly: true, hidden: true } },
    { name: 'dominantColor', type: 'text', admin: { readOnly: true, hidden: true } },
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
  upload: {
    mimeTypes: ['image/*'],
    focalPoint: true,
    formatOptions: { format: 'webp', options: { quality: 82 } },
    imageSizes: widths.map((w) => ({
      name: `w${w}`,
      width: w,
      withoutEnlargement: true,
      formatOptions: { format: 'webp' as const, options: { quality: 80 } },
    })),
  },
}
