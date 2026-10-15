import { describe, expect, it } from 'vitest'

import { RESERVED_IDS, tableOfContents } from './toc'

const text = (t: string) => ({ type: 'text', text: t })
const h = (tag: string, ...children: unknown[]) => ({ type: 'heading', tag, children })
const p = (...children: unknown[]) => ({ type: 'paragraph', children })
const doc = (...children: unknown[]) => ({ root: { type: 'root', children } })

describe('tableOfContents', () => {
  it('lists H2s only, in order', () => {
    const body = doc(h('h2', text('Deck nedir?')), p(text('…')), h('h3', text('Alt başlık')), h('h2', text('Bakım ne zaman yapılır?')))
    expect(tableOfContents(body).items).toEqual([
      { id: 'deck-nedir', text: 'Deck nedir?' },
      { id: 'bakim-ne-zaman-yapilir', text: 'Bakım ne zaman yapılır?' },
    ])
  })

  it('joins text from nested link and formatted nodes', () => {
    const body = doc(h('h2', text('Hangi '), { type: 'link', children: [text('ahşap')] }, text(' seçilmeli?')))
    expect(tableOfContents(body).items).toEqual([{ id: 'hangi-ahsap-secilmeli', text: 'Hangi ahşap seçilmeli?' }])
  })

  it('maps Turkish capitals İ, I, Ş to ASCII ids', () => {
    expect(tableOfContents(doc(h('h2', text('İroko mu Teak mi? Işık ve Şekil')))).items[0]!.id).toBe('iroko-mu-teak-mi-isik-ve-sekil')
  })

  it('gives Arabic headings transliterated Latin ids (#156; they were bolum-N before slugify read Arabic)', () => {
    // Hand: م m, ا a | ا a, ل l, ف f, ر r, ق q; the Arabic question mark is a separator.
    expect(tableOfContents(doc(h('h2', text('ما الفرق؟')))).items[0]!.id).toBe('ma-alfrq')
  })

  it('suffixes duplicate headings so every anchor is unique', () => {
    const body = doc(h('h2', text('Fiyat?')), h('h2', text('Fiyat?')), h('h2', text('Fiyat?')))
    expect(tableOfContents(body).items.map((i) => i.id)).toEqual(['fiyat', 'fiyat-2', 'fiyat-3'])
  })

  it('skips empty headings and falls back for symbol-only text', () => {
    const body = doc(h('h2'), h('h2', text('   ')), h('h2', text('?')))
    expect(tableOfContents(body).items).toEqual([{ id: 'bolum-1', text: '?' }])
  })

  it('gives the renderer the same id for the same heading node', () => {
    const second = h('h2', text('Bakım?'))
    const body = doc(h('h2', text('Bakım?')), second, h('h3', text('x')))
    const toc = tableOfContents(body)
    expect(toc.idOf(second)).toBe('bakim-2')
    expect(toc.idOf(body.root.children[2])).toBeUndefined()
  })

  it('is empty for a missing or empty body', () => {
    expect(tableOfContents(null).items).toEqual([])
    expect(tableOfContents(undefined).items).toEqual([])
    expect(tableOfContents(doc()).items).toEqual([])
  })

  it('never reuses an id the page itself owns', () => {
    const body = doc(h('h2', text('FAQ')), h('h2', text('Main')))
    const ids = tableOfContents(body).items.map((i) => i.id)
    expect(ids).toEqual(['faq-2', 'main-2'])
    for (const id of ids) expect(RESERVED_IDS.has(id)).toBe(false)
  })

  it('stays unique when a heading text already looks like a suffixed id', () => {
    const body = doc(h('h2', text('Fiyat 2?')), h('h2', text('Fiyat?')), h('h2', text('Fiyat?')))
    expect(tableOfContents(body).items.map((i) => i.id)).toEqual(['fiyat-2', 'fiyat', 'fiyat-3'])
  })
})
