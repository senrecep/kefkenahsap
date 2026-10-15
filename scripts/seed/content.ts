// #34: idempotent content loader — category texts + FAQ, Hakkımızda / İletişim pages, the 9 references, and (#49) the guides.
// Source: seed/content/** (markdown bodies → Lexical). Writes land as drafts; the owner publishes after review.
// Fills only empty fields per locale, so a re-run never overwrites what the owner edited.
// #138: the other locales (ru/de/ar…) come from seed/i18n/<locale>/content/** when present (see RUNBOOK "Loading
//   translations"); a category's overlay also carries its name and slug. Same draft + fill-empty rules; missing files are skipped.
// --force: overwrites shortDesc/body/faq of every category, title/slug/body of the two pages and the guide fields in every locale
//   with the committed text (as a new draft; the published version is untouched). References are never forced:
//   they are create-only (see ./references.ts). Pass it after `--`, or `payload run` drops it.
// Prints the target database first; a non-local one needs --yes, and SITE_ENV=production is refused.
// Run: bun run payload run scripts/seed/content.ts [-- [--force] [--yes]]   (needs the categories from scripts/seed/seed.ts)
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { convertMarkdownToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import { getPayload } from 'payload'
import type { Result } from 'tsentials/result'

import config from '@/payload.config'
import { guideBodyFeatures } from '@/collections/Guides'
import { markdownWithBlocks } from '@/lib/content/blocks'
import { type GuideContent, parseCategory, parseCategoryOverlay, parseGuide, parseGuideOverlay, parsePage, parsePageOverlay } from '@/lib/content/schema'
import { SEED_CATEGORIES } from '@/seed/categories'

import { uniqueSlugs } from '@/lib/content/overlay'

import { fillLocales, guardTarget, loadOverlay, payloadOverlayLocales, unwrap } from './i18n'
import { seedReferences } from './references'

const force = process.argv.includes('--force')
const SEED = path.resolve(process.cwd(), 'seed')
const DIR = path.join(SEED, 'content')
const load = <T>(file: string, parse: (json: string) => Result<T>): T => {
  const r = parse(readFileSync(path.join(DIR, file), 'utf8'))
  if (!r.ok) throw new Error(`${file}: ${r.errors.map((e) => e.description).join('; ')}`)
  return r.value
}

guardTarget(false)
const payload = await getPayload({ config: await config })
const editorConfig = await editorConfigFactory.default({ config: payload.config })
const lexical = (markdown: string) => convertMarkdownToLexical({ editorConfig, markdown })
const locales = (payload.config.localization ? payload.config.localization.localeCodes : []) as ('tr' | 'en')[]
const extra = payloadOverlayLocales(payload)
/** Overlay locale → mapped overlay content (rel under content/), for the locales that have the file. */
const overlays = <T, U>(rel: string, parse: (json: string) => Result<T>, map: (o: T) => U) =>
  Object.fromEntries(extra.flatMap((l) => {
    const o = loadOverlay(SEED, l, `content/${rel}`, parse)
    return o ? [[l, map(o)]] : []
  }))
let writes = 0
const guideFiles = readdirSync(path.join(DIR, 'guides')).filter((f) => f.endsWith('.json')).sort()

// #138 pre-flight, before any write: each overlay slug is unique per locale and collection, and no other document
// (told apart by its TR slug) already uses it in that locale. Fails with the offending file.
const slugOwners = {
  categories: { parse: parseCategoryOverlay, owners: SEED_CATEGORIES.map((c) => ({ rel: `categories/${c.slug.tr}.json`, trSlug: c.slug.tr })) },
  pages: { parse: parsePageOverlay, owners: ['hakkimizda', 'iletisim'].map((f) => ({ rel: `pages/${f}.json`, trSlug: load(`pages/${f}.json`, parsePage).tr.slug })) },
  guides: { parse: parseGuideOverlay, owners: guideFiles.map((f) => ({ rel: `guides/${f}`, trSlug: load(`guides/${f}`, parseGuide).tr.slug })) },
}
for (const [collection, { parse, owners }] of Object.entries(slugOwners) as [keyof typeof slugOwners, (typeof slugOwners)['pages']][]) {
  const entries = owners.flatMap((o) =>
    extra.flatMap((locale) => {
      const overlay = loadOverlay(SEED, locale, `content/${o.rel}`, parse)
      return overlay ? [{ locale, slug: overlay.slug, file: `${locale}/content/${o.rel}`, trSlug: o.trSlug }] : []
    }),
  )
  unwrap(uniqueSlugs(entries))
  for (const e of entries) {
    const taken = await payload.find({ collection, locale: e.locale, draft: true, where: { slug: { equals: e.slug } }, limit: 10, depth: 0 })
    for (const doc of taken.docs) {
      const tr = await payload.findByID({ collection, id: doc.id, locale: 'tr', fallbackLocale: false, draft: true, depth: 0 })
      if (tr.slug !== e.trSlug) throw new Error(`${e.file}: slug "${e.slug}" is already used by ${collection} ${doc.id} (${tr.slug})`)
    }
  }
}

for (const cat of SEED_CATEGORIES) {
  const content = load(`categories/${cat.slug.tr}.json`, parseCategory)
  const found = await payload.find({ collection: 'categories', locale: 'tr', draft: true, where: { slug: { equals: cat.slug.tr } }, limit: 1, depth: 0 })
  const id = found.docs[0]?.id
  if (!id) throw new Error(`category ${cat.slug.tr} not found — run scripts/seed/seed.ts first`)
  const byLocale = {
    ...Object.fromEntries(locales.filter((l) => l in content).map((l) => [l, { shortDesc: content[l].shortDesc, body: lexical(content[l].body), faq: content[l].faq }])),
    ...overlays(`categories/${cat.slug.tr}.json`, parseCategoryOverlay, (c) => ({ name: c.name, slug: c.slug, shortDesc: c.shortDesc, body: lexical(c.body), faq: c.faq })),
  }
  writes += await fillLocales(payload, 'categories', id, byLocale, { label: `category ${cat.slug.tr}`, draft: true, force })
}

for (const file of ['hakkimizda', 'iletisim']) {
  const content = load(`pages/${file}.json`, parsePage)
  const found = await payload.find({ collection: 'pages', locale: 'tr', draft: true, where: { slug: { equals: content.tr.slug } }, limit: 1, depth: 0 })
  let id = found.docs[0]?.id
  if (!id) {
    const created = await payload.create({ collection: 'pages', locale: 'tr', draft: true, data: { title: content.tr.title, slug: content.tr.slug, body: lexical(content.tr.body), _status: 'draft' } })
    id = created.id
    writes++
    console.log(`page ${file} created (draft)`)
  }
  const page = (p: { title: string; slug: string; body: string }) => ({ title: p.title, slug: p.slug, body: lexical(p.body) })
  const byLocale = { ...Object.fromEntries(locales.filter((l) => l in content).map((l) => [l, page(content[l])])), ...overlays(`pages/${file}.json`, parsePageOverlay, page) }
  writes += await fillLocales(payload, 'pages', id, byLocale, { label: `page ${file}`, draft: true, force })
}

// #49 guides: created as drafts only; the owner publishes after review. Bodies use the guides editor (tables).
const guideEditor = await editorConfigFactory.fromFeatures({ config: payload.config, features: guideBodyFeatures })
// `<!-- block:woodSamples -->` lines become the block (#146).
const guideLexical = (markdown: string) => markdownWithBlocks(markdown, (md) => convertMarkdownToLexical({ editorConfig: guideEditor, markdown: md }))
for (const file of guideFiles) {
  const content = load(`guides/${file}`, parseGuide)
  // Match on the TR slug, else the EN slug, so renaming one slug in the admin doesn't create a duplicate draft.
  const bySlug = async (locale: 'tr' | 'en') =>
    (await payload.find({ collection: 'guides', locale, draft: true, where: { slug: { equals: content[locale].slug } }, limit: 1, depth: 0 })).docs[0]?.id
  let id = (await bySlug('tr')) ?? (await bySlug('en'))
  if (!id) {
    const cats = await payload.find({ collection: 'categories', locale: 'tr', draft: true, where: { slug: { in: content.relatedCategories } }, limit: 20, depth: 0, select: { slug: true } })
    const relatedCategories = content.relatedCategories.flatMap((s) => cats.docs.filter((c) => c.slug === s).map((c) => c.id))
    const t = content.tr
    // #146: the founder byline is on for seeded guides; the cover is the named approved library photo, if present.
    const cover = content.cover ? (await payload.find({ collection: 'media', where: { and: [{ seoFilename: { equals: content.cover } }, { status: { equals: 'approved' } }] }, limit: 1, depth: 0, select: { seoFilename: true } })).docs[0]?.id : undefined
    const created = await payload.create({ collection: 'guides', locale: 'tr', draft: true, data: { title: t.title, slug: t.slug, excerpt: t.excerpt, body: guideLexical(t.body), faq: t.faq, relatedCategories, cover, showAuthor: true, _status: 'draft' } })
    id = created.id
    writes++
    console.log(`guide ${file} created (draft)`)
  }
  const guide = (g: GuideContent['tr']) => ({ title: g.title, slug: g.slug, excerpt: g.excerpt, body: guideLexical(g.body), faq: g.faq })
  const byLocale = { ...Object.fromEntries(locales.filter((l) => l in content).map((l) => [l, guide(content[l])])), ...overlays(`guides/${file}`, parseGuideOverlay, guide) }
  writes += await fillLocales(payload, 'guides', id, byLocale, { label: `guide ${file}`, draft: true, force })
}

console.log(await seedReferences(payload))

console.log(`content seed done: ${writes} write(s)${force ? ' (--force)' : ''}`)
process.exit(0)
