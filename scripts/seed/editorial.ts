// #150: loads the editorial picks (seed/editorial/picks.json) and the gallery tags (seed/editorial/tags.json). Fill-only:
// - tags: only while none of them exists: creates them (5 locales, explicit Latin slugs) and adds them to the seeded photos
//   from seed/media-meta/** `tags` (never removing a photo's tags). Once any exists the tagging is done, so a re-run never
//   puts back a tag the owner removed or deleted.
// - homepage: on an empty layout every default section in order with the hero photos and the FAQ; otherwise only the
//   empty hero image / phone image and the empty FAQ items. The FAQ is assembled verbatim from the seed category FAQs
//   (TR/EN: seed/content/categories, ru/de/ar: seed/i18n overlays). The hero photo's focal point is set only while it is
//   still the default 50/50.
// - featured projects (only when no project is featured yet, each found by its photos in exactly one project) and their
//   empty covers; category covers only where unset.
//   Covers have no seeded default: an unset cover shows a computed photo (first of the saved order), so "unset" is the only
//   state that is not an owner's choice.
// Publishing: a document whose latest version is published is written published; one with a pending draft gets a new draft
// (the owner's unpublished edits are never published by this script). The homepage is also published when its latest
// draft and its published version both have no layout at all (nothing of the owner's to publish). Every picked photo is
// checked (exists, approved) before the first write. Price guides are never touched.
// --dry-run writes nothing; a non-local database needs --yes; SITE_ENV=production is refused.
// Run: bun run payload run scripts/seed/editorial.ts [-- --dry-run | --yes]
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { type Faq, fillHomepageLayout, resolveFaq, tagKeysFor } from '@/lib/content/editorial'
import { isEmpty } from '@/lib/content/merge'
import { mediaSeedKey } from '@/lib/content/overlay'
import { parseCategory, parseCategoryOverlay, parseEditorialPicks, parseEditorialTags } from '@/lib/content/schema'
import type { Config } from '@/payload-types'

import { fillLocales, guardTarget, loadOverlay, payloadOverlayLocales, unwrap } from './i18n'

type Locale = Config['locale']
const dryRun = process.argv.includes('--dry-run')
const dry = dryRun ? '[dry run] ' : ''
const SEED = path.resolve(process.cwd(), 'seed')
const read = (rel: string) => readFileSync(path.join(SEED, rel), 'utf8')
const picks = unwrap(parseEditorialPicks(read('editorial/picks.json')))
const tagDefs = unwrap(parseEditorialTags(read('editorial/tags.json'))).tags

guardTarget(dryRun)
const payload = await getPayload({ config: await config })
const locales = (payload.config.localization ? payload.config.localization.localeCodes : []) as Locale[]

/** Media id by seedKey, for every seeded photo. */
const media = new Map<string, { id: number; status?: string | null; tags: number[]; focalX?: number | null; focalY?: number | null }>()
for (const d of (await payload.find({ collection: 'media', where: { seedKey: { exists: true } }, limit: 5000, depth: 0, pagination: false, select: { seedKey: true, status: true, tags: true, focalX: true, focalY: true } })).docs)
  if (d.seedKey) media.set(d.seedKey, { id: d.id, status: d.status, tags: (d.tags ?? []).map((t) => (typeof t === 'number' ? t : t.id)), focalX: d.focalX, focalY: d.focalY })
const approved = (seedKey: string) => {
  const m = media.get(seedKey)
  if (!m || m.status !== 'approved') throw new Error(`${seedKey}: no approved photo with this seedKey`)
  return m
}
// Every picked photo is checked before any write, so a bad pick stops the run with nothing half-written.
const hero = approved(picks.hero.seedKey)
const mobileHero = approved(picks.mobileHero.seedKey)
const projectCovers = new Map(picks.featuredProjects.map((f) => [f.cluster, approved(f.cover).id]))
const categoryCovers = new Map(Object.entries(picks.categoryCovers).map(([slug, c]) => [slug, approved(c.seedKey).id]))

