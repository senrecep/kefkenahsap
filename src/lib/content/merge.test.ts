import { describe, expect, it } from 'vitest'

import { fillEmpty, isEmpty, renamePatch } from './merge'

// A cleared Payload rich-text field: a root holding one empty paragraph, not null.
const emptyLexical = { root: { type: 'root', children: [{ type: 'paragraph', children: [] }] } }
const filledLexical = { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Usta yazdı' }] }] } }
const whitespaceLexical = { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: '  ' }] }] } }

describe('isEmpty', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['empty string', ''],
    ['whitespace', '  \n'],
    ['empty array', []],
    ['cleared rich text', emptyLexical],
    ['rich text with only spaces', whitespaceLexical],
  ])('%s is empty', (_, v) => expect(isEmpty(v)).toBe(true))

  it.each([
    ['text', 'Deck'],
    ['zero', 0],
    ['array with a row', [{ q: 'Soru?', a: 'Cevap.' }]],
    ['rich text with text', filledLexical],
  ])('%s is filled', (_, v) => expect(isEmpty(v)).toBe(false))
})

describe('fillEmpty', () => {
  const incoming = { shortDesc: 'Yeni giriş.', body: filledLexical, faq: [{ q: 'S?', a: 'C.' }] }

  it('fills every empty field', () => {
    expect(fillEmpty({ shortDesc: '', body: emptyLexical, faq: [] }, incoming)).toEqual(incoming)
  })

  it('never touches a field the owner already filled', () => {
    const current = { shortDesc: 'Sahibin metni.', body: null, faq: [{ q: 'Sahibin sorusu?', a: 'Cevabı.' }] }
    expect(fillEmpty(current, incoming)).toEqual({ body: filledLexical })
  })

  it('returns an empty patch when nothing needs filling, so the caller can skip the write', () => {
    const current = { shortDesc: 'x', body: filledLexical, faq: [{ q: 'a', a: 'b' }] }
    expect(fillEmpty(current, incoming)).toEqual({})
  })

  it('overwrites filled fields only with force', () => {
    const current = { shortDesc: 'Sahibin metni.', body: filledLexical, faq: [] }
    expect(fillEmpty(current, incoming, { force: true })).toEqual(incoming)
  })

  it('never writes an empty incoming value, even with force', () => {
    expect(fillEmpty({ shortDesc: 'Sahibin metni.' }, { shortDesc: '' }, { force: true })).toEqual({})
  })
})

describe('renamePatch (#172)', () => {
  const from = { name: 'Ahşap Yapılar', slug: 'ahsap-yapilar', shortDesc: 'Eski giriş.' }
  const to = { name: 'Sundurma ve Ahşap Çatı', slug: 'sundurma-ve-ahsap-cati', shortDesc: 'Yeni giriş.', body: 'NEW_BODY', faq: [{ q: 'S?', a: 'C.' }] }

  it('moves name, slug and the whole seeded text while they are still the seed values', () => {
    const current = { name: 'Ahşap Yapılar', slug: 'ahsap-yapilar', shortDesc: 'Eski giriş.', body: 'OLD_BODY', faq: [{ q: 'Eski?', a: 'Eski.' }] }
    expect(renamePatch(current, from, to)).toEqual(to)
  })
  it('fills an empty locale', () => {
    expect(renamePatch({}, from, to)).toEqual(to)
  })
  it('keeps what the owner edited: a renamed name or slug, an edited intro keeps body and FAQ too', () => {
    const current = { name: 'Sundurmalar', slug: 'sundurmalar', shortDesc: 'Sahibin yazdığı giriş.', body: 'OWNER_BODY', faq: [{ q: 'X?', a: 'Y.' }] }
    expect(renamePatch(current, from, to)).toEqual({})
  })
  it('still fills empty text fields next to an edited intro', () => {
    expect(renamePatch({ name: 'Ahşap Yapılar', slug: 'ahsap-yapilar', shortDesc: 'Sahibin girişi.', body: null, faq: [] }, from, to)).toEqual({
      name: to.name,
      slug: to.slug,
      body: 'NEW_BODY',
      faq: to.faq,
    })
  })
  it('is a no-op once applied (idempotent)', () => {
    expect(renamePatch(to, from, to)).toEqual({})
  })
})
