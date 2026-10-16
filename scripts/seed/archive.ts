// #65: idempotent loader for the photos selected from the Kaliteli archive (docs/media-archive/REPORT.md).
// Uploads each photo in seed/media-meta-archive as `pending` with its metadata, so the owner approves it in the admin
// Galeri; nothing becomes public until then. Ordering once approved: category pages use the saved order
// (_media_media_order), and these are created after the seed, so they come after the category's existing photos. The
// galleries sort by id instead: /galeri page 1 is curated from the newest 200 featured-or-large photos, and later pages,
// category/tag filters and "more from this category" run newest first, so approved archive photos show early there.
// #175: the folder now also holds the taxonomy import (2,476 more photos, filed under their target category). Use
// scripts/seed/taxonomy-import.ts for those: it creates them published per the owner's decision and re-files these 210.
// Run (after seed.ts): bun run payload run scripts/seed/archive.ts   (KEFKEN_ARCHIVE = Kaliteli folder; uses the env's DB + S3)
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { parsePhotoPlan } from '@/lib/content/schema'
import { SEED_CATEGORIES } from '@/seed/categories'

import { archiveSeedKey, type ArchiveMeta, createArchiveMedia, seedCtx as ctx } from './archive-media'
import { unwrap } from './i18n'

const ROOT = process.cwd()
const ARCHIVE = process.env.KEFKEN_ARCHIVE ?? path.resolve(ROOT, '../../kefken-data/Kaliteli')
const META = path.resolve(ROOT, 'seed/media-meta-archive')
// #175: the few archive photos that carry no watermark yet are stamped once on upload (seed/taxonomy/photo-plan.json).
const STAMP = new Set(unwrap(parsePhotoPlan(readFileSync(path.resolve(ROOT, 'seed/taxonomy/photo-plan.json'), 'utf8'))).imports.filter((i) => i.stamp).map((i) => i.source))

const payload = await getPayload({ config: await config })
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
      const meta = JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as ArchiveMeta
      const src = path.join(ARCHIVE, meta.source)
      const seedKey = archiveSeedKey(meta)

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
      await createArchiveMedia(payload, meta, { src, categoryId, status: 'pending', stamp: STAMP.has(meta.source), tmp, usedNames, servedDigests })
      created++
    }
    console.log(`  ${cat.key}: ${files.length} archive photos`)
  }
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

console.log(`archive done: ${created} created (pending), ${skipped} already present`)
process.exit(0)
