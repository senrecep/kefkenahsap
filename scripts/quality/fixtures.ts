// #52: a published project and guide in every locale, so the axe spec and Lighthouse CI reach those templates (seed
// projects and guides are drafts; CI starts from an empty DB). Idempotent. Writes .quality-targets.json: the localized
// path of every public template per locale (routing.locales + getPathname), read by the axe spec and lighthouserc.cjs.
// Uses approved photos already in the DB (the real seed locally, tests/e2e/global-setup.ts photos in CI).
// Refuses to run outside CI or a local database, and always with SITE_ENV=production (src/lib/quality/target.ts).
// Run: bun run payload run scripts/quality/fixtures.ts [-- --remove]
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { convertMarkdownToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { guideBodyFeatures } from '@/collections/Guides'
import { routing, type Locale } from '@/i18n/routing'
import { localizedPathname } from '@/lib/i18n/pathname'
import type { Project } from '@/payload-types'
import { fixtureTarget } from '@/lib/quality/target'
import F from './fixtures.json'

const target = fixtureTarget({ databaseUrl: process.env.DATABASE_URL, ci: process.env.CI, siteEnv: process.env.SITE_ENV })
if (!target.ok) {
  console.error(target.errors.map((e) => e.description).join('\n'))
  process.exit(1)
}

const TARGETS = path.resolve('.quality-targets.json')
const { defaultLocale, locales } = routing
const slug = (base: string, locale: Locale) => `${base}-${locale}`
const payload = await getPayload({ config: await config })
const find = (collection: 'projects' | 'guides' | 'categories', base: string) =>
  payload
    .find({ collection, locale: defaultLocale, draft: true, where: { slug: { equals: slug(base, defaultLocale) } }, limit: 1, depth: 0 })
    .then((r) => r.docs[0])

if (process.argv.includes('--remove')) {
  for (const [collection, base] of [['projects', F.project], ['guides', F.guide], ['categories', F.category]] as const) {
    const doc = await find(collection, base)
    if (doc) await payload.delete({ collection, id: doc.id })
  }
  rmSync(TARGETS, { force: true })
  console.log('quality fixtures removed')
  process.exit(0)
}

// Copy exists in Turkish and English; any later locale (F3) gets the English text under its own slug.
const pick = <T>(byLocale: { tr: T; en: T }, locale: Locale): T => (locale === 'tr' ? byLocale.tr : byLocale.en)

let project = (await find('projects', F.project)) as Project | undefined
if (!project) {
  const photos = await payload.find({ collection: 'media', where: { status: { equals: 'approved' } }, limit: 8, depth: 0, sort: 'id' })
  if (photos.docs.length === 0) throw new Error('No approved photos: seed media first')
  const category = photos.docs.find((m) => m.category)?.category
  const title = { tr: 'Bahçe deck ve pergola', en: 'Garden deck and pergola' }
  project = await payload.create({
    collection: 'projects',
    locale: defaultLocale,
    context: { skipAi: true },
    data: {
      _status: 'published',
      title: pick(title, defaultLocale),
      slug: slug(F.project, defaultLocale),
      ...(category ? { categories: [category as number] } : {}),
      gallery: photos.docs.map((m) => m.id),
      city: 'İstanbul',
    },
  })
  for (const locale of locales.filter((l) => l !== defaultLocale))
    await payload.update({ collection: 'projects', id: project.id, locale, context: { skipAi: true }, data: { _status: 'published', title: pick(title, locale), slug: slug(F.project, locale) } })
}

if (!(await find('guides', F.guide))) {
  type GuideCopy = { title: string; body: string } & Record<string, unknown>
  const seed = JSON.parse(readFileSync(path.resolve('seed/content/guides/iroko-mu-teak-mi.json'), 'utf8')) as { tr: GuideCopy; en: GuideCopy }
  const editorConfig = await editorConfigFactory.fromFeatures({ config: payload.config, features: guideBodyFeatures })
  const data = (locale: Locale) => {
    const copy = pick(seed, locale)
    return { ...copy, slug: slug(F.guide, locale), body: convertMarkdownToLexical({ editorConfig, markdown: copy.body }), _status: 'published' as const }
  }
  const doc = await payload.create({ collection: 'guides', locale: defaultLocale, data: data(defaultLocale) })
  for (const locale of locales.filter((l) => l !== defaultLocale)) await payload.update({ collection: 'guides', id: doc.id, locale, data: data(locale) })
}

// Category and photo pages: the fixture project's own category and first photo.
const categoryId = project.categories?.[0]
const photoId = project.gallery?.[0]
if (!categoryId || !photoId) throw new Error('The fixture project needs a category and photos')
const image = await payload.findByID({ collection: 'media', id: typeof photoId === 'object' ? photoId.id : photoId, depth: 0 })

const DECK_DESC = { tr: 'Bahçe ve teras için ahşap deck.', en: 'Timber decking for gardens and terraces.' }
// Created on first use, with its text in every locale (the English copy for later ones).
let fixtureCat: Awaited<ReturnType<typeof find>> | undefined
async function fixtureCategory(locale: Locale) {
  fixtureCat ??= await find('categories', F.category)
  if (!fixtureCat) {
    const name = { tr: 'Bahçe deck (LHCI)', en: 'Garden decking (LHCI)' }
    fixtureCat = await payload.create({ collection: 'categories', locale: defaultLocale, data: { _status: 'published', name: pick(name, defaultLocale), slug: slug(F.category, defaultLocale), shortDesc: pick(DECK_DESC, defaultLocale) } })
    for (const l of locales.filter((x) => x !== defaultLocale))
      await payload.update({ collection: 'categories', id: fixtureCat.id, locale: l, data: { _status: 'published', name: pick(name, l), slug: slug(F.category, l), shortDesc: pick(DECK_DESC, l) } })
  }
  return payload.findByID({ collection: 'categories', id: fixtureCat.id, locale, depth: 0 })
}

const targets: Record<string, Record<string, string>> = {}
for (const locale of locales) {
  let category = await payload.findByID({ collection: 'categories', id: typeof categoryId === 'object' ? categoryId.id : categoryId, locale, depth: 0 })
  // A later locale (ru/de/ar…) may have no category text yet: audit the fixture category there instead of writing
  // into a seeded one. It exists only while the fixtures do (`--remove` deletes it), so which locales have content,
  // and so their noindex/hreflang state, is back to the real data afterwards (tests/e2e/i18n-locales).
  // Its text (and `pick`'s copy for project and guide) is English, so e.g. the ar pages audited here carry Latin text
  // inside an RTL layout: right for axe/Lighthouse structure, not representative of real Arabic content.
  if (!category.slug) category = await fixtureCategory(locale)
  // CI's seeded category has no description, which Lighthouse scores as a missing meta description (real categories
  // always have one). Filled in CI only, where the database is thrown away.
  if (process.env.CI && !category.shortDesc)
    await payload.update({ collection: 'categories', id: category.id, locale, data: { shortDesc: pick(DECK_DESC, locale) } })
  const p = (href: Parameters<typeof localizedPathname<keyof typeof routing.pathnames>>[1]['href']) => localizedPathname(routing, { locale, href })
  targets[locale] = {
    home: p('/'),
    services: p('/hizmetlerimiz'),
    category: p({ pathname: '/[category]', params: { category: category.slug! } }),
    gallery: p('/galeri'),
    image: p({ pathname: '/galeri/[slug]', params: { slug: image.seoFilename ?? String(image.id) } }),
    projects: p('/projeler'),
    project: p({ pathname: '/projeler/[slug]', params: { slug: slug(F.project, locale) } }),
    references: p('/referanslar'),
    about: p('/hakkimizda'),
    contact: p('/iletisim'),
    kvkk: p('/kvkk'),
    cookies: p('/cerez-politikasi'),
    search: p({ pathname: '/ara', query: { q: 'deck' } }),
    searchEmpty: p({ pathname: '/ara', query: { q: 'zzqx-sonuc-yok' } }),
    notFound: `${p('/')}/boyle-bir-sayfa-yok`,
    guides: p('/rehber'),
    guide: p({ pathname: '/rehber/[slug]', params: { slug: slug(F.guide, locale) } }),
  }
}
writeFileSync(TARGETS, `${JSON.stringify(targets, null, 2)}\n`)
console.log(`quality fixtures ready (${locales.join(', ')}) → ${path.basename(TARGETS)}`)
process.exit(0)
