// #138: translation overlays fill only empty fields of the extra locales, as drafts, and never touch a photo's status.
import { mkdirSync } from 'fs'
import os from 'os'
import path from 'path'
import { convertMarkdownToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import { getPayload, type Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, expect, it } from 'vitest'

import { parsePageOverlay } from '@/lib/content/schema'
import config from '@/payload.config'

import { fillLocales, loadOverlay, seedMediaLocales } from '../../scripts/seed/i18n'

const SEED = path.resolve(process.cwd(), 'tests/fixtures/seed')
const IMG = path.join(os.tmpdir(), 'kefken-i18n-overlay', 'a.webp')
const MEDIA = [
  { rel: 'media-meta/fixture-cat/a.webp.json', seedKey: 'fixture-cat/a.webp' },
  { rel: 'media-meta-archive/fixture-cat/b.webp.json', seedKey: 'archive/Fixture Folder/b.jpg' },
]
let payload: Payload
let pageId: number | undefined
const mediaIds: number[] = []

const cleanup = async () => {
  await payload.delete({ collection: 'media', where: { seedKey: { in: MEDIA.map((m) => m.seedKey) } } })
  await payload.delete({ collection: 'pages', where: { slug: { equals: 'i18n-overlay-138' } } })
}

beforeAll(async () => {
  mkdirSync(path.dirname(IMG), { recursive: true })
  await sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 90, g: 80, b: 60 } } }).webp().toFile(IMG)
  payload = await getPayload({ config: await config })
  await cleanup()
})
afterAll(async () => {
  await cleanup()
  if (pageId) await payload.delete({ collection: 'pages', id: pageId }).catch(() => {})
  for (const id of mediaIds) await payload.delete({ collection: 'media', id }).catch(() => {})
})

it('a ru overlay fills the empty ru fields of a published page as a new draft and keeps the filled ru title and slug', async () => {
  const page = await payload.create({ collection: 'pages', locale: 'tr', data: { title: 'Overlay sayfası', slug: 'i18n-overlay-138', _status: 'published' } })
  pageId = page.id
  // The owner's ru title (its slug is filled from it by the slug hook); the ru body stays empty.
  await payload.update({ collection: 'pages', id: page.id, locale: 'ru', data: { title: 'Своё название', _status: 'published' } })

  const ru = loadOverlay(SEED, 'ru', 'content/pages/fixture-page.json', parsePageOverlay)!
  const editorConfig = await editorConfigFactory.default({ config: payload.config })
  const incoming = { title: ru.title, slug: ru.slug, body: convertMarkdownToLexical({ editorConfig, markdown: ru.body }) }
  expect(await fillLocales(payload, 'pages', page.id, { ru: incoming }, { label: 'page', draft: true })).toBe(1)

  const draft = await payload.findByID({ collection: 'pages', id: page.id, locale: 'ru', fallbackLocale: false, draft: true, depth: 0 })
  expect([draft.title, draft.slug, draft._status]).toEqual(['Своё название', 'svoe-nazvanie', 'draft'])
  expect(JSON.stringify(draft.body)).toContain('Текст страницы.')
  const published = await payload.findByID({ collection: 'pages', id: page.id, locale: 'ru', fallbackLocale: false, depth: 0 })
  expect([published._status, published.slug, published.body ?? null]).toEqual(['published', 'svoe-nazvanie', null])

  // A re-run has nothing left to fill.
  expect(await fillLocales(payload, 'pages', page.id, { ru: incoming }, { label: 'page', draft: true })).toBe(0)
})

it('media-locales fills empty ru meta, keeps a filled ru alt and leaves approved and pending photos as they were', async () => {
  const create = async (seedKey: string, status: 'approved' | 'pending') =>
    (await payload.create({ collection: 'media', locale: 'tr', data: { seedKey, status, title: 'Ahşap', alt: 'Ahşap deck' }, filePath: IMG, context: { skipAi: true } })).id
  const approved = await create(MEDIA[0]!.seedKey, 'approved')
  const pending = await create(MEDIA[1]!.seedKey, 'pending')
  mediaIds.push(approved, pending)
  await payload.update({ collection: 'media', id: pending, locale: 'ru', data: { alt: 'Свой alt' }, context: { skipAi: true } })

  const rels = [...MEDIA.map((m) => m.rel), 'media-meta/fixture-cat/no-overlay.webp.json']
  expect(await seedMediaLocales(payload, { seedDir: SEED, rels })).toEqual({ writes: 2, media: 2, noOverlay: 1, noMedia: 0 })

  const ru = async (id: number) => payload.findByID({ collection: 'media', id, locale: 'ru', fallbackLocale: false, depth: 0 })
  const [a, b] = [await ru(approved), await ru(pending)]
  expect([a.status, a.title, a.alt, a.caption]).toEqual(['approved', 'Деревянная терраса', 'Деревянная терраса из ироко у дома.', 'Терраса из ироко.'])
  expect([b.status, b.title, b.alt, b.caption]).toEqual(['pending', 'Беседка в саду', 'Свой alt', 'Беседка из сосны.'])
  expect((await payload.findByID({ collection: 'media', id: approved, locale: 'tr', depth: 0 })).alt).toBe('Ahşap deck')

  expect(await seedMediaLocales(payload, { seedDir: SEED, rels })).toEqual({ writes: 0, media: 0, noOverlay: 1, noMedia: 0 })
})