// --- Tags ---------------------------------------------------------------------------------------------------------
const tagIds = new Map<string, number>()
let tagWrites = 0
// Photos get tags once, on the run that creates them: once any of these tags exists, the attaching has been done and a
// re-run must not put back a tag the owner removed from a photo (or re-create one the owner deleted and re-attach it).
const tagsExisted = (await payload.find({ collection: 'tags', locale: 'tr', where: { slug: { in: tagDefs.map((d) => d.slug.tr) } }, limit: 1, depth: 0 })).totalDocs > 0
for (const def of tagsExisted ? [] : tagDefs) {
  console.log(`${dry}tag ${def.key}: create`)
  tagWrites++
  if (dryRun) continue
  const { id } = await payload.create({ collection: 'tags', locale: 'tr', data: { name: def.name.tr, slug: def.slug.tr, axis: def.axis } })
  tagIds.set(def.key, id)
  const byLocale = Object.fromEntries(locales.filter((l) => l !== 'tr').map((l) => [l, { name: def.name[l], slug: def.slug[l] }]))
  tagWrites += await fillLocales(payload, 'tags', id, byLocale, { label: `tag ${def.key}`, dryRun })
}

let photoWrites = 0
const metaRels = readdirSync(path.join(SEED, 'media-meta'), { recursive: true, encoding: 'utf8' })
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => `media-meta/${f.split(path.sep).join('/')}`)
for (const rel of tagsExisted ? [] : metaRels) {
  const m = media.get(unwrap(mediaSeedKey(SEED, rel)))
  if (!m) continue
  const keys = tagKeysFor(tagDefs, (JSON.parse(read(rel)) as { tags?: Record<string, string[]> }).tags ?? {})
  const add = keys.map((k) => tagIds.get(k)).filter((id): id is number => id !== undefined && !m.tags.includes(id))
  // A dry run on a database without the tags yet counts the photos that would get one.
  if (!add.length && !(dryRun && keys.some((k) => !tagIds.has(k)))) continue
  photoWrites++
  if (!dryRun) await payload.update({ collection: 'media', id: m.id, data: { tags: [...m.tags, ...add] }, depth: 0, context: { skipAi: true } })
}
console.log(tagsExisted ? 'tags: already applied (a gallery tag exists), left as is' : `${dry}tags: ${tagWrites} tag write(s); ${photoWrites} photo(s) get tags (of ${metaRels.length} meta files)`)

// --- Hero focal point -----------------------------------------------------------------------------------------------
if ((hero.focalX ?? 50) === 50 && (hero.focalY ?? 50) === 50 && (picks.hero.focal.x !== 50 || picks.hero.focal.y !== 50)) {
  console.log(`${dry}hero photo: focal point ${picks.hero.focal.x}/${picks.hero.focal.y}`)
  if (!dryRun) await payload.update({ collection: 'media', id: hero.id, data: { focalX: picks.hero.focal.x, focalY: picks.hero.focal.y }, depth: 0, context: { skipAi: true } })
}

// --- Homepage -------------------------------------------------------------------------------------------------------
const faqSources: Record<string, Record<string, Faq[]>> = {}
for (const { category } of picks.faq) {
  const c = unwrap(parseCategory(read(`content/categories/${category}.json`)))
  for (const l of ['tr', 'en'] as const) faqSources[l] = { ...faqSources[l], [category]: c[l].faq }
  for (const l of payloadOverlayLocales(payload)) {
    const o = loadOverlay(SEED, l, `content/categories/${category}.json`, parseCategoryOverlay)
    if (o) faqSources[l] = { ...faqSources[l], [category]: o.faq }
  }
}
const faq = unwrap(resolveFaq(picks.faq, faqSources))

