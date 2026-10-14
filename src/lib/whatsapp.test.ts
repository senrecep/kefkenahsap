import { describe, expect, it } from 'vitest'
import { Result } from 'tsentials/result'

import { normalizeTrPhone, whatsappUrl } from './whatsapp'

describe('normalizeTrPhone', () => {
  it('turns Turkish mobile formats into E.164 digits', () => {
    expect(normalizeTrPhone('0532 295 84 16')).toEqual(Result.success('905322958416'))
    expect(normalizeTrPhone('+90 (532) 295-84-16')).toEqual(Result.success('905322958416'))
    expect(normalizeTrPhone('5322958416')).toEqual(Result.success('905322958416'))
  })
  it('rejects numbers that are not 10 national digits', () => {
    const r = normalizeTrPhone('0212 322 43')
    expect(Result.isFailure(r) && r.errors[0]?.code).toBe('Phone.Invalid')
  })
})

describe('whatsappUrl', () => {
  it('fills the template and URL-encodes Turkish text', () => {
    const r = whatsappUrl({
      phone: '0532 295 84 16',
      template: 'Merhaba, {category} hakkında bilgi almak istiyorum. ({url})',
      vars: { category: 'Deck ve Zeminler', url: 'kefkenahsap.com/tr/deck-ve-zeminler' },
    })
    // Expected encoding computed with encodeURIComponent on the filled sentence.
    expect(r).toEqual(
      Result.success(
        'https://wa.me/905322958416?text=' +
          encodeURIComponent('Merhaba, Deck ve Zeminler hakkında bilgi almak istiyorum. (kefkenahsap.com/tr/deck-ve-zeminler)'),
      ),
    )
  })
  it('drops placeholders whose value is missing and tidies whitespace', () => {
    const r = whatsappUrl({ phone: '05322958416', template: 'Merhaba, {project}  teklif istiyorum.', vars: {} })
    expect(r).toEqual(Result.success('https://wa.me/905322958416?text=' + encodeURIComponent('Merhaba, teklif istiyorum.')))
  })
  it('opens a plain chat when there is no template', () => {
    expect(whatsappUrl({ phone: '05322958416' })).toEqual(Result.success('https://wa.me/905322958416'))
  })
})
