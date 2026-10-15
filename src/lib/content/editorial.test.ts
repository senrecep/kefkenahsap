// #150: editorial picks — gallery tag mapping, homepage FAQ assembled from category FAQs, homepage layout fill.
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { DEFAULT_SECTIONS } from '@/lib/home/sections'
import { SEED_CATEGORIES } from '@/seed/categories'

import { type Faq, fillHomepageLayout, resolveFaq, tagKeysFor, type TagDef } from './editorial'
import { parseCategory, parseCategoryOverlay, parseEditorialPicks, parseEditorialTags } from './schema'

const names = (n: string) => ({ tr: n, en: n, ru: n, de: n, ar: n })
const slugs = (s: string) => ({ tr: s, en: s, ru: s, de: s, ar: s })
const DEFS: TagDef[] = [
  { key: 'iroko', axis: 'wood', name: names('İroko'), slug: slugs('iroko'), raw: ['iroko'] },
  { key: 'cam', axis: 'wood', name: names('Çam'), slug: slugs('cam'), raw: ['çam'] },
  { key: 'emprenyeli-cam', axis: 'wood', name: names('Emprenyeli çam'), slug: slugs('emprenyeli-cam'), raw: ['emprenyeli çam'] },
  { key: 'bahce', axis: 'setting', name: names('Bahçe'), slug: slugs('bahce'), raw: ['bahçe', 'villa bahçesi', 'garden'] },
  { key: 'detay', axis: 'stage', name: names('Detay'), slug: slugs('detay'), raw: ['detail'] },
]

describe('tagKeysFor', () => {
  it('maps raw per-image tags to canonical tag keys, once each, in definition order', () => {
    expect(tagKeysFor(DEFS, { wood: ['iroko'], setting: ['villa bahçesi', 'bahçe', 'teras'], stage: ['finished', 'detail'] })).toEqual(['iroko', 'bahce', 'detay'])
  })

  it('keeps pine and pressure-treated pine apart', () => {
    expect(tagKeysFor(DEFS, { wood: ['emprenyeli çam'] })).toEqual(['emprenyeli-cam'])
    expect(tagKeysFor(DEFS, { wood: ['çam'] })).toEqual(['cam'])
  })

  it('ignores case and surrounding spaces, but only on the tag’s own axis', () => {
    expect(tagKeysFor(DEFS, { setting: [' Garden '] })).toEqual(['bahce'])
    expect(tagKeysFor(DEFS, { finish: ['iroko'], setting: ['detail'] })).toEqual([])
  })

  it('drops unmapped values and missing axes', () => {
    expect(tagKeysFor(DEFS, {})).toEqual([])
    expect(tagKeysFor(DEFS, { wood: ['OSB'], stage: ['finished'] })).toEqual([])
  })
})

const deckTr = [
  { q: 'Çam mı iroko mu?', a: 'Bütçe belirler.' },
  { q: 'Toprağa olur mu?', a: 'Evet.' },
]
const sources = {
  tr: { 'deck-ve-zeminler': deckTr, merdivenler: [{ q: 'Altı kullanılır mı?', a: 'Evet.' }] },
  en: { 'deck-ve-zeminler': [{ q: 'Pine or iroko?', a: 'Budget decides.' }, { q: 'On soil?', a: 'Yes.' }], merdivenler: [{ q: 'Under the stairs?', a: 'Yes.' }] },
}

describe('resolveFaq', () => {
  it('takes each referenced category FAQ verbatim, in reference order, per locale', () => {
    const r = resolveFaq(
      [
        { category: 'merdivenler', index: 0 },
        { category: 'deck-ve-zeminler', index: 1 },
      ],
      sources,
    )
    expect(r.ok && r.value).toEqual({
      tr: [
        { q: 'Altı kullanılır mı?', a: 'Evet.' },
        { q: 'Toprağa olur mu?', a: 'Evet.' },
      ],
      en: [
        { q: 'Under the stairs?', a: 'Yes.' },
        { q: 'On soil?', a: 'Yes.' },
      ],
    })
  })

  it('fails on a reference that does not exist', () => {
    const r = resolveFaq([{ category: 'deck-ve-zeminler', index: 2 }], sources)
    expect(r.ok).toBe(false)
    expect(!r.ok && r.errors[0]?.code).toBe('Editorial.UnknownFaq')
  })

  it('fails when a locale’s FAQ for that category is not aligned with TR (index would point at another question)', () => {
    const r = resolveFaq([{ category: 'deck-ve-zeminler', index: 0 }], { ...sources, ru: { 'deck-ve-zeminler': [{ q: 'Сосна?', a: 'Да.' }] } })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.errors[0]?.code).toBe('Editorial.FaqMisaligned')
    expect(!r.ok && r.errors[0]?.description).toContain('ru')
  })
})

