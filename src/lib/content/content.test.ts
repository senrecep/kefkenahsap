// Guards the committed seed content (seed/content/**) against the §7 rules and the "no invented claims" rule.
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { SEED_CATEGORIES } from '@/seed/categories'

import { parseCategory, parsePage, parseReferences, wordCount } from './schema'

const DIR = path.resolve(process.cwd(), 'seed/content')
const read = (p: string) => readFileSync(path.join(DIR, p), 'utf8')

// docs/AI-PROMPTS.md clichés + claims PRODUCT.md says must come only from the admin.
const BANNED = [/eşsiz/i, /hayallerinizdeki/i, /kaliteden ödün/i, /en iyi hizmet/i, /mükemmel/i, /benzersiz/i, /\d+\s*(yıl|sene)/i, /\d+\s*years?/i, /garanti/i, /guarantee/i, /\bTL\b|₺|€|\$/, /sertifika/i, /certif/i, /ücretsiz/i, /\bfree\b/i]
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
  // Verbatim from docs/legacy/crawl-md/*referanslar* (typos included; the owner confirms spelling in the admin).
  it('lists the 9 legacy references in order', () => {
    const refs = parseReferences(read('references.json'))
    expect(refs.ok && refs.value.map((r) => r.name)).toEqual([
      'Cennetköy Sitesi',
      'Riva Konakları Sitesi',
      'Kemer Golf & Contry Clup',
      'Neo Gölpark Evleri',
      'İ.B.B Sosyal Tesisler',
      'Mesa Mesken',
      'Nurol A.S',
      'Yaşar Holding',
      'İ.G.K',
    ])
  })
})
