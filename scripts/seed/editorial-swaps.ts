// #156: applies the re-picks in seed/editorial/picks.json without touching owner choices:
// - swaps.guideCovers / categoryCovers: the cover becomes `to` only while it is still exactly `from` (same media id);
// - swaps.projectCovers: `from: null`, so only while the project has no cover AND its first gallery photo (the hero the
//   page shows) is still `firstPhoto`;
// - projectCategories: `add` is appended only while the project's categories are exactly `from` (ids, in order).
// Anything else is the owner's (or already done) and is left as is. Each check runs on the document's LATEST version:
// published stays published, a pending draft gets a new draft. Every `to` photo is checked (exists, approved) before the
// first write. Projects are found by their cluster photos (seed/clusters/clusters.json), as in editorial.ts.
// New databases need this only for the project cover and category links: guide covers come from seed/content/guides
// (`cover`, guides-finish.ts) and the category cover from picks.categoryCovers (editorial.ts).
// --dry-run writes nothing; a non-local database needs --yes; SITE_ENV=production is refused.
// Run: bun run payload run scripts/seed/editorial-swaps.ts [-- --dry-run | --yes]
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { appendCategories, coverSwap } from '@/lib/content/editorial'
import { parseEditorialPicks, parseGuide } from '@/lib/content/schema'

import { guardTarget, unwrap } from './i18n'

const dryRun = process.argv.includes('--dry-run')
const dry = dryRun ? '[dry run] ' : ''
const SEED = path.resolve(process.cwd(), 'seed')
const read = (rel: string) => readFileSync(path.join(SEED, rel), 'utf8')
const { swaps, projectCategories } = unwrap(parseEditorialPicks(read('editorial/picks.json')))
const { clusters } = JSON.parse(read('clusters/clusters.json')) as { clusters: { key: string; seedKeys: string[] }[] }

guardTarget(dryRun)
const payload = await getPayload({ config: await config })

const media = new Map<string, { id: number; status?: string | null }>()
for (const d of (await payload.find({ collection: 'media', where: { seedKey: { exists: true } }, limit: 5000, depth: 0, pagination: false, select: { seedKey: true, status: true } })).docs)
  if (d.seedKey) media.set(d.seedKey, { id: d.id, status: d.status })
const idOf = (seedKey: string | null) => (seedKey === null ? null : (media.get(seedKey)?.id ?? -1)) // -1: not here, matches nothing
for (const s of [...Object.values(swaps.guideCovers), ...Object.values(swaps.categoryCovers), ...Object.values(swaps.projectCovers)])
  if (media.get(s.to)?.status !== 'approved') throw new Error(`${s.to}: no approved photo with this seedKey`)

type Collection = 'guides' | 'categories' | 'projects'
const ref = (v: unknown) => (typeof v === 'object' && v !== null ? (v as { id: number }).id : (v as number | null | undefined)) ?? null
const counts = { write: 0, done: 0, kept: 0, missing: 0 }

/** Latest version of a document found by `where` (exactly one), or undefined. */
async function latest(collection: Collection, where: Record<string, unknown>, label: string) {
  const found = await payload.find({ collection, locale: 'tr', draft: true, where: where as never, limit: 2, depth: 0 })
  if (found.docs.length !== 1) {
    console.log(`${label}: ${found.docs.length ? 'more than one match' : 'not found'}, left as is`)
    counts.missing++
    return undefined
  }
  return (await payload.findByID({ collection, id: found.docs[0]!.id, draft: true, depth: 0 })) as unknown as Record<string, unknown> & { id: number; _status?: string | null }
}

async function apply(collection: Collection, doc: Awaited<ReturnType<typeof latest>>, label: string, outcome: 'write' | 'done' | 'kept', data: Record<string, unknown>) {
  if (!doc) return
  counts[outcome]++
  if (outcome !== 'write') return console.log(`${label}: ${outcome === 'done' ? 'already the new pick' : "differs from the previous pick (owner's choice), left as is"}`)
  const draft = doc._status !== 'published'
  console.log(`${dry}${label}: ${Object.keys(data).join(', ')}${draft ? ' (draft)' : ''}`)
  if (!dryRun) await payload.update({ collection, id: doc.id, draft, data: data as never, depth: 0, context: { skipAi: true } })
}

for (const [file, s] of Object.entries(swaps.guideCovers)) {
  const label = `guide ${file} cover`
  const doc = await latest('guides', { slug: { equals: unwrap(parseGuide(read(`content/guides/${file}.json`))).tr.slug } }, label)
  if (doc) await apply('guides', doc, label, coverSwap({ cover: ref(doc.cover) }, { cover: idOf(s.from) }, idOf(s.to)!), { cover: idOf(s.to) })
}
for (const [slug, s] of Object.entries(swaps.categoryCovers)) {
  const label = `category ${slug} cover`
  const doc = await latest('categories', { slug: { equals: slug } }, label)
  if (doc) await apply('categories', doc, label, coverSwap({ cover: ref(doc.cover) }, { cover: idOf(s.from) }, idOf(s.to)!), { cover: idOf(s.to) })
}

/** The project holding a cluster's photos (found by its photos: titles get edited). */
const project = (key: string, label: string) => {
  const ids = (clusters.find((c) => c.key === key)?.seedKeys ?? []).flatMap((k) => media.get(k)?.id ?? [])
  return latest('projects', { gallery: { in: ids.length ? ids : [-1] } }, label)
}
for (const [key, s] of Object.entries(swaps.projectCovers)) {
  const label = `project ${key} cover`
  const doc = await project(key, label)
  if (doc) {
    const now = { cover: ref(doc.cover), first: ref((doc.gallery as unknown[] | null | undefined)?.[0]) }
    await apply('projects', doc, label, coverSwap(now, { cover: null, first: idOf(s.firstPhoto) }, idOf(s.to)!), { cover: idOf(s.to) })
  }
}

const categoryIds = new Map((await payload.find({ collection: 'categories', locale: 'tr', draft: true, limit: 100, depth: 0, select: { slug: true } })).docs.map((c) => [c.slug, c.id]))
for (const [key, l] of Object.entries(projectCategories)) {
  const label = `project ${key} categories +${l.add.join(' +')}`
  const doc = await project(key, label)
  if (!doc) continue
  const ids = (slugs: string[]) => slugs.map((s) => categoryIds.get(s) ?? -1)
  if (ids(l.add).includes(-1)) {
    console.log(`${label}: a category to add is not in this database, left as is`)
    counts.missing++
    continue
  }
  const next = appendCategories(((doc.categories as unknown[] | null | undefined) ?? []).map((c) => ref(c) ?? -1), ids(l.from), ids(l.add))
  await apply('projects', doc, label, Array.isArray(next) ? 'write' : next, { categories: next })
}

console.log(`${dry}editorial swaps: ${counts.write} write(s), ${counts.done} already done, ${counts.kept} kept (owner's choice), ${counts.missing} not found`)
process.exit(0)
