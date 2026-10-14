// #34: idempotent content loader — category texts + FAQ, Hakkımızda / İletişim pages, the 9 references, and (#49) the guides.
// Source: seed/content/** (markdown bodies → Lexical). Writes land as drafts; the owner publishes after review.
// Fills only empty fields per locale, so a re-run never overwrites what the owner edited.
// --force: overwrites shortDesc/body/faq of every category, title/slug/body of the two pages and the guide fields in every locale
//   with the committed text (as a new draft; the published version is untouched). References are never forced:
//   they are create-only (see ./references.ts). Pass it after `--`, or `payload run` drops it.
// Run: bun run payload run scripts/seed/content.ts [-- --force]   (needs the categories from scripts/seed/seed.ts)
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { convertMarkdownToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import { getPayload } from 'payload'
import type { Result } from 'tsentials/result'

import config from '@/payload.config'
import { fillEmpty } from '@/lib/content/merge'
import { guideBodyFeatures } from '@/collections/Guides'
import { parseCategory, parseGuide, parsePage } from '@/lib/content/schema'
import { SEED_CATEGORIES } from '@/seed/categories'

import { seedReferences } from './references'

const force = process.argv.includes('--force')
const DIR = path.resolve(process.cwd(), 'seed/content')
const load = <T>(file: string, parse: (json: string) => Result<T>): T => {
  const r = parse(readFileSync(path.join(DIR, file), 'utf8'))
  if (!r.ok) throw new Error(`${file}: ${r.errors.map((e) => e.description).join('; ')}`)
  return r.value
}

const payload = await getPayload({ config: await config })
const editorConfig = await editorConfigFactory.default({ config: payload.config })
const lexical = (markdown: string) => convertMarkdownToLexical({ editorConfig, markdown })
const locales = (payload.config.localization ? payload.config.localization.localeCodes : []) as ('tr' | 'en')[]
let writes = 0

for (const cat of SEED_CATEGORIES) {
  const content = load(`categories/${cat.slug.tr}.json`, parseCategory)
  const found = await payload.find({ collection: 'categories', locale: 'tr', draft: true, where: { slug: { equals: cat.slug.tr } }, limit: 1, depth: 0 })
  const id = found.docs[0]?.id
  if (!id) throw new Error(`category ${cat.slug.tr} not found — run scripts/seed/seed.ts first`)
  for (const locale of locales.filter((l) => l in content)) {
    const c = content[locale]
    const current = await payload.findByID({ collection: 'categories', id, locale, fallbackLocale: false, draft: true, depth: 0 })
    const patch = fillEmpty(current, { shortDesc: c.shortDesc, body: lexical(c.body), faq: c.faq }, { force })
    if (!Object.keys(patch).length) continue
    await payload.update({ collection: 'categories', id, locale, draft: true, data: patch })
    writes++
    console.log(`category ${cat.slug.tr} [${locale}]: ${Object.keys(patch).join(', ')}`)
  }
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
  for (const locale of locales.filter((l) => l in content)) {
    const p = content[locale]
    const current = await payload.findByID({ collection: 'pages', id, locale, fallbackLocale: false, draft: true, depth: 0 })
    const patch = fillEmpty(current, { title: p.title, slug: p.slug, body: lexical(p.body) }, { force })
    if (!Object.keys(patch).length) continue
    await payload.update({ collection: 'pages', id, locale, draft: true, data: patch })
    writes++
    console.log(`page ${file} [${locale}]: ${Object.keys(patch).join(', ')}`)
  }
}

// #49 guides: created as drafts only; the owner publishes after review. Bodies use the guides editor (tables).
const guideEditor = await editorConfigFactory.fromFeatures({ config: payload.config, features: guideBodyFeatures })
const guideLexical = (markdown: string) => convertMarkdownToLexical({ editorConfig: guideEditor, markdown })
for (const file of readdirSync(path.join(DIR, 'guides')).filter((f) => f.endsWith('.json')).sort()) {
  const content = load(`guides/${file}`, parseGuide)
  // Match on the TR slug, else the EN slug, so renaming one slug in the admin doesn't create a duplicate draft.
  const bySlug = async (locale: 'tr' | 'en') =>
    (await payload.find({ collection: 'guides', locale, draft: true, where: { slug: { equals: content[locale].slug } }, limit: 1, depth: 0 })).docs[0]?.id
  let id = (await bySlug('tr')) ?? (await bySlug('en'))
  if (!id) {
    const cats = await payload.find({ collection: 'categories', locale: 'tr', draft: true, where: { slug: { in: content.relatedCategories } }, limit: 20, depth: 0, select: { slug: true } })
    const relatedCategories = content.relatedCategories.flatMap((s) => cats.docs.filter((c) => c.slug === s).map((c) => c.id))
    const t = content.tr
    const created = await payload.create({ collection: 'guides', locale: 'tr', draft: true, data: { title: t.title, slug: t.slug, excerpt: t.excerpt, body: guideLexical(t.body), faq: t.faq, relatedCategories, _status: 'draft' } })
    id = created.id
    writes++
    console.log(`guide ${file} created (draft)`)
  }
  for (const locale of locales.filter((l) => l in content)) {
    const g = content[locale]
    const current = await payload.findByID({ collection: 'guides', id, locale, fallbackLocale: false, draft: true, depth: 0 })
    const patch = fillEmpty(current, { title: g.title, slug: g.slug, excerpt: g.excerpt, body: guideLexical(g.body), faq: g.faq }, { force })
    if (!Object.keys(patch).length) continue
    await payload.update({ collection: 'guides', id, locale, draft: true, data: patch })
    writes++
    console.log(`guide ${file} [${locale}]: ${Object.keys(patch).join(', ')}`)
  }
}

console.log(await seedReferences(payload))

console.log(`content seed done: ${writes} write(s)${force ? ' (--force)' : ''}`)
process.exit(0)
