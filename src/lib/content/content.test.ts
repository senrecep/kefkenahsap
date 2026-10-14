// Guards the committed seed content (seed/content/**) against the §7 rules and the "no invented claims" rule.
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { SEED_CATEGORIES } from '@/seed/categories'

import { parseCategory, parseGuide, parsePage, parseReferences, wordCount } from './schema'

const DIR = path.resolve(process.cwd(), 'seed/content')
const read = (p: string) => readFileSync(path.join(DIR, p), 'utf8')

// docs/CONTENT-STYLE-TR.md §5 banned list (clichés) + claims PRODUCT.md says must come only from the admin.
const BANNED = [/eşsiz/i, /hayallerinizdeki/i, /kaliteden ödün/i, /en iyi hizmet/i, /mükemmel/i, /benzersiz/i, /\d+\s*(yıl|sene)/i, /\d+\s*years?/i, /garanti/i, /guarantee/i, /\bTL\b|₺|€|\$/, /sertifika/i, /certif/i, /ücretsiz/i, /\bfree\b/i, /yıllardır|onlarca yıl|otuz yıl|decades/i, /kusursuz|uzman ekibimiz|son teknoloji|A'dan Z'ye|fark yaratan|ayrıcalıklı|alanında lider|firmamız|şirketimiz/i]
const textOf = (o: unknown) => JSON.stringify(o)

describe('wordCount', () => {
  it('counts words, not markdown syntax', () => {
    expect(wordCount('## Deck nedir?\n\nAhşap bir zemin.\n\n- iroko\n- teak')).toBe(7)
  })
})

describe('category content', () => {
  it('has one file per seed category', () => {
    const files = readdirSync(path.join(DIR, 'categories')).sort()
    expect(files).toEqual(SEED_CATEGORIES.map((c) => `${c.slug.tr}.json`).sort())
  })

  describe.each(SEED_CATEGORIES.map((c) => c.slug.tr))('%s', (slug) => {
    const cat = parseCategory(read(`categories/${slug}.json`))

    it('parses', () => expect(cat.ok).toBe(true))

    describe.each(['tr', 'en'] as const)('%s', (locale) => {
      const c = cat.ok ? cat.value[locale] : undefined
      it('body is 300–600 words with question H2s', () => {
        const n = wordCount(c!.body)
        expect(n).toBeGreaterThanOrEqual(300)
        expect(n).toBeLessThanOrEqual(600)
        const h2 = c!.body.split('\n').filter((l) => l.startsWith('## '))
        expect(h2.length).toBeGreaterThanOrEqual(3)
        for (const h of h2) expect(h.trimEnd().endsWith('?'), h).toBe(true)
      })
      it('short description is one answer-first sentence', () => {
        expect(c!.shortDesc.split(/[.!?](\s|$)/).filter((s) => s.trim()).length).toBe(1)
      })
      it('has 4–6 FAQ items', () => {
        expect(c!.faq.length).toBeGreaterThanOrEqual(4)
        expect(c!.faq.length).toBeLessThanOrEqual(6)
      })
      it('makes no banned claims or clichés', () => {
        for (const re of BANNED) expect(textOf(c), String(re)).not.toMatch(re)
      })
    })
  })
})

describe('pages', () => {
  it.each(['hakkimizda', 'iletisim'])('%s parses and makes no banned claims', (slug) => {
    const page = parsePage(read(`pages/${slug}.json`))
    expect(page.ok).toBe(true)
    // 2009 is the confirmed founding year; any other number+year phrase is an invented claim.
    for (const re of BANNED) expect(textOf(page.ok && page.value).replace(/2009/g, ''), String(re)).not.toMatch(re)
  })
})

describe('references', () => {
  // The 9 legacy references (docs/legacy/crawl-md/*referanslar*), spelled as in PRODUCT.md / decisions.md.
  it('lists the 9 legacy references in order', () => {
    const refs = parseReferences(read('references.json'))
    expect(refs.ok && refs.value.map((r) => r.name)).toEqual([
      'Cennetköy Sitesi',
      'Riva Konakları Sitesi',
      'Kemer Golf & Country Club',
      'Neo Gölpark Evleri',
      'İBB Sosyal Tesisler',
      'Mesa Mesken',
      'Nurol A.Ş.',
      'Yaşar Holding',
      'İGK',
    ])
  })
})

