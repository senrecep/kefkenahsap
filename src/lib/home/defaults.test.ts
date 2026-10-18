import { describe, expect, it } from 'vitest'

import { effectiveHomeText, fillHomeDefaults } from './defaults'

// Hand-written two-locale fixtures (not read from messages/): the expected values are independent of the code.
const messages = {
  tr: {
    heroTitle: 'T-hero', heroText: 'T-sub', galleryTitle: 'T-gal', servicesTitle: 'T-srv', projectsTitle: 'T-prj', processTitle: 'T-prc',
    referencesTitle: 'T-ref', woodTitle: 'T-wood', faqTitle: 'T-faq', contactTitle: 'T-con',
    steps: { survey: { title: 'a1', text: 'a2' }, quote: { title: 'b1', text: 'b2' }, build: { title: 'c1', text: 'c2' }, install: { title: 'd1', text: 'd2' }, care: { title: 'e1', text: 'e2' } },
  },
  en: {
    heroTitle: 'E-hero', heroText: 'E-sub', galleryTitle: 'E-gal', servicesTitle: 'E-srv', projectsTitle: 'E-prj', processTitle: 'E-prc',
    referencesTitle: 'E-ref', woodTitle: 'E-wood', faqTitle: 'E-faq', contactTitle: 'E-con',
    steps: { survey: { title: 'A1', text: 'A2' }, quote: { title: 'B1', text: 'B2' }, build: { title: 'C1', text: 'C2' }, install: { title: 'D1', text: 'D2' }, care: { title: 'E1', text: 'E2' } },
  },
}

const layout = (locale: 'tr' | 'en') => [
  { id: 'h', blockType: 'hero', enabled: true, heading: locale === 'en' ? 'Own hero' : null },
  { id: 'g', blockType: 'featuredGallery', enabled: true, heading: '', limit: 24 },
  { id: 'p', blockType: 'process', enabled: false, steps: locale === 'en' ? [{ id: 'x', title: 'Mine', text: 'kept' }] : [] },
  { id: 'f', blockType: 'faq', enabled: true, heading: locale === 'tr' ? 'Own faq' : undefined, items: locale === 'tr' ? [{ id: 'q', q: 'Q', a: 'A' }] : [] },
  { id: 'c', blockType: 'contact', enabled: true },
]

describe('fillHomeDefaults', () => {
  it('fills only the empty headings, keeping ids, order and other fields', () => {
    const tr = fillHomeDefaults(layout('tr'), messages.tr)
    expect(tr.layout.map((b) => b.id)).toEqual(['h', 'g', 'p', 'f', 'c'])
    expect(tr.layout[0]).toMatchObject({ enabled: true, heading: 'T-hero', subheading: 'T-sub' })
    expect(tr.layout[1]).toMatchObject({ limit: 24, heading: 'T-gal' })
    expect(tr.layout[2]).toMatchObject({ enabled: false, heading: 'T-prc' })
    expect(tr.layout[3]).toMatchObject({ heading: 'Own faq' })
    expect(tr.layout[4]).toMatchObject({ heading: 'T-con' })
    expect(tr.filled).not.toContain('faq.heading')

    const en = fillHomeDefaults(layout('en'), messages.en)
    expect(en.layout[0]).toMatchObject({ heading: 'Own hero', subheading: 'E-sub' })
    expect(en.filled).not.toContain('hero.heading')
    expect(en.filled).toContain('hero.subheading')
    expect(en.layout[3]).toMatchObject({ heading: 'E-faq' })
  })

  it('treats whitespace as a value (the site renders it as is) and skips a missing message', () => {
    const blocks = [{ blockType: 'services', heading: '  ' }, { blockType: 'contact', heading: null }]
    const out = fillHomeDefaults(blocks, { ...messages.tr, contactTitle: undefined } as never)
    expect(out.layout).toEqual(blocks)
    expect(out.filled).toEqual([])
  })

  it('fills the process steps only where the list is empty', () => {
    const tr = fillHomeDefaults(layout('tr'), messages.tr).layout[2] as unknown as { steps: { title: string; text: string }[] }
    expect(tr.steps.map((s) => [s.title, s.text])).toEqual([['a1', 'a2'], ['b1', 'b2'], ['c1', 'c2'], ['d1', 'd2'], ['e1', 'e2']])
    const en = fillHomeDefaults(layout('en'), messages.en).layout[2] as unknown as { steps: unknown }
    expect(en.steps).toEqual([{ id: 'x', title: 'Mine', text: 'kept' }])
  })

  it('leaves the faq items alone and is idempotent', () => {
    const once = fillHomeDefaults(layout('tr'), messages.tr)
    expect((once.layout[3] as unknown as { items: unknown }).items).toEqual([{ id: 'q', q: 'Q', a: 'A' }])
    const twice = fillHomeDefaults(once.layout, messages.tr)
    expect(twice.filled).toEqual([])
    expect(twice.layout).toEqual(once.layout)
  })

  it('does not change what the site shows in any locale', () => {
    for (const locale of ['tr', 'en'] as const) {
      const before = layout(locale)
      expect(effectiveHomeText(fillHomeDefaults(before, messages[locale]).layout, messages[locale])).toEqual(effectiveHomeText(before, messages[locale]))
    }
  })
})
