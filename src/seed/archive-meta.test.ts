// #65: the metadata written for the archive photos (seed/media-meta-archive) follows the tagImage schema and the style guide.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { StoredTagImageSchema } from '@/ai/prompts/tagImage'

import { SEED_CATEGORIES } from './categories'

const DIR = path.resolve(process.cwd(), 'seed/media-meta-archive')
const slugs = new Set(SEED_CATEGORIES.map((c) => c.key))
const files = existsSync(DIR)
  ? readdirSync(DIR).flatMap((cat) => readdirSync(path.join(DIR, cat)).map((f) => ({ cat, f, meta: JSON.parse(readFileSync(path.join(DIR, cat, f), 'utf8')) })))
  : []
// Same claim/cliché list as src/lib/content/content.test.ts, plus the watermark text.
const BANNED = [/eşsiz/i, /hayallerinizdeki/i, /kaliteden ödün/i, /en iyi hizmet/i, /mükemmel/i, /benzersiz/i, /\d+\s*(yıl|sene)/i, /\d+\s*years?/i, /garanti/i, /guarantee/i, /\bTL\b|₺|€|\$/, /sertifika/i, /certif/i, /ücretsiz/i, /\bfree\b/i, /yıllardır|onlarca yıl|otuz yıl|decades/i, /kusursuz|uzman ekibimiz|son teknoloji|A'dan Z'ye|fark yaratan|ayrıcalıklı|alanında lider|firmamız|şirketimiz/i, /kefken/i, /watermark|filigran/i]
// Words a sentence-case title may still capitalise mid-sentence: proper nouns that appear in this set.
const PROPER = /^(İroko|Iroko|Teak|İstanbul|Istanbul|Kefken|Şile|Riva)$/

// A timber species named in the text must be visible and tagged (tags.wood); trees in the scenery ("çamlar arasında",
// "pine trees", "çam ormanı", "pine trunk") are fine. (?<!\p{L}) / (?!\p{L}) act as Unicode word edges. "sedir" is left to
// the EN "cedar": in Turkish it is also a divan bench, a piece of garden furniture.
const SPECIES = /(?<!\p{L})(iroko|teak|tik|meşe|thermowood|ladin|oak|cedar|spruce|çam(?! ağa[çc]| orman| gövde)|pine(?! trees?| forest| grove| trunks?|-forest))(?!\p{L})/gu
// Wood tags are TR names, so an EN species counts as tagged by its TR name ("pine" by "emprenyeli çam").
const TR_SPECIES: Record<string, string> = { pine: 'çam', oak: 'meşe', spruce: 'ladin', cedar: 'sedir' }
const untaggedSpecies = (text: string, wood: string[]) =>
  // Lower-cased the Turkish way first: a regex /i flag does not fold "İ" to "i".
  [...text.toLocaleLowerCase('tr').matchAll(SPECIES)]
    .map((m) => m[1]!)
    .filter((w) => !wood.some((t) => [w, TR_SPECIES[w]].some((name) => name && t.toLocaleLowerCase('tr').includes(name))))

/** "Every Word Capitalised" is title case; sentence case leaves later words lower case (CONTENT-STYLE-TR §3). */
const isTitleCase = (s: string) => {
  const words = s.split(/\s+/).slice(1).filter((w) => /^\p{L}/u.test(w) && w.length > 3 && !PROPER.test(w))
  return words.length >= 2 && words.every((w) => w[0] === w[0]!.toLocaleUpperCase('tr'))
}

describe('isTitleCase', () => {
  it('flags Every Word Capitalised and passes sentence case', () => {
    expect(isTitleCase('Beyaz Boyalı Ahşap Dış Merdiven')).toBe(true)
    expect(isTitleCase('Beyaz boyalı ahşap dış merdiven')).toBe(false)
    expect(isTitleCase('Iroko deck beside a pool')).toBe(false)
  })
})

describe('untaggedSpecies', () => {
  it('flags an untagged species but not scenery trees', () => {
    expect(untaggedSpecies('İroko deck havuz kenarında', [])).toEqual(['iroko'])
    expect(untaggedSpecies('İroko deck havuz kenarında', ['iroko'])).toEqual([])
    expect(untaggedSpecies('Çamlar arasında ahşap köprü; çam ağaçlarının altında', [])).toEqual([])
    expect(untaggedSpecies('Deck among pines and pine trees', [])).toEqual([])
    expect(untaggedSpecies('Çam ormanında yürüyüş yolu, çam ağacının yanında; a deck around a pine trunk in a pine grove', [])).toEqual([])
  })

  it('accepts an EN species tagged by its TR name, and leaves the divan "sedir" to the EN text', () => {
    expect(untaggedSpecies('Pressure-treated pine posts', ['emprenyeli çam'])).toEqual([])
    expect(untaggedSpecies('Oak boards', ['çam'])).toEqual(['oak'])
    expect(untaggedSpecies('Terasta ahşap sedir', [])).toEqual([])
    expect(untaggedSpecies('Cedar cladding', [])).toEqual(['cedar'])
    expect(untaggedSpecies('Pine decking by a pool', [])).toEqual(['pine'])
  })
})

describe('archive media metadata', () => {
  it('exists for at least one photo', () => expect(files.length).toBeGreaterThan(0))

  it.each(files.map((x) => [`${x.cat}/${x.f}`, x] as const))('%s', (_, { cat, f, meta }) => {
    expect(slugs.has(cat)).toBe(true)
    expect(f).toBe(`${path.basename(meta.source)}.json`)
    expect(meta.source).toMatch(/^[^/]+\/[^/]+\.webp$/)
    expect(StoredTagImageSchema.safeParse(meta).success).toBe(true)
    expect(meta.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}/)
    for (const l of ['tr', 'en'] as const) {
      expect(isTitleCase(meta.title[l]), meta.title[l]).toBe(false)
      expect(meta.alt[l].length, meta.alt[l]).toBeLessThanOrEqual(125)
    }
    const text = JSON.stringify({ title: meta.title, alt: meta.alt, caption: meta.caption })
    for (const re of BANNED) expect(text, String(re)).not.toMatch(re)
    expect(untaggedSpecies(text, meta.tags.wood)).toEqual([])
  })

  it('uses each archive photo and SEO file name once', () => {
    expect(new Set(files.map((x) => x.meta.source)).size).toBe(files.length)
    expect(new Set(files.map((x) => x.meta.seoFilename)).size).toBe(files.length)
  })
})