describe('guides (#49)', () => {
  const files = readdirSync(path.join(DIR, 'guides')).sort()
  const guides = files.map((f) => ({ file: f, g: parseGuide(read(`guides/${f}`)) }))
  const slugs = { tr: new Set<string>(), en: new Set<string>() }
  for (const { g } of guides) if (g.ok) for (const l of ['tr', 'en'] as const) slugs[l].add(g.value[l].slug)
  const categorySlugs = { tr: new Set(SEED_CATEGORIES.map((c) => c.slug.tr)), en: new Set(SEED_CATEGORIES.map((c) => c.slug.en)) }
  // Old "ağaç yaşı" content stays out (decisions #3, #57); the price guide explains factors only (PLAN §7).
  const EXTRA = [/ağaç(ların)?\s+yaşı|yaş\s+halka|yıllık\s+halka|dendrokronoloji|tree\s+age|growth\s+ring/i, /\d[\d.,]*\s*(lira|euro|dolar|dollar)/i]

  it('has the 3–4 launch guides', () => expect(files.length).toBeGreaterThanOrEqual(3))

  // #58 F2 guides: a fuller brief than the launch guides — TR body 550–800 words, 4–6 FAQ items per locale.
  it.each(['emprenyeli-ahsap-nedir', 'havuz-kenari-deck', 'korkuluk-ahsap-mi-metal-mi', 'pergola-mi-kamelya-mi', 'thermowood-nedir'])('%s meets the #58 brief', (name) => {
    const g = guides.find((x) => x.file === `${name}.json`)?.g
    expect(g?.ok, name).toBe(true)
    if (!g?.ok) return
    const n = wordCount(g.value.tr.body)
    expect(n).toBeGreaterThanOrEqual(550)
    expect(n).toBeLessThanOrEqual(800)
    for (const l of ['tr', 'en'] as const) {
      expect(g.value[l].faq.length).toBeGreaterThanOrEqual(4)
      expect(g.value[l].faq.length).toBeLessThanOrEqual(6)
    }
  })

  describe.each(files)('%s', (file) => {
    const g = guides.find((x) => x.file === file)!.g
    it('parses, and related categories exist', () => {
      expect(g.ok).toBe(true)
      for (const c of g.ok ? g.value.relatedCategories : []) expect(categorySlugs.tr.has(c), c).toBe(true)
    })

    describe.each(['tr', 'en'] as const)('%s', (locale) => {
      const c = g.ok ? g.value[locale] : undefined
      it('answers first: excerpt ≤150 words', () => expect(wordCount(c!.excerpt)).toBeLessThanOrEqual(150))
      it('has ≥3 H2s and all are questions', () => {
        const h2 = c!.body.split('\n').filter((l) => l.startsWith('## '))
        expect(h2.length).toBeGreaterThanOrEqual(3)
        for (const h of h2) expect(h.trimEnd().endsWith('?'), h).toBe(true)
      })
      it('has 3–6 FAQ items', () => {
        expect(c!.faq.length).toBeGreaterThanOrEqual(3)
        expect(c!.faq.length).toBeLessThanOrEqual(6)
      })
      it('makes no banned claims, prices or tree-age content', () => {
        for (const re of [...BANNED, ...EXTRA]) expect(textOf(c), String(re)).not.toMatch(re)
      })
      it('links only to guides and categories that exist', () => {
        const base = locale === 'tr' ? 'rehber' : 'guides'
        for (const [, href] of c!.body.matchAll(/\]\((\/[^)]+)\)/g)) {
          const [, l, a, b] = href!.split('/')
          expect(l, href).toBe(locale)
          if (b) expect(a === base && slugs[locale].has(b), href).toBe(true)
          else expect(categorySlugs[locale].has(a!), href).toBe(true)
        }
      })
    })
  })
})
