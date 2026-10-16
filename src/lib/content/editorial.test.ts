// #150: editorial picks — gallery tag mapping, homepage FAQ assembled from category FAQs, homepage layout fill.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { DEFAULT_SECTIONS } from '@/lib/home/sections'
import { SEED_CATEGORIES } from '@/seed/categories'

import { appendCategories, coverSwap, type Faq, fillHomepageLayout, resolveFaq, tagKeysFor, type TagDef, taxonomyTagDefs, type TaxonomyTag } from './editorial'
import { parseCategory, parseCategoryOverlay, parseEditorialPicks, parseEditorialTags, parseTagTranslations, parseTaxonomyV0 } from './schema'

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

// #156: a re-pick replaces only the previous pick; anything else on the page is an owner's choice.
describe('coverSwap', () => {
  it('writes while the cover is still the previous pick', () => {
    expect(coverSwap({ cover: 421 }, { cover: 421 }, 102)).toBe('write')
  })
  it('keeps a cover the owner changed, or cleared', () => {
    expect(coverSwap({ cover: 500 }, { cover: 421 }, 102)).toBe('kept')
    expect(coverSwap({ cover: null }, { cover: 421 }, 102)).toBe('kept')
  })
  it('is done once the new pick is in', () => {
    expect(coverSwap({ cover: 102 }, { cover: 421 }, 102)).toBe('done')
  })
  it('previous pick "no cover": writes only while the computed hero (first gallery photo) is still the seeded first photo', () => {
    expect(coverSwap({ cover: null, first: 257 }, { cover: null, first: 257 }, 275)).toBe('write')
    expect(coverSwap({ cover: null, first: 268 }, { cover: null, first: 257 }, 275)).toBe('kept')
    expect(coverSwap({ cover: null }, { cover: null, first: 257 }, 275)).toBe('kept')
    expect(coverSwap({ cover: 268, first: 257 }, { cover: null, first: 257 }, 275)).toBe('kept')
    expect(coverSwap({ cover: 275, first: 257 }, { cover: null, first: 257 }, 275)).toBe('done')
  })
})

describe('appendCategories', () => {
  it('appends while the list is exactly the seeded one', () => {
    expect(appendCategories([3], [3], [4, 6])).toEqual([3, 4, 6])
  })
  it('is done once appended, and keeps any other list', () => {
    expect(appendCategories([3, 4, 6], [3], [4, 6])).toBe('done')
    expect(appendCategories([3, 4], [3], [4, 6])).toBe('kept')
    expect(appendCategories([4, 3], [3, 4], [6])).toBe('kept')
    expect(appendCategories([], [3], [4])).toBe('kept')
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
  const { clusters } = JSON.parse(read('seed/clusters/clusters.json')) as { clusters: { key: string; category: string; seedKeys: string[] }[] }

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

  it('#156 swaps and category links agree with the seed they replace', () => {
    if (!picks.ok) throw new Error('picks.json')
    const { swaps, projectCategories } = picks.value
    const seo = (k: string) => (JSON.parse(read(`seed/media-meta/${k}.json`)) as { seoFilename: string }).seoFilename
    for (const s of [...Object.values(swaps.guideCovers), ...Object.values(swaps.categoryCovers), ...Object.values(swaps.projectCovers)])
      expect([s.to, seedKeys.has(s.to), s.from === null || seedKeys.has(s.from)]).toEqual([s.to, true, true])
    // Fresh databases get the new guide covers from the guide JSON (guides-finish.ts / content.ts) and the category cover from categoryCovers.
    for (const [file, s] of Object.entries(swaps.guideCovers)) expect((JSON.parse(read(`seed/content/guides/${file}.json`)) as { cover: string }).cover).toBe(seo(s.to))
    for (const [slug, s] of Object.entries(swaps.categoryCovers)) expect(picks.value.categoryCovers[slug]?.seedKey).toBe(s.to)
    for (const [key, s] of Object.entries(swaps.projectCovers)) {
      const c = clusters.find((x) => x.key === key)!
      expect([c.seedKeys[0], c.seedKeys.includes(s.to)]).toEqual([s.firstPhoto, true])
    }
    const slugs = SEED_CATEGORIES.map((c) => c.slug.tr)
    for (const [key, l] of Object.entries(projectCategories)) {
      expect(l.from).toEqual([clusters.find((x) => x.key === key)!.category])
      expect(l.add.every((s) => slugs.includes(s) && !l.from.includes(s))).toBe(true)
    }
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

// #171: the taxonomy v0 tags to load (scripts/seed/tags-type-axis.ts).
describe('taxonomyTagDefs', () => {
  const v0 = (axis: TaxonomyTag['axis'], s: string, status?: string): TaxonomyTag => ({ axis, status, name: { tr: `${s} tr`, en: `${s} en` }, slug: { tr: s, en: `${s}-en` } })
  const tr = (s: string) => ({ ru: [`${s} ru`, `${s}-ru`] as [string, string], de: [`${s} de`, `${s}-de`] as [string, string], ar: [`${s} ar`, `${s}-ar`] as [string, string] })
  const tags = [v0('type', 'pergola'), v0('setting', 'ticari', 'new'), v0('setting', 'giris', 'new'), v0('setting', 'orman', 'new'), v0('setting', 'bahce', 'existing'), v0('finish', 'lake', 'new'), v0('stage', 'atolye', 'new'), v0('wood', 'iroko', 'existing')]
  const all = Object.fromEntries(['pergola', 'ticari', 'giris', 'orman', 'bahce', 'lake', 'atolye', 'iroko'].map((s) => [s, tr(s)]))

  it('takes every product type, the approved new settings (ticari, giris) and the new finishes', () => {
    const r = taxonomyTagDefs(tags, all)
    expect(r.ok && r.value.map((d) => `${d.axis}:${d.slug.tr}`)).toEqual(['type:pergola', 'setting:ticari', 'setting:giris', 'finish:lake'])
  })

  it('names and slugs each tag in all five locales: tr/en from v0, ru/de/ar from the translation table', () => {
    const r = taxonomyTagDefs([v0('type', 'pergola')], all)
    expect(r.ok && r.value[0]).toEqual({
      axis: 'type',
      name: { tr: 'pergola tr', en: 'pergola en', ru: 'pergola ru', de: 'pergola de', ar: 'pergola ar' },
      slug: { tr: 'pergola', en: 'pergola-en', ru: 'pergola-ru', de: 'pergola-de', ar: 'pergola-ar' },
    })
  })

  it('fails on a loaded tag without translations, naming it', () => {
    const r = taxonomyTagDefs([v0('type', 'pergola'), v0('type', 'bank')], all)
    expect(!r.ok && r.errors[0]?.description).toContain('bank')
  })

  it('the committed translation table covers what v0 loads', () => {
    const v0File = path.resolve(process.cwd(), '../../image-work/taxonomy/v0.json')
    const table = parseTagTranslations(readFileSync(path.resolve(process.cwd(), 'seed/editorial/tags-type-axis.json'), 'utf8'))
    expect(table.ok).toBe(true)
    // v0 lives outside the repo (image-work/); only checked where it is present.
    if (!table.ok || !existsSync(v0File)) return
    const taxonomy = parseTaxonomyV0(readFileSync(v0File, 'utf8'))
    const r = taxonomy.ok ? taxonomyTagDefs(taxonomy.value.tags, table.value.tags) : taxonomy
    expect(r.ok && r.value.length).toBe(52)
  })
})
