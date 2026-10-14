import { describe, expect, it } from 'vitest'

import { applySegments, collectSegments, isMissing, TRANSLATE_SPECS } from './segments'

const text = (t: string, format = 0) => ({ mode: 'normal', text: t, type: 'text', style: '', detail: 0, format, version: 1 })
// Shaped like the seed guides: heading, paragraph with bold + link, list, a line break, a table cell.
const body = {
  root: {
    type: 'root', format: '', indent: 0, version: 1, direction: null,
    children: [
      { tag: 'h2', type: 'heading', format: '', indent: 0, version: 1, direction: null, children: [text("Deck'e ne zaman bakım gerekir?")] },
      {
        type: 'paragraph', format: '', indent: 0, version: 1, direction: null, textFormat: 0,
        children: [
          text('Emprenyeli çam '),
          text('her yıl', 1),
          { type: 'linebreak', version: 1 },
          { type: 'link', version: 1, fields: { url: '/tr/deck', newTab: false, linkType: 'custom' }, children: [text('deck sayfası')] },
          text('   '),
        ],
      },
      { tag: 'ul', type: 'list', start: 1, listType: 'bullet', version: 1, children: [{ type: 'listitem', value: 1, version: 1, children: [text('Kamelya')] }] },
      { type: 'table', version: 1, children: [{ type: 'tablerow', version: 1, children: [{ type: 'tablecell', headerState: 1, version: 1, children: [{ type: 'paragraph', version: 1, children: [text('Iroko')] }] }] }] },
    ],
  },
}

const guideTr = {
  title: 'Deck bakımı',
  excerpt: 'Yılda bir kez yağlayın.',
  body,
  faq: [{ id: 'tr-1', q: 'Ne sıklıkla?', a: 'Yılda bir.' }],
  seo: { title: 'Deck bakımı rehberi', description: null },
}

/** The structure with every text value blanked: what translation must never change. */
const skeleton = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(skeleton) : v && typeof v === 'object'
    ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'text' ? '<t>' : skeleton(x)]))
    : v

describe('translate segments: only Lexical text nodes and plain text fields go to the model', () => {
  it('collects each non-blank text node in document order plus the empty-target plain fields', () => {
    const segs = collectSegments(guideTr, {}, TRANSLATE_SPECS.guides)
    expect(segs.map((s) => s.text)).toEqual([
      'Deck bakımı',
      'Yılda bir kez yağlayın.',
      'Deck bakımı rehberi',
      "Deck'e ne zaman bakım gerekir?",
      'Emprenyeli çam ',
      'her yıl',
      'deck sayfası',
      'Kamelya',
      'Iroko',
      'Ne sıklıkla?',
      'Yılda bir.',
    ])
    expect(new Set(segs.map((s) => s.id)).size).toBe(segs.length)
  })

  it('never re-translates a field the target locale already has (human text wins)', () => {
    const segs = collectSegments(guideTr, { excerpt: 'Oil it once a year.', seo: { title: 'Deck care' } }, TRANSLATE_SPECS.guides)
    expect(segs.map((s) => s.text)).not.toContain('Yılda bir kez yağlayın.')
    expect(segs.map((s) => s.text)).not.toContain('Deck bakımı rehberi')
    expect(segs.map((s) => s.text)).toContain('Deck bakımı')
  })

  it('rebuilds the Lexical JSON exactly: same nodes, formats, link fields; only text values change', () => {
    const segs = collectSegments(guideTr, {}, TRANSLATE_SPECS.guides)
    const out = Object.fromEntries(segs.map((s) => [s.id, `EN:${s.text}`]))
    const data = applySegments(guideTr, {}, TRANSLATE_SPECS.guides, out)
    expect(skeleton(data.body)).toEqual(skeleton(body))
    const json = JSON.stringify(data.body)
    expect(json).toContain('"text":"EN:Kamelya"')
    expect(json).toContain('"text":"EN:her yıl","type":"text","style":"","detail":0,"format":1')
    expect(json).toContain('"url":"/tr/deck"') // link targets are not text: untouched
    expect(json).toContain('"text":"   "') // whitespace-only nodes are kept, not sent
    expect(body.root.children[2]!.children[0]).toEqual({ type: 'listitem', value: 1, version: 1, children: [text('Kamelya')] }) // source not mutated
  })

  it('fills plain fields, groups (keeping the target group’s other values) and arrays (new row ids)', () => {
    const segs = collectSegments(guideTr, { seo: { description: 'Kept', title: null } }, TRANSLATE_SPECS.guides)
    const out = Object.fromEntries(segs.map((s) => [s.id, `EN:${s.text}`]))
    const data = applySegments(guideTr, { seo: { description: 'Kept', title: null } }, TRANSLATE_SPECS.guides, out)
    expect(data.title).toBe('EN:Deck bakımı')
    expect(data.seo).toEqual({ description: 'Kept', title: 'EN:Deck bakımı rehberi' })
    expect(data.faq).toEqual([{ q: 'EN:Ne sıklıkla?', a: 'EN:Yılda bir.' }])
  })

  it('a target locale is missing when its title (categories: name) is empty', () => {
    expect(isMissing({ title: '' }, TRANSLATE_SPECS.guides)).toBe(true)
    expect(isMissing({ title: 'Deck care' }, TRANSLATE_SPECS.guides)).toBe(false)
    expect(isMissing({ name: null }, TRANSLATE_SPECS.categories)).toBe(true)
    expect(isMissing(null, TRANSLATE_SPECS.pages)).toBe(true)
  })

  it('an empty Lexical value on the target counts as empty (editor leaves an empty paragraph)', () => {
    const emptyBody = { root: { type: 'root', children: [{ type: 'paragraph', children: [] }] } }
    const segs = collectSegments({ title: 'x', body }, { body: emptyBody }, TRANSLATE_SPECS.pages)
    expect(segs.map((s) => s.text)).toContain('Kamelya')
  })
})
