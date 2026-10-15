// #138: translation overlays (seed/i18n/<locale>/…) for the locales beyond TR/EN, and the sentence-case title rule.
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { Maybe } from 'tsentials/maybe'

import { mediaSeedKey, mergeTextFixes, overlayLocales, projectFixPatch, projectYearFix, readOverlay, slugFix, textFixUpdate, uniqueSlugs } from './overlay'
import { parseCategoryOverlay, parseMediaMetaOverlay, parsePageOverlay, parseProjectFixes } from './schema'

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

describe('overlay slugs', () => {
  const category = (slug: string) => JSON.stringify({ name: 'N', slug, shortDesc: 'S', body: 'B', faq: [] })

  it('must be lowercase ASCII words joined by single dashes', () => {
    expect(parseCategoryOverlay(category('derevyannye-konstruktsii')).ok).toBe(true)
    for (const slug of ['Derevo', 'a--b', '-a', 'a-', 'дерево', 'a_b', 'a b']) {
      expect(parsePageOverlay(JSON.stringify({ title: 'T', slug, body: 'B' })).ok, slug).toBe(false)
    }
  })

  it('a category slug may not take a fixed route segment (ru gallery, de contact)', () => {
    expect(parseCategoryOverlay(category('galereya')).ok).toBe(false)
    expect(parseCategoryOverlay(category('kontakt')).ok).toBe(false)
  })

  it('are unique per locale within a collection, naming the clashing files', () => {
    const r = uniqueSlugs([
      { locale: 'ru', slug: 'dek', file: 'ru/a.json' },
      { locale: 'ru', slug: 'dek', file: 'ru/b.json' },
      { locale: 'de', slug: 'dek', file: 'de/a.json' },
    ])
    expect(r.ok).toBe(false)
    expect(r.ok ? '' : r.errors[0]!.description).toMatch(/ru\/a\.json.*ru\/b\.json/)
    expect(r.ok ? '' : r.errors[0]!.description).not.toContain('de/a.json')
    expect(uniqueSlugs([{ locale: 'ru', slug: 'dek', file: 'a' }, { locale: 'de', slug: 'dek', file: 'b' }]).ok).toBe(true)
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

describe('textFixUpdate', () => {
  it('replaces a caption still exactly as seeded, not one the owner rewrote', () => {
    const caption = { old: 'Lavabo kapısı. Malzeme fotoğraftan anlaşılmıyor.', new: 'Lavabo kapısı.' }
    expect(textFixUpdate('Lavabo kapısı. Malzeme fotoğraftan anlaşılmıyor.', caption)).toEqual(Maybe.some('Lavabo kapısı.'))
    expect(Maybe.isNone(textFixUpdate('Lavabo kapısı, siyah çerçeve.', caption))).toBe(true)
  })

  const m = { old: 'Wooden Outdoor Shower', new: 'Wooden outdoor shower' }

  it('updates a title still exactly as seeded', () => {
    expect(textFixUpdate('Wooden Outdoor Shower', m)).toEqual(Maybe.some('Wooden outdoor shower'))
  })

  it('leaves an owner-edited, already converted or empty title alone', () => {
    for (const current of ['Outdoor Shower', 'Wooden outdoor shower', 'Wooden Outdoor Shower ', '', null, undefined]) {
      expect(Maybe.isNone(textFixUpdate(current, m))).toBe(true)
    }
  })

  it('does nothing when the mapping does not change the title', () => {
    expect(Maybe.isNone(textFixUpdate('Kefken Ahşap', { old: 'Kefken Ahşap', new: 'Kefken Ahşap' }))).toBe(true)
  })
})

describe('mergeTextFixes', () => {
  it('turns sentence-case titles into title fixes and adds field fixes, the field fix winning on the same field', () => {
    const t = (o: string, n: string) => ({ tr: { old: o, new: n } })
    const merged = mergeTextFixes(
      { 'media-meta/a/1.json': t('A B', 'A b'), 'media-meta/a/2.json': t('C D', 'C d') },
      { 'media-meta/a/2.json': { caption: t('X. Y.', 'X.') }, 'media-meta/a/3.json': { title: t('E F', 'E f') } },
    )
    expect(merged).toEqual({
      'media-meta/a/1.json': { title: t('A B', 'A b') },
      'media-meta/a/2.json': { title: t('C D', 'C d'), caption: t('X. Y.', 'X.') },
      'media-meta/a/3.json': { title: t('E F', 'E f') },
    })
  })
})

describe('projectFixPatch (#148)', () => {
  const fix = {
    year: 2014,
    title: { tr: { old: 'Ahşap teras (2014)', new: 'Ahşap teras' }, ru: { old: 'Террасы (2014)', new: 'Террасы' } },
    story: { tr: { old: 'Ahşap açık renkli görünüyor.', new: 'Teras kurduk.' }, en: { old: 'The timber looks light.', new: 'We built terraces.' } },
  }

  it('replaces title and story while both are still the seeded text', () => {
    expect(projectFixPatch({ title: 'Ahşap teras (2014)', story: 'Ahşap açık renkli görünüyor.' }, fix, 'tr')).toEqual({ title: 'Ahşap teras', story: 'Teras kurduk.' })
  })

  it('keeps a field the owner edited and still fixes the untouched one', () => {
    expect(projectFixPatch({ title: 'Sahil terası', story: 'Ahşap açık renkli görünüyor.' }, fix, 'tr')).toEqual({ story: 'Teras kurduk.' })
    expect(projectFixPatch({ title: 'Ahşap teras (2014)', story: 'Sahibin yazdığı hikâye.' }, fix, 'tr')).toEqual({ title: 'Ahşap teras' })
  })

  it('writes nothing for an empty, already fixed or unmapped field', () => {
    expect(projectFixPatch({ title: null, story: '' }, fix, 'tr')).toEqual({})
    expect(projectFixPatch({ title: 'Ahşap teras', story: 'Teras kurduk.' }, fix, 'tr')).toEqual({})
    expect(projectFixPatch({ title: 'Террасы (2014)', story: 'The timber looks light.' }, fix, 'ru')).toEqual({ title: 'Террасы' })
    expect(projectFixPatch({ title: 'X', story: 'Y' }, fix, 'de')).toEqual({})
  })

  it('fills the year only while it is empty', () => {
    expect(projectYearFix(null, fix)).toEqual(Maybe.some(2014))
    expect(projectYearFix(undefined, fix)).toEqual(Maybe.some(2014))
    expect(Maybe.isNone(projectYearFix(2013, fix))).toBe(true)
    expect(Maybe.isNone(projectYearFix(null, { story: fix.story }))).toBe(true)
  })

  it('parses the committed fixes file shape and rejects unknown fields', () => {
    expect(parseProjectFixes(JSON.stringify({ k: fix })).ok).toBe(true)
    expect(parseProjectFixes(JSON.stringify({ k: { ...fix, slug: { tr: { old: 'a', new: 'b' } } } })).ok).toBe(false)
  })
})

describe('slugFix (#156: projects whose ar slug the pre-transliteration hook left empty or a bare year)', () => {
  const title = 'تراسات خشبية ودرابزين ومظلات 2014'
  it('fills an empty slug with the hand-written one, else with the transliterated title', () => {
    expect(slugFix({ slug: null, title }, 'ar', 'tirasat-khashabiya')).toEqual(Maybe.some('tirasat-khashabiya'))
    expect(slugFix({ slug: '', title: 'خزائن مطبخ' }, 'ar')).toEqual(Maybe.some('khzan-mtbkh'))
  })
  it("replaces exactly the old hook's output (the Latin left of an Arabic title: here the year)", () => {
    expect(slugFix({ slug: '2014', title }, 'ar', 'tirasat-khashabiya')).toEqual(Maybe.some('tirasat-khashabiya'))
  })
  it("keeps any other slug: an editor's choice, or one already fixed", () => {
    for (const slug of ['2016', 'my-terrace', 'tirasat-khashabiya']) expect(slugFix({ slug, title }, 'ar', 'tirasat-khashabiya')).toEqual(Maybe.none())
  })
  it('does nothing without a title, and leaves a Latin-script locale whose slug already follows its title', () => {
    expect(slugFix({ slug: null, title: '  ' }, 'ar', 'x')).toEqual(Maybe.none())
    expect(slugFix({ slug: 'kleine-holzterrasse', title: 'Kleine Holzterrasse' }, 'de')).toEqual(Maybe.none())
    expect(slugFix({ slug: null, title: 'Kleine Holzterrasse' }, 'de')).toEqual(Maybe.some('kleine-holzterrasse'))
  })
})
