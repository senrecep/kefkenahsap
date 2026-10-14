// #52: one published project and one published guide at fixed slugs, so Lighthouse CI and the axe spec can reach
// those templates (seed projects and guides are drafts; CI starts from an empty DB). Idempotent.
// Uses approved photos already in the DB (the real seed locally, tests/e2e/global-setup.ts photos in CI).
// Run: bun run payload run scripts/quality/fixtures.ts [-- --remove]
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { convertMarkdownToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { guideBodyFeatures } from '@/collections/Guides'
import F from './fixtures.json'

const payload = await getPayload({ config: await config })
const find = (collection: 'projects' | 'guides', slug: string) =>
  payload.find({ collection, locale: 'tr', draft: true, where: { slug: { equals: slug } }, limit: 1, depth: 0 }).then((r) => r.docs[0])

if (process.argv.includes('--remove')) {
  for (const [collection, slug] of [['projects', F.project.tr], ['guides', F.guide.tr]] as const) {
    const doc = await find(collection, slug)
    if (doc) await payload.delete({ collection, id: doc.id })
  }
  console.log('quality fixtures removed')
  process.exit(0)
}

if (!(await find('projects', F.project.tr))) {
  const photos = await payload.find({ collection: 'media', where: { status: { equals: 'approved' } }, limit: 8, depth: 0, sort: 'id' })
  if (photos.docs.length === 0) throw new Error('No approved photos: seed media first')
  const category = photos.docs.find((m) => m.category)?.category
  const doc = await payload.create({
    collection: 'projects',
    locale: 'tr',
    context: { skipAi: true },
    data: {
      _status: 'published',
      title: 'Bahçe deck ve pergola',
      slug: F.project.tr,
      ...(category ? { categories: [category as number] } : {}),
      gallery: photos.docs.map((m) => m.id),
      city: 'İstanbul',
    },
  })
  await payload.update({ collection: 'projects', id: doc.id, locale: 'en', data: { _status: 'published', title: 'Garden deck and pergola', slug: F.project.en } })
}

if (!(await find('guides', F.guide.tr))) {
  const seed = JSON.parse(readFileSync(path.resolve('seed/content/guides/iroko-mu-teak-mi.json'), 'utf8'))
  const editorConfig = await editorConfigFactory.fromFeatures({ config: payload.config, features: guideBodyFeatures })
  const body = (md: string) => convertMarkdownToLexical({ editorConfig, markdown: md })
  const doc = await payload.create({ collection: 'guides', locale: 'tr', data: { ...seed.tr, slug: F.guide.tr, body: body(seed.tr.body), _status: 'published' } })
  await payload.update({ collection: 'guides', id: doc.id, locale: 'en', data: { ...seed.en, slug: F.guide.en, body: body(seed.en.body), _status: 'published' } })
}
// CI's seeded category (tests/e2e/global-setup.ts) has no description, which Lighthouse scores as a missing meta
// description on the category page; real categories always have one. CI's DB is throwaway, so fill it there only.
if (process.env.CI) {
  const cat = await payload.find({ collection: 'categories', locale: 'tr', where: { slug: { equals: 'e2e-deck' } }, limit: 1, depth: 0 })
  const doc = cat.docs[0]
  if (doc && !doc.shortDesc) await payload.update({ collection: 'categories', id: doc.id, locale: 'tr', data: { shortDesc: 'Bahçe ve teras için ahşap deck uygulamaları.' } })
}
console.log('quality fixtures ready')
process.exit(0)
