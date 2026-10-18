// #223: the owner's 2026-10-18 answers: the rule engine, and the committed seed already carrying them in every locale.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { routing } from '@/i18n/routing'
import { SEED_CATEGORIES } from '@/seed/categories'

import { applyTextRules, joinedText, OWNER_ANSWER_RULES, REMOVED_CLAIMS, type TextRule } from './owner-answers'

const text = (t: string) => ({ type: 'text', text: t, format: 0, version: 1 })
const item = (t: string) => ({ type: 'listitem', children: [text(t)], version: 1 })
const tr = (old: string, next: string, whole?: boolean): TextRule => ({ locale: 'tr', old, new: next, ...(whole ? { whole } : {}) })

describe('applyTextRules', () => {
  it('replaces inside a string and reports the rule', () => {
    const r = applyTextRules('Yatay çıtalı seperatörler', [tr('seperatör', 'separatör')])
    expect(r.value).toBe('Yatay çıtalı separatörler')
    expect([...r.hits]).toEqual([0])
  })

  it('removes a whole list item, not a longer text that contains it', () => {
    const list = { type: 'list', children: [item('Mutfak dolapları'), item('Toplantı masaları'), item('Toplantı masaları ve sandalyeler')] }
    const r = applyTextRules(list, [tr('Toplantı masaları', '', true)])
    expect(r.value.children.map((c) => c.children[0].text)).toEqual(['Mutfak dolapları', 'Toplantı masaları ve sandalyeler'])
  })

  it('keeps a paragraph that was already empty', () => {
    const root = { root: { children: [{ type: 'paragraph', children: [] }, { type: 'paragraph', children: [text('Seperatör')] }] } }
    expect(applyTextRules(root, [tr('Seperatör', 'Separatör')]).value.root.children).toHaveLength(2)
  })

  it('removes a sentence from a FAQ answer and keeps the row id', () => {
    const faq = [{ id: 'a1', q: 'Kayar mı?', a: 'Temiz tutun. İstenirse kaydırmaz detay eklenir.' }]
    expect(applyTextRules(faq, [tr(' İstenirse kaydırmaz detay eklenir.', '')]).value).toEqual([{ id: 'a1', q: 'Kayar mı?', a: 'Temiz tutun.' }])
  })

  it('extends a sentence once: a second run changes nothing', () => {
    const rules = [tr('Ev temele oturur.', 'Ev temele oturur. Beton temeli biz ayarlarız.')]
    const once = applyTextRules('Ev temele oturur. Sonra çatı.', rules)
    expect(once.value).toBe('Ev temele oturur. Beton temeli biz ayarlarız. Sonra çatı.')
    const twice = applyTextRules(once.value, rules)
    expect(twice.value).toBe(once.value)
    expect(twice.hits.size).toBe(0)
  })

  it('returns the same object when nothing matches', () => {
    const doc = { title: 'Pergola', faq: [{ q: 'a', a: 'b' }] }
    expect(applyTextRules(doc, [tr('Seperatör', 'Separatör')]).value).toBe(doc)
  })

  it('joinedText finds a sentence split across formatting nodes', () => {
    const p = { type: 'paragraph', children: [text('Garaj '), { ...text('kapısı'), format: 1 }, text(' yapıyoruz.')] }
    expect(joinedText(p)).toContain('Garaj kapısı yapıyoruz.')
  })
})

// Every string in the committed seed for a locale: seed/content (tr, en) or seed/i18n/<locale>/content.
const SEED = path.resolve(process.cwd(), 'seed')
const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(path.join(dir, f)).isDirectory() ? files(path.join(dir, f)) : [path.join(dir, f)]))
const strings = (v: unknown): string[] => (typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : [])
const seedTexts = (locale: string): string[] => {
  if (locale === 'tr' || locale === 'en')
    return files(path.join(SEED, 'content')).flatMap((f) => {
      const json = JSON.parse(readFileSync(f, 'utf8')) as unknown
      // tr/en files keep both locales side by side ({ tr: …, en: … }); project-stories and references are keyed per item.
      const pick = (o: unknown): unknown => (o && typeof o === 'object' && locale in o ? (o as Record<string, unknown>)[locale] : o && typeof o === 'object' ? Object.values(o).map(pick) : undefined)
      return strings(pick(json))
    })
  return files(path.join(SEED, 'i18n', locale, 'content')).flatMap((f) => strings(JSON.parse(readFileSync(f, 'utf8'))))
}

describe.each(routing.locales)('%s seed carries the owner answers', (locale) => {
  const texts = seedTexts(locale)
  const all = texts.join('\n')
  const rules = OWNER_ANSWER_RULES.filter((r) => r.locale === locale)

  it('has rules for this locale', () => expect(rules.length).toBeGreaterThan(0))

  it.each(rules.map((r) => [r.old.slice(0, 60), r] as const))('%s', (_, rule) => {
    if (rule.new) expect(all).toContain(rule.new)
    if (rule.whole) expect(texts.some((t) => t.split('\n').some((line) => line.replace(/^- /, '') === rule.old))).toBe(false)
    else if (!rule.new.includes(rule.old)) expect(all).not.toContain(rule.old)
  })

  it('a run of the rules over the seed changes nothing', () => {
    expect(applyTextRules(texts, rules).hits.size).toBe(0)
  })

  it('makes none of the removed claims (content and UI messages)', () => {
    const messages = files(path.resolve(process.cwd(), 'messages', locale)).map((f) => readFileSync(f, 'utf8'))
    for (const re of REMOVED_CLAIMS[locale]) for (const t of [all, ...messages]) expect(t, String(re)).not.toMatch(re)
  })
})

describe('TR spells the category "Separatör"', () => {
  it('category name, content, tag and photo texts', () => {
    const tagTaxonomy = readFileSync(path.join(SEED, 'editorial/taxonomy-v0.json'), 'utf8')
    const photoTexts = ['media-meta', 'media-meta-archive'].flatMap((d) =>
      files(path.join(SEED, d)).flatMap((f) => {
        const m = JSON.parse(readFileSync(f, 'utf8')) as { title?: { tr?: string }; alt?: { tr?: string }; caption?: { tr?: string }; tags?: unknown }
        return [m.title?.tr, m.alt?.tr, m.caption?.tr, ...strings(m.tags)]
      }),
    )
    for (const t of [...seedTexts('tr'), ...SEED_CATEGORIES.map((c) => c.name.tr), tagTaxonomy, ...photoTexts]) expect(t ?? '').not.toMatch(/seperatör/i)
    expect(SEED_CATEGORIES.find((c) => c.slug.tr === 'kapi-dolap-ve-seperator')?.name.tr).toBe('Kapı, Dolap ve Separatör')
  })
})
