// #34: idempotent content loader — category texts + FAQ, Hakkımızda / İletişim pages, the 9 references.
// Source: seed/content/** (markdown bodies → Lexical). Writes land as drafts; the owner publishes after review.
// Fills only empty fields per locale, so a re-run never overwrites what the owner edited. `-- --force` overwrites.
// Run: bun run payload run scripts/seed/content.ts [-- --force]   (needs the categories from scripts/seed/seed.ts)
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { convertMarkdownToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import { getPayload } from 'payload'
import type { Result } from 'tsentials/result'

import config from '@/payload.config'
import { fillEmpty } from '@/lib/content/merge'
import { parseCategory, parsePage, parseReferences } from '@/lib/content/schema'
import { SEED_CATEGORIES } from '@/seed/categories'

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

// Single source for the reference list (also wanted by #40).
for (const ref of load('references.json', parseReferences)) {
  const found = await payload.find({ collection: 'references', where: { name: { equals: ref.name } }, limit: 1, depth: 0 })
  let id = found.docs[0]?.id
  if (!id) {
    id = (await payload.create({ collection: 'references', locale: 'tr', data: { name: ref.name, location: ref.location.tr } })).id
    writes++
    console.log(`reference ${ref.name} created`)
  }
  for (const locale of locales.filter((l) => l in ref.location)) {
    const current = await payload.findByID({ collection: 'references', id, locale, fallbackLocale: false, depth: 0 })
    const patch = fillEmpty(current, { location: ref.location[locale] }, { force })
    if (!Object.keys(patch).length) continue
    await payload.update({ collection: 'references', id, locale, data: patch })
    writes++
    console.log(`reference ${ref.name} [${locale}]: location`)
  }
}

console.log(`content seed done: ${writes} write(s)${force ? ' (--force)' : ''}`)
process.exit(0)