type Layout = Parameters<typeof fillHomepageLayout>[0]
const readHome = (locale: Locale) => payload.findGlobal({ slug: 'homepage', locale, fallbackLocale: false, draft: true, depth: 0 })
const first = await readHome('tr')
// Published when the latest version is (nothing pending), or when neither the latest draft nor the published homepage has
// any layout (a never-configured homepage: there is nothing of the owner's to publish by accident).
const published = await payload.findGlobal({ slug: 'homepage', locale: 'tr', fallbackLocale: false, draft: false, depth: 0 })
const publishHome = first._status === 'published' || (!first.layout?.length && !published.layout?.length)
let homeWrites = 0
for (const locale of ['tr' as const, ...locales.filter((l) => l !== 'tr' && faq[l])]) {
  const current = locale === 'tr' ? first : await readHome(locale)
  const next = fillHomepageLayout((current.layout ?? []) as unknown as Layout, locale === 'tr' ? { image: hero.id, mobileImage: mobileHero.id, faq: faq.tr! } : { faq: faq[locale]! })
  if (!next.filled.length) continue
  homeWrites++
  console.log(`${dry}homepage [${locale}]: ${next.filled.join(', ')}${publishHome ? '' : ' (as a draft: the homepage has unpublished changes)'}`)
  if (dryRun) {
    if (next.filled.includes('layout')) break // the other locales fill the layout TR creates
    continue
  }
  await payload.updateGlobal({ slug: 'homepage', locale, draft: !publishHome, data: { layout: next.layout as never, _status: publishHome ? 'published' : 'draft' }, depth: 0 })
}

// --- Featured projects and category covers --------------------------------------------------------------------------
/** Writes `data` on a document: published when its latest version is, else as a new draft. Returns the field names written. */
async function fillDoc(collection: 'projects' | 'categories', id: number, data: Record<string, unknown>, label: string): Promise<number> {
  const latest = await payload.findByID({ collection, id, draft: true, depth: 0 })
  const current = latest as unknown as Record<string, unknown>
  const patch = Object.fromEntries(Object.entries(data).filter(([k]) => isEmpty(current[k]) || current[k] === false))
  if (!Object.keys(patch).length) return 0
  const draft = latest._status !== 'published'
  console.log(`${dry}${label}: ${Object.keys(patch).join(', ')}${draft ? ' (draft)' : ''}`)
  if (!dryRun) await payload.update({ collection, id, draft, data: patch as never, depth: 0, context: { skipAi: true } })
  return 1
}

let projectWrites = 0
const alreadyFeatured = (await payload.find({ collection: 'projects', draft: true, where: { featured: { equals: true } }, limit: 1, depth: 0 })).totalDocs
if (alreadyFeatured) console.log('featured projects: some project is already featured, left as is')
else {
  const { clusters } = JSON.parse(read('clusters/clusters.json')) as { clusters: { key: string; title: string; seedKeys: string[] }[] }
  for (const f of picks.featuredProjects) {
    // Found by its photos, not its title: titles get edited (#148), the cluster's photos stay in the gallery.
    const photoIds = (clusters.find((c) => c.key === f.cluster)?.seedKeys ?? []).flatMap((k) => media.get(k)?.id ?? [])
    const found = photoIds.length ? (await payload.find({ collection: 'projects', locale: 'tr', draft: true, where: { gallery: { in: photoIds } }, limit: 2, depth: 0 })).docs : []
    if (found.length !== 1) {
      console.log(`project ${f.cluster}: ${found.length ? 'more than one project has its photos, left as is' : 'not found (not seeded)'}`)
      continue
    }
    projectWrites += await fillDoc('projects', found[0]!.id, { featured: true, cover: projectCovers.get(f.cluster) }, `project "${found[0]!.title}"`)
  }
}

let coverWrites = 0
for (const slug of categoryCovers.keys()) {
  const doc = (await payload.find({ collection: 'categories', locale: 'tr', draft: true, where: { slug: { equals: slug } }, limit: 1, depth: 0 })).docs[0]
  if (!doc) {
    console.log(`category ${slug}: not found`)
    continue
  }
  coverWrites += await fillDoc('categories', doc.id, { cover: categoryCovers.get(slug) }, `category ${slug} cover`)
}

console.log(`${dry}editorial: homepage ${homeWrites} write(s)${homeWrites ? (publishHome ? ' (published)' : ' (draft)') : ''}; ${projectWrites} project(s); ${coverWrites} category cover(s)`)
process.exit(0)
