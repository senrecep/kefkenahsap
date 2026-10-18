// #33: one DRAFT project per reviewed photo cluster (seed/clusters/clusters.json). Nothing is published; the owner
// reviews each draft in the admin. Fills only the working title, the category, the gallery (cluster order) and, where the
// cluster has one, the year (#148: from the photos' EXIF date, moved out of the title).
// Run: bun run payload run scripts/seed/project-drafts.ts   (uses the env's DB; media must be seeded first)
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'

import config from '@/payload.config'

type Cluster = { n: number; key: string; title: string; year?: number; category: string; seedKeys: string[] }

const { clusters } = JSON.parse(readFileSync(path.resolve(process.cwd(), 'seed/clusters/clusters.json'), 'utf8')) as { clusters: Cluster[] }
const payload = await getPayload({ config: await config })
let created = 0
let skipped = 0

for (const c of clusters) {
  // shortcut: matched by the Turkish working title (Projects has no field for the cluster key, and we don't add one
  // just for this); if the owner renames a draft, a re-run creates the suggestion again — delete the duplicate.
  const existing = await payload.find({ collection: 'projects', locale: 'tr', draft: true, where: { title: { equals: c.title } }, limit: 1, depth: 0 })
  if (existing.docs.length) {
    skipped++
    continue
  }
  const category = await payload.find({ collection: 'categories', locale: 'tr', where: { slug: { equals: c.category } }, limit: 1, depth: 0 })
  const media = await payload.find({ collection: 'media', where: { seedKey: { in: c.seedKeys } }, limit: 0, pagination: false, depth: 0 })
  const idByKey = new Map(media.docs.map((m) => [m.seedKey, m.id]))
  const gallery = c.seedKeys.map((k) => idByKey.get(k))
  if (!category.docs[0] || gallery.some((id) => id === undefined))
    throw new Error(`cluster ${c.n} (${c.key}): category or media missing — run scripts/seed/seed.ts first`)
  await payload.create({
    collection: 'projects',
    locale: 'tr',
    draft: true,
    data: { _status: 'draft', title: c.title, year: c.year, categories: [category.docs[0].id], gallery: gallery as number[] },
  })
  created++
}
console.log(`project drafts: ${created} created, ${skipped} already present (${clusters.length} clusters)`)
process.exit(0)
