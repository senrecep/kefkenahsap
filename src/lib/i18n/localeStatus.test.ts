import { describe, expect, it } from 'vitest'

import { localeStates } from './localeStatus'

const locales = ['tr', 'en', 'ru'] as const

describe('localeStates (admin "Diller" panel)', () => {
  it('live = slug + title in the published doc; draft = title only in the latest draft; else empty', () => {
    const draft = { title: { tr: 'Köşk', en: '[EN] Mansion', ru: null }, slug: { tr: 'kosk', en: 'mansion' } }
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
