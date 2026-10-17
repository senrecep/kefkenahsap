// #65: idempotent loader for the photos selected from the Kaliteli archive (docs/media-archive/REPORT.md).
// Uploads each photo in seed/media-meta-archive as `pending` with its metadata, so the owner approves it in the admin
// Galeri; nothing becomes public until then. Ordering once approved: category pages use the saved order
// (_media_media_order), and these are created after the seed, so they come after the category's existing photos. The
// galleries sort by id instead: /galeri page 1 is curated from the newest 200 featured-or-large photos, and later pages,
// category/tag filters and "more from this category" run newest first, so approved archive photos show early there.
// #175: every photo in the folder is now part of the owner-approved taxonomy (seed/taxonomy/photo-plan.json `imports`),
// which scripts/seed/taxonomy-import.ts loads (published, in its planned category, the unmarked ones stamped once). This
// script skips those, so it only loads archive photos added outside that plan.
// Run (after seed.ts): bun run payload run scripts/seed/archive.ts   (KEFKEN_ARCHIVE = Kaliteli folder; uses the env's DB + S3)
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { getPayload } from 'payload'

import { mediaMetaTexts } from '@/lib/content/overlay'
import config from '@/payload.config'
import { parsePhotoPlan } from '@/lib/content/schema'
import { SEED_CATEGORIES } from '@/seed/categories'

import { archiveSeedKey, type ArchiveMeta, createArchiveMedia } from './archive-media'
import { fillLocales, unwrap } from './i18n'
import { usedMediaNames } from './taxonomy'

const ROOT = process.cwd()
const ARCHIVE = process.env.KEFKEN_ARCHIVE ?? path.resolve(ROOT, '../../kefken-data/Kaliteli')
const META = path.resolve(ROOT, 'seed/media-meta-archive')
const PLANNED = new Set(unwrap(parsePhotoPlan(readFileSync(path.resolve(ROOT, 'seed/taxonomy/photo-plan.json'), 'utf8'))).imports.map((i) => i.source))

const payload = await getPayload({ config: await config })
const tmp = mkdtempSync(path.join(os.tmpdir(), 'kefken-archive-'))

const usedNames = await usedMediaNames(payload)
const servedDigests = new Map<string, string>()
let created = 0
let skipped = 0
let planned = 0

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
      if (PLANNED.has(meta.source)) {
        planned++
        continue
      }
      const src = path.join(ARCHIVE, meta.source)
      const seedKey = archiveSeedKey(meta)

      const found = await payload.find({ collection: 'media', locale: 'en', fallbackLocale: false, where: { seedKey: { equals: seedKey } }, limit: 1, depth: 0 })
      if (found.docs.length) {
        skipped++
        // Repair a run that died between the TR create and the other locales: empty fields only (#192).
        await fillLocales(payload, 'media', found.docs[0]!.id, mediaMetaTexts(meta), { label: seedKey })
        continue
      }
      if (!existsSync(src)) throw new Error(`missing archive photo: ${src}`)
      await createArchiveMedia(payload, meta, { src, categoryId, status: 'pending', stamp: false, tmp, usedNames, servedDigests })
      created++
    }
    console.log(`  ${cat.key}: ${files.length} archive photos`)
  }
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

console.log(`archive done: ${created} created (pending), ${skipped} already present, ${planned} left to taxonomy-import.ts`)
process.exit(0)
