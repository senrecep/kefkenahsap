import { describe, expect, it } from 'vitest'

import { rootLocale } from './root'

// PLAN §5.1: `/` → the visitor's language, but only a language with content (TR always live, the default).
const live = ['tr', 'en']

describe('rootLocale', () => {
  it('a live preferred language wins, by Accept-Language order and q', () => {
    expect(rootLocale({ accept: 'en-US,en;q=0.9,tr;q=0.8', live })).toBe('en')
    expect(rootLocale({ accept: 'de;q=0.5, tr;q=0.9', live })).toBe('tr')
  })
  it('a language without content falls through to the next preferred live one', () => {
    expect(rootLocale({ accept: 'ru-RU,ru;q=0.9,en;q=0.8', live })).toBe('en')
  })
  it('nothing preferred is live → the default (tr)', () => {
    expect(rootLocale({ accept: 'ru-RU,ru;q=0.9', live })).toBe('tr')
    expect(rootLocale({ accept: null, live })).toBe('tr')
    expect(rootLocale({ accept: '*', live })).toBe('tr')
  })
  it('the remembered choice (cookie) wins only while that language is live', () => {
    expect(rootLocale({ accept: 'tr', cookie: 'en', live })).toBe('en')
    expect(rootLocale({ accept: 'en', cookie: 'ru', live })).toBe('en')
    expect(rootLocale({ accept: 'ru', cookie: 'ru', live: [...live, 'ru'] })).toBe('ru')
  })
  it('ignores q=0 and malformed entries', () => {
    expect(rootLocale({ accept: 'en;q=0, ;q=, tr', live })).toBe('tr')
  })
})
