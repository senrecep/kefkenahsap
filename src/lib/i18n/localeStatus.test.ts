import { describe, expect, it } from 'vitest'

import { localeStates } from './localeStatus'

const locales = ['tr', 'en', 'ru'] as const

describe('localeStates (admin "Diller" panel)', () => {
  it('live = slug + title in the published doc; draft = title only in the latest draft; else empty', () => {
    const draft = {
      title: { tr: 'Köşk', en: '[EN] Mansion', ru: null },
      slug: { tr: 'kosk', en: 'mansion' },
    }
    const published = { _status: 'published', title: { tr: 'Köşk' }, slug: { tr: 'kosk' } }
    expect(localeStates({ locales, titleKey: 'title', draft, published })).toEqual([
      { locale: 'tr', state: 'live' },
      { locale: 'en', state: 'draft' },
      { locale: 'ru', state: 'empty' },
    ])
  })

  it('a never-published doc (main doc still a draft) has no live locale', () => {
    const doc = { _status: 'draft', name: { tr: 'Deck' }, slug: { tr: 'deck' } }
    expect(localeStates({ locales, titleKey: 'name', draft: doc, published: doc })).toEqual([
      { locale: 'tr', state: 'draft' },
      { locale: 'en', state: 'empty' },
      { locale: 'ru', state: 'empty' },
    ])
  })

  it('whitespace counts as empty; a missing published doc is fine', () => {
    const draft = { title: { tr: '  ', en: 'B' } }
    expect(localeStates({ locales, titleKey: 'title', draft, published: null })).toEqual([
      { locale: 'tr', state: 'empty' },
      { locale: 'en', state: 'draft' },
      { locale: 'ru', state: 'empty' },
    ])
  })
})

describe('localeStates: a live language with unpublished changes', () => {
  const published = {
    _status: 'published',
    updatedAt: '2026-10-01',
    title: { tr: 'Köşk', en: 'Mansion' },
    slug: { tr: 'kosk', en: 'mansion' },
    testimonial: { author: 'Ali', quote: { tr: 'Güzel', en: 'Nice' } },
    faq: { tr: [{ q: 'Ne?', a: 'Bu' }], en: [{ q: 'What?', a: 'This' }] },
  }

  it('flags only the language whose own text differs in the newer draft', () => {
    const draft = {
      ...published,
      updatedAt: '2026-10-02',
      testimonial: { author: 'Ali', quote: { tr: 'Güzel', en: 'Very nice' } },
    }
    expect(localeStates({ locales, titleKey: 'title', draft, published })).toEqual([
      { locale: 'tr', state: 'live' },
      { locale: 'en', state: 'changed' },
      { locale: 'ru', state: 'empty' },
    ])
  })

  it('a change in a shared (non-language) field or in metadata flags no language', () => {
    const draft = {
      ...published,
      updatedAt: '2026-10-03',
      testimonial: { author: 'Ayşe', quote: published.testimonial.quote },
    }
    expect(
      localeStates({ locales, titleKey: 'title', draft, published }).map((r) => r.state),
    ).toEqual(['live', 'live', 'empty'])
  })

  it('a changed per-language list (FAQ) flags that language; missing vs null is no change', () => {
    const draft = {
      ...published,
      faq: { ...published.faq, tr: [{ q: 'Ne?', a: 'Şu' }] },
      title: { ...published.title, ru: null },
    }
    expect(
      localeStates({ locales, titleKey: 'title', draft, published }).map((r) => r.state),
    ).toEqual(['changed', 'live', 'empty'])
  })
})
