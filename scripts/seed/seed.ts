// #31: idempotent launch seed — 11 categories + 568 approved images in live-page order, with legacy WP URLs.
// Writes the legacy media map consumed by the redirect resolver (#32): src/lib/legacy/media-map.json
// Run: bun scripts/seed/seed.ts   (needs seed/media-meta from #30; uses the env's DB + S3)
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { SEED_CATEGORIES } from '@/seed/categories'
import { fileKey, orderForCategory } from '@/seed/order'

const ROOT = process.cwd()
const DATA = process.env.KEFKEN_DATA ?? path.resolve(ROOT, '../../kefken-data/Webiste')
const META = path.resolve(ROOT, 'seed/media-meta')
const live = JSON.parse(readFileSync(path.resolve(ROOT, 'docs/legacy/live-site-images-ordered.json'), 'utf8')) as Record<string, string[]>
const wpMedia = JSON.parse(readFileSync(path.resolve(ROOT, 'docs/legacy/wp-media.json'), 'utf8')) as {
  source_url: string
  link: string
  post: number | null
  sizes: Record<string, string>
}[]
const wpPages = JSON.parse(readFileSync(path.resolve(ROOT, 'docs/legacy/wp-pages.json'), 'utf8')) as { id: number; slug: string }[]
const pageSlugById = new Map(wpPages.map((p) => [p.id, p.slug]))

type Meta = {
  title: { tr: string; en: string }
  alt: { tr: string; en: string }
  caption: { tr: string; en: string }
  seoFilename: string
  tags: Record<string, string[]>
  model: string
  promptVersion: string
}

// WP uploads indexed by fileKey → candidates (a name can exist in several categories).
const uploadDir = (u: string) => new URL(u).pathname.match(/\/wp-content\/uploads\/(\d{4})\/(\d{2})\//)?.slice(1, 3).join('/') ?? ''
const base = (u: string) => decodeURIComponent(new URL(u).pathname.split('/').pop() ?? '')
const wpByKey = new Map<string, typeof wpMedia>()
for (const m of wpMedia) {
  const k = fileKey(base(m.source_url))
  wpByKey.set(k, [...(wpByKey.get(k) ?? []), m])
}

const payload = await getPayload({ config: await config })
const ctx = { skipAi: true }
const tmp = path.join(os.tmpdir(), 'kefken-seed')
mkdirSync(tmp, { recursive: true })

const mediaMap: Record<string, { file: string; category: string }> = {}
const attachmentMap: Record<string, { file: string; category: string }> = {}
const usedNames = new Set<string>()
let created = 0
let skipped = 0

for (const [index, cat] of SEED_CATEGORIES.entries()) {
  // Category (published, TR + EN)
  const existing = await payload.find({ collection: 'categories', locale: 'tr', where: { slug: { equals: cat.slug.tr } }, limit: 1 })
  let categoryId = existing.docs[0]?.id
  if (!categoryId) {
    const c = await payload.create({
      collection: 'categories',
      locale: 'tr',
      data: { name: cat.name.tr, slug: cat.slug.tr, _status: 'published' },
    })
    categoryId = c.id
    await payload.update({ collection: 'categories', id: c.id, locale: 'en', data: { name: cat.name.en, slug: cat.slug.en, _status: 'published' } })
    console.log(`category ${index + 1}/11 ${cat.slug.tr} created`)
  }

  const localFiles = readdirSync(path.join(DATA, cat.folder)).filter((f) => /\.(webp|jpe?g|png)$/i.test(f))
  const ordered = orderForCategory(live[cat.folder] ?? [], localFiles)

  for (const file of ordered) {
    const seedKey = `${cat.slug.tr}/${file}`
    const metaPath = path.join(META, cat.slug.tr, `${file}.json`)
    if (!existsSync(metaPath)) throw new Error(`missing metadata: ${metaPath} (run generate-media-meta first)`)
    const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as Meta

    // Legacy WP URLs for this image (prefer the upload attached to the same category page).
    const candidates = wpByKey.get(fileKey(file)) ?? []
    const wp = candidates.find((m) => m.post && pageSlugById.get(m.post) === cat.slug.tr) ?? candidates[0]

    const found = await payload.find({ collection: 'media', where: { seedKey: { equals: seedKey } }, limit: 1, depth: 0 })
    let stored = found.docs[0]?.filename ?? undefined
    if (!found.docs.length) {
      // SEO file name, unique across the whole set.
      let name = meta.seoFilename
      for (let n = 2; usedNames.has(name) || existsSync(path.join(tmp, `${name}.webp`)); n++) name = `${meta.seoFilename}-${n}`
      usedNames.add(name)
      const upload = path.join(tmp, `${name}.webp`)
      copyFileSync(path.join(DATA, cat.folder, file), upload)
      const doc = await payload.create({
        collection: 'media',
        locale: 'tr',
        context: ctx,
        filePath: upload,
        data: {
          seedKey,
          category: categoryId,
          status: 'approved',
          title: meta.title.tr,
          alt: meta.alt.tr,
          caption: meta.caption.tr,
          seoFilename: name,
          aiSuggestion: { ...meta, reviewedAt: 'seed' },
          ...(wp
            ? { legacy: { urls: [wp.source_url, ...Object.values(wp.sizes)].map((url) => ({ url })), attachmentUrl: wp.link } }
            : {}),
        },
      })
      await payload.update({
        collection: 'media',
        id: doc.id,
        locale: 'en',
        context: ctx,
        data: { title: meta.title.en, alt: meta.alt.en, caption: meta.caption.en },
      })
      stored = doc.filename ?? undefined
      created++
    } else {
      skipped++
      usedNames.add(found.docs[0]!.seoFilename ?? '')
    }

    if (wp && stored) {
      mediaMap[`${uploadDir(wp.source_url)}/${fileKey(base(wp.source_url))}`] = { file: stored, category: cat.slug.tr }
      attachmentMap[new URL(wp.link).pathname] = { file: stored, category: cat.slug.tr }
    }
  }
  console.log(`  ${cat.slug.tr}: ${ordered.length} images`)
}

const outDir = path.resolve(ROOT, 'src/lib/legacy')
const sortObj = <T,>(o: Record<string, T>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)))
writeFileSync(path.join(outDir, 'media-map.json'), JSON.stringify(sortObj(mediaMap), null, 0) + '\n')
writeFileSync(path.join(outDir, 'attachment-map.json'), JSON.stringify(sortObj(attachmentMap), null, 0) + '\n')
console.log(`seed done: ${created} created, ${skipped} already present; legacy media keys ${Object.keys(mediaMap).length}, attachments ${Object.keys(attachmentMap).length}`)
process.exit(0)
