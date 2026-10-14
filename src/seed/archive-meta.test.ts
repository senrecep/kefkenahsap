// #65: the metadata written for the archive photos (seed/media-meta-archive) follows the tagImage schema and the style guide.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { TagImageSchema } from '@/ai/prompts/tagImage'

import { SEED_CATEGORIES } from './categories'

const DIR = path.resolve(process.cwd(), 'seed/media-meta-archive')
const slugs = new Set(SEED_CATEGORIES.map((c) => c.slug.tr))
const files = existsSync(DIR)
  ? readdirSync(DIR).flatMap((cat) => readdirSync(path.join(DIR, cat)).map((f) => ({ cat, f, meta: JSON.parse(readFileSync(path.join(DIR, cat, f), 'utf8')) })))
  : []
// Same claim/cliché list as src/lib/content/content.test.ts, plus the watermark text.
const BANNED = [/eşsiz/i, /hayallerinizdeki/i, /kaliteden ödün/i, /en iyi hizmet/i, /mükemmel/i, /benzersiz/i, /\d+\s*(yıl|sene)/i, /\d+\s*years?/i, /garanti/i, /guarantee/i, /\bTL\b|₺|€|\$/, /sertifika/i, /certif/i, /ücretsiz/i, /\bfree\b/i, /yıllardır|onlarca yıl|otuz yıl|decades/i, /kusursuz|uzman ekibimiz|son teknoloji|A'dan Z'ye|fark yaratan|ayrıcalıklı|alanında lider|firmamız|şirketimiz/i, /kefken/i, /watermark|filigran/i]
// Words a sentence-case title may still capitalise mid-sentence: proper nouns that appear in this set.
const PROPER = /^(İroko|Iroko|Teak|İstanbul|Istanbul|Kefken|Şile|Riva)$/

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

describe('archive media metadata', () => {
  it('exists for at least one photo', () => expect(files.length).toBeGreaterThan(0))

  it.each(files.map((x) => [`${x.cat}/${x.f}`, x] as const))('%s', (_, { cat, f, meta }) => {
    expect(slugs.has(cat)).toBe(true)
    expect(f).toBe(`${path.basename(meta.source)}.json`)
    expect(meta.source).toMatch(/^[^/]+\/[^/]+\.webp$/)
    expect(TagImageSchema.safeParse(meta).success).toBe(true)
    expect(meta.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}/)
    for (const l of ['tr', 'en'] as const) expect(isTitleCase(meta.title[l]), meta.title[l]).toBe(false)
    const text = JSON.stringify({ title: meta.title, alt: meta.alt, caption: meta.caption })
    for (const re of BANNED) expect(text, String(re)).not.toMatch(re)
  })

  it('uses each archive photo and SEO file name once', () => {
    expect(new Set(files.map((x) => x.meta.source)).size).toBe(files.length)
    expect(new Set(files.map((x) => x.meta.seoFilename)).size).toBe(files.length)
  })
})