describe('fillHomepageLayout', () => {
  const items = [{ q: 'S', a: 'C' }]

  it('builds every default section in order on an empty homepage, with the hero photos and the FAQ', () => {
    const r = fillHomepageLayout([], { image: 1401, mobileImage: 1403, faq: items })
    expect(r.layout.map((b) => b.blockType)).toEqual([...DEFAULT_SECTIONS])
    expect(r.layout[0]).toEqual({ blockType: 'hero', image: 1401, mobileImage: 1403 })
    expect(r.layout.find((b) => b.blockType === 'faq')).toEqual({ blockType: 'faq', items })
    expect(r.filled).toEqual(['layout'])
  })

  it('fills only the empty fields of the existing hero and FAQ blocks, keeping the admin’s blocks and order', () => {
    const current = [
      { id: 'a', blockType: 'faq', enabled: true, items: [] },
      { id: 'b', blockType: 'hero', image: null, mobileImage: null, heading: 'Kendi başlığım' },
      { id: 'c', blockType: 'contact' },
    ]
    const r = fillHomepageLayout(current, { image: 1401, mobileImage: 1403, faq: items })
    expect(r.layout).toEqual([
      { id: 'a', blockType: 'faq', enabled: true, items },
      { id: 'b', blockType: 'hero', image: 1401, mobileImage: 1403, heading: 'Kendi başlığım' },
      { id: 'c', blockType: 'contact' },
    ])
    expect(r.filled).toEqual(['faq.items', 'hero.image', 'hero.mobileImage'])
  })

  it('leaves the phone photo empty when the admin chose another hero photo (it would not match)', () => {
    const current = [{ id: 'b', blockType: 'hero', image: 7, mobileImage: null }]
    expect(fillHomepageLayout(current, { image: 1401, mobileImage: 1403, faq: items }).filled).toEqual([])
  })

  it('fills the phone photo next to the picked hero photo, also when that arrives populated', () => {
    const current = [{ id: 'b', blockType: 'hero', image: { id: 1401 }, mobileImage: null }]
    expect(fillHomepageLayout(current, { image: 1401, mobileImage: 1403, faq: items })).toEqual({
      layout: [{ id: 'b', blockType: 'hero', image: { id: 1401 }, mobileImage: 1403 }],
      filled: ['hero.mobileImage'],
    })
  })

  it('changes nothing when the hero and FAQ are already filled, or when the admin removed those blocks', () => {
    const full = [
      { id: 'b', blockType: 'hero', image: { id: 7 }, mobileImage: 8 },
      { id: 'a', blockType: 'faq', items: [{ id: 'x', q: 'Q', a: 'A' }] },
    ]
    expect(fillHomepageLayout(full, { image: 1401, mobileImage: 1403, faq: items })).toEqual({ layout: full, filled: [] })
    expect(fillHomepageLayout([{ blockType: 'services' }], { image: 1401, faq: items }).filled).toEqual([])
  })

  it('fills only the FAQ for a locale write (no photos given)', () => {
    const current = [{ id: 'b', blockType: 'hero', image: 1401 }, { id: 'a', blockType: 'faq', items: null }]
    expect(fillHomepageLayout(current, { faq: items }).filled).toEqual(['faq.items'])
  })
})

// The committed picks and tag table (seed/editorial/*.json) against the committed seed.
describe('seed/editorial', () => {
  const read = (p: string) => readFileSync(path.resolve(process.cwd(), p), 'utf8')
  const picks = parseEditorialPicks(read('seed/editorial/picks.json'))
  const tags = parseEditorialTags(read('seed/editorial/tags.json'))
  const metaDir = path.resolve(process.cwd(), 'seed/media-meta')
  const metas = readdirSync(metaDir, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ seedKey: f.split(path.sep).join('/').slice(0, -'.json'.length), tags: JSON.parse(readFileSync(path.join(metaDir, f), 'utf8')).tags ?? {} }))
  const seedKeys = new Set(metas.map((m) => m.seedKey))
  const { clusters } = JSON.parse(read('seed/clusters/clusters.json')) as { clusters: { key: string; seedKeys: string[] }[] }

  it('parse', () => {
    expect(picks.ok).toBe(true)
    expect(tags.ok).toBe(true)
  })

  it('every tag is on at least 5 approved photos', () => {
    if (!tags.ok) throw new Error('tags.json')
    for (const def of tags.value.tags) expect([def.key, metas.filter((m) => tagKeysFor([def], m.tags).length).length >= 5]).toEqual([def.key, true])
  })

  it('every picked photo is a seeded photo of the right category or project', () => {
    if (!picks.ok) throw new Error('picks.json')
    const p = picks.value
    for (const k of [p.hero.seedKey, p.mobileHero.seedKey]) expect(seedKeys.has(k)).toBe(true)
    for (const [slug, c] of Object.entries(p.categoryCovers)) expect(c.seedKey.startsWith(`${slug}/`) && seedKeys.has(c.seedKey)).toBe(true)
    expect(Object.keys(p.categoryCovers).sort()).toEqual(SEED_CATEGORIES.map((c) => c.slug.tr).sort())
    for (const f of p.featuredProjects) expect(clusters.find((c) => c.key === f.cluster)?.seedKeys).toContain(f.cover)
  })

  it('uses every photo at most once', () => {
    if (!picks.ok) throw new Error('picks.json')
    const p = picks.value
    const all = [p.hero.seedKey, p.mobileHero.seedKey, ...p.featuredProjects.map((f) => f.cover), ...Object.values(p.categoryCovers).map((c) => c.seedKey)]
    expect(all.length).toBe(new Set(all).size)
  })

  it('the homepage FAQ resolves in every locale with an overlay', () => {
    if (!picks.ok) throw new Error('picks.json')
    const sources: Record<string, Record<string, Faq[]>> = { tr: {}, en: {} }
    for (const { category } of picks.value.faq) {
      const c = parseCategory(read(`seed/content/categories/${category}.json`))
      if (!c.ok) throw new Error(category)
      sources.tr![category] = c.value.tr.faq
      sources.en![category] = c.value.en.faq
      for (const l of ['ru', 'de', 'ar']) {
        const o = parseCategoryOverlay(read(`seed/i18n/${l}/content/categories/${category}.json`))
        if (!o.ok) throw new Error(`${l}/${category}`)
        sources[l] = { ...sources[l], [category]: o.value.faq }
      }
    }
    const r = resolveFaq(picks.value.faq, sources)
    expect(r.ok && Object.values(r.value).map((items) => items.length)).toEqual([6, 6, 6, 6, 6])
  })
})
