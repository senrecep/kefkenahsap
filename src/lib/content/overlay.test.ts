// #138: translation overlays (seed/i18n/<locale>/…) for the locales beyond TR/EN, and the sentence-case title rule.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { Maybe } from 'tsentials/maybe'

import { mediaSeedKey, overlayLocales, readOverlay, sentenceCaseUpdate } from './overlay'
import { parseCategoryOverlay, parseMediaMetaOverlay, parsePageOverlay } from './schema'

const SEED = path.resolve(process.cwd(), 'tests/fixtures/seed')

describe('overlayLocales', () => {
  it('is every configured locale except TR and EN, in config order', () => {
    expect(overlayLocales(['tr', 'en', 'ar', 'ru', 'de'])).toEqual(['ar', 'ru', 'de'])
  })
})

describe('readOverlay', () => {
  it('reads and validates an existing overlay file', () => {
    const r = readOverlay(SEED, 'ru', 'content/pages/fixture-page.json', parsePageOverlay)
    expect(r.ok && Maybe.isSome(r.value) && r.value.value).toEqual({ title: 'Тестовая страница', slug: 'testovaya-stranitsa-138', body: '## Заголовок\n\nТекст страницы.' })
  })

  it('is none, not an error, when the file or the whole locale is missing', () => {
    for (const [locale, rel] of [['ru', 'content/pages/nope.json'], ['de', 'content/pages/fixture-page.json']] as const) {
      const r = readOverlay(SEED, locale, rel, parsePageOverlay)
      expect(r.ok && Maybe.isNone(r.value)).toBe(true)
    }
  })

  it('fails on a file that does not match the schema, naming the file', () => {
    const r = readOverlay(SEED, 'ru', 'content/categories/invalid.json', parseCategoryOverlay)
    expect(r.ok).toBe(false)
    expect(r.ok ? '' : r.errors[0]!.description).toContain('ru/content/categories/invalid.json')
    expect(r.ok ? '' : r.errors[0]!.description).toContain('slug')
  })
})

describe('parseMediaMetaOverlay', () => {
  it('refuses an alt longer than the 125 characters Media allows', () => {
    const ok = { title: 'T', alt: 'a'.repeat(125), caption: 'C' }
    expect(parseMediaMetaOverlay(JSON.stringify(ok)).ok).toBe(true)
    expect(parseMediaMetaOverlay(JSON.stringify({ ...ok, alt: 'a'.repeat(126) })).ok).toBe(false)
  })
})

describe('mediaSeedKey', () => {
  it('maps a gallery meta path to "<category>/<file>", as seed.ts keys it', () => {
    expect(mediaSeedKey(SEED, 'media-meta/fixture-cat/a.webp.json')).toEqual({ ok: true, value: 'fixture-cat/a.webp' })
  })

  it('maps an archive meta path to "archive/<source>" from the committed meta, as archive.ts keys it', () => {
    expect(mediaSeedKey(SEED, 'media-meta-archive/fixture-cat/b.webp.json')).toEqual({ ok: true, value: 'archive/Fixture Folder/b.jpg' })
  })

  it('fails for an archive path without a committed meta file, or an unknown tree', () => {
    expect(mediaSeedKey(SEED, 'media-meta-archive/fixture-cat/missing.json').ok).toBe(false)
    expect(mediaSeedKey(SEED, 'content/pages/x.json').ok).toBe(false)
  })
})

describe('sentenceCaseUpdate', () => {
  const m = { old: 'Wooden Outdoor Shower', new: 'Wooden outdoor shower' }

  it('updates a title still exactly as seeded', () => {
    expect(sentenceCaseUpdate('Wooden Outdoor Shower', m)).toEqual(Maybe.some('Wooden outdoor shower'))
  })

  it('leaves an owner-edited, already converted or empty title alone', () => {
    for (const current of ['Outdoor Shower', 'Wooden outdoor shower', 'Wooden Outdoor Shower ', '', null, undefined]) {
      expect(Maybe.isNone(sentenceCaseUpdate(current, m))).toBe(true)
    }
  })

  it('does nothing when the mapping does not change the title', () => {
    expect(Maybe.isNone(sentenceCaseUpdate('Kefken Ahşap', { old: 'Kefken Ahşap', new: 'Kefken Ahşap' }))).toBe(true)
  })
})
