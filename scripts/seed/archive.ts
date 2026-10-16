// #65: idempotent loader for the photos selected from the Kaliteli archive (docs/media-archive/REPORT.md).
// Uploads each photo in seed/media-meta-archive as `pending` with its metadata, so the owner approves it in the admin
// Galeri; nothing becomes public until then. Ordering once approved: category pages use the saved order
// (_media_media_order), and these are created after the seed, so they come after the category's existing photos. The
// galleries sort by id instead: /galeri page 1 is curated from the newest 200 featured-or-large photos, and later pages,
// category/tag filters and "more from this category" run newest first, so approved archive photos show early there.
// Run (after seed.ts): bun run payload run scripts/seed/archive.ts   (KEFKEN_ARCHIVE = Kaliteli folder; uses the env's DB + S3)
import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { getPayload } from 'payload'
import sharp from 'sharp'

import config from '@/payload.config'
import { SEED_CATEGORIES } from '@/seed/categories'

import { verifyStored } from './verify-stored'

const ROOT = process.cwd()
const ARCHIVE = process.env.KEFKEN_ARCHIVE ?? path.resolve(ROOT, '../../kefken-data/Kaliteli')
const META = path.resolve(ROOT, 'seed/media-meta-archive')

type Meta = {
  source: string // "<archive folder>/<file>"
  title: { tr: string; en: string }
  alt: { tr: string; en: string }
  caption: { tr: string; en: string }
  seoFilename: string
  tags: Record<string, string[]>
  categoryAgrees: boolean
  confidence: number
  model: string
  promptVersion: string
  generatedAt: string
}

const payload = await getPayload({ config: await config })
// A fresh context per call: Payload keeps per-operation state in it. skipAi: the metadata is already here, never queue tagImage.
const ctx = () => ({ skipAi: true })
const tmp = mkdtempSync(path.join(os.tmpdir(), 'kefken-archive-'))

const existingMedia = await payload.find({ collection: 'media', limit: 0, pagination: false, depth: 0, select: { seoFilename: true } })
const usedNames = new Set(existingMedia.docs.map((d) => d.seoFilename).filter(Boolean) as string[])
const servedDigests = new Map<string, string>()
let created = 0
let skipped = 0

try {
  for (const cat of SEED_CATEGORIES) {
    const dir = path.join(META, cat.key)
    if (!existsSync(dir)) continue
    const category = await payload.find({ collection: 'categories', locale: 'tr', where: { slug: { in: [cat.slug.tr, cat.key] } }, limit: 1, depth: 0 })
    const categoryId = category.docs[0]?.id
    if (!categoryId) throw new Error(`category ${cat.slug.tr} missing (run seed.ts first)`)

    const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
    for (const f of files) {
      const meta = JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as Meta
      const src = path.join(ARCHIVE, meta.source)
      // Keyed on the archive path, not the target category, so a photo filed under another category stays one record.
      const seedKey = `archive/${meta.source}`

      const found = await payload.find({ collection: 'media', locale: 'en', fallbackLocale: false, where: { seedKey: { equals: seedKey } }, limit: 1, depth: 0 })
      if (found.docs.length) {
        skipped++
        // Repair a run that died between the TR create and the EN update.
        if (!found.docs[0]!.title) {
          await payload.update({ collection: 'media', id: found.docs[0]!.id, locale: 'en', context: ctx(), data: { title: meta.title.en, alt: meta.alt.en, caption: meta.caption.en } })
        }
        continue
      }
      if (!existsSync(src)) throw new Error(`missing archive photo: ${src}`)

      let name = meta.seoFilename
      for (let n = 2; usedNames.has(name); n++) name = `${meta.seoFilename}-${n}`
      usedNames.add(name)
      const upload = path.join(tmp, `${name}.webp`)
      copyFileSync(src, upload)
      const { width = 0, height = 0 } = await sharp(upload).metadata()
      const { source: _source, generatedAt, ...suggestion } = meta
      const doc = await payload.create({
        collection: 'media',
        locale: 'tr',
        context: ctx(),
        filePath: upload,
        data: {
          seedKey,
          watermark: 'already', // pipeline images carry the mark already (#169)
          category: categoryId,
          status: 'pending',
          title: meta.title.tr,
          alt: meta.alt.tr,
          caption: meta.caption.tr,
          seoFilename: name,
          // Same shape the runtime tagImage job writes: an unreviewed suggestion, shown as "Onay bekliyor" in the Galeri.
          aiSuggestion: { ...suggestion, at: generatedAt },
        },
      })
      await payload.update({ collection: 'media', id: doc.id, locale: 'en', context: ctx(), data: { title: meta.title.en, alt: meta.alt.en, caption: meta.caption.en } })
      const stored = doc.filename ?? ''
      try {
        if (stored !== `${name}.webp`) throw new Error(`stored as ${stored}, expected ${name}.webp`)
        await verifyStored(stored, upload, { width, height }, servedDigests)
      } catch (err) {
        // Drop the unverified record, or the next run would skip it as already present.
        await payload.delete({ collection: 'media', id: doc.id, context: ctx() })
        throw err
      }
      created++
    }
    console.log(`  ${cat.key}: ${files.length} archive photos`)
  }
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

console.log(`archive done: ${created} created (pending), ${skipped} already present`)
process.exit(0)
