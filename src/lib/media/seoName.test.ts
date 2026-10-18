import { describe, expect, it } from 'vitest'

import { isSeoNamed, needsSeoRename, pickSeoName, renamePlan } from './seoName'

describe('isSeoNamed (#209)', () => {
  it('is true when the stem is the SEO name or its collision-suffixed form', () => {
    expect(isSeoNamed('bahce-evi.webp', 'bahce-evi')).toBe(true)
    expect(isSeoNamed('bahce-evi-2.webp', 'bahce-evi')).toBe(true)
    expect(isSeoNamed('bahce-evi-1.webp', 'bahce-evi')).toBe(true)
  })
  it('is false for an upload name, a different SEO name or no SEO name', () => {
    expect(isSeoNamed('WhatsApp Image 2026-10-17 at 01.09.24.webp', 'bahce-evi')).toBe(false)
    expect(isSeoNamed('bahce-evi-kapi.webp', 'bahce-evi')).toBe(false)
    expect(isSeoNamed('kamelya-2026.webp', 'kamelya')).toBe(false) // a year is not a collision suffix
    expect(isSeoNamed('bahce-evi.webp', '')).toBe(false)
    expect(isSeoNamed('bahce-evi.webp', null)).toBe(false)
    expect(isSeoNamed(null, 'bahce-evi')).toBe(false)
  })
})

describe('pickSeoName (#209)', () => {
  const none = new Set<string>()
  it('prefers seoFilename', () => {
    expect(pickSeoName({ seoFilename: 'bahce-icin-verandali-ahsap-kopek-kulubesi', titleTr: 'Başka', id: 3261, taken: none })).toBe('bahce-icin-verandali-ahsap-kopek-kulubesi')
  })
  it('falls back to the Turkish title slug, cut at 60 characters on a word boundary', () => {
    expect(pickSeoName({ seoFilename: '', titleTr: 'Çatı Katı Için Ahşap Pergola ve Şık Oturma Alanı Tasarımı Örneği', id: 1, taken: none })).toBe(
      'cati-kati-icin-ahsap-pergola-ve-sik-oturma-alani-tasarimi',
    )
    expect(pickSeoName({ seoFilename: null, titleTr: 'Işıklı Çıta Duvar', id: 1, taken: none })).toBe('isikli-cita-duvar')
  })
  it('falls back to kefken-ahsap-<id> when both are empty', () => {
    expect(pickSeoName({ seoFilename: ' ', titleTr: '!!!', id: 42, taken: none })).toBe('kefken-ahsap-42')
    expect(pickSeoName({ titleTr: undefined, id: 7, taken: none })).toBe('kefken-ahsap-7')
  })
  it('appends -2, -3 … while the name is taken', () => {
    expect(pickSeoName({ seoFilename: 'deck', id: 1, taken: new Set(['deck']) })).toBe('deck-2')
    expect(pickSeoName({ seoFilename: 'deck', id: 1, taken: new Set(['deck', 'deck-2']) })).toBe('deck-3')
  })
})

describe('renamePlan (#209)', () => {
  const doc = {
    filename: 'WhatsApp Image 2026-10-17 at 01.09.24.webp',
    sizes: {
      w320: { filename: 'WhatsApp Image 2026-10-17 at 01.09.24-320x180.webp' },
      w960: { filename: 'WhatsApp Image 2026-10-17 at 01.09.24-960x536.webp' },
      // A size that would upscale shares the original's file.
      w1920: { filename: 'WhatsApp Image 2026-10-17 at 01.09.24.webp' },
      portrait: { filename: 'WhatsApp Image 2026-10-17 at 01.09.24-400x711.webp' },
      w480: { filename: null },
    },
  }
  it('maps the original and every size to Payload size naming under the new stem', () => {
    const plan = renamePlan(doc, 'bahce-kulubesi')
    expect(plan.filename).toBe('bahce-kulubesi.webp')
    expect(plan.sizes).toEqual({
      w320: 'bahce-kulubesi-320x180.webp',
      w960: 'bahce-kulubesi-960x536.webp',
      w1920: 'bahce-kulubesi.webp',
      portrait: 'bahce-kulubesi-400x711.webp',
    })
  })
  it('lists each object move once', () => {
    expect(renamePlan(doc, 'bahce-kulubesi').moves).toEqual([
      { from: 'WhatsApp Image 2026-10-17 at 01.09.24.webp', to: 'bahce-kulubesi.webp' },
      { from: 'WhatsApp Image 2026-10-17 at 01.09.24-320x180.webp', to: 'bahce-kulubesi-320x180.webp' },
      { from: 'WhatsApp Image 2026-10-17 at 01.09.24-960x536.webp', to: 'bahce-kulubesi-960x536.webp' },
      { from: 'WhatsApp Image 2026-10-17 at 01.09.24-400x711.webp', to: 'bahce-kulubesi-400x711.webp' },
    ])
  })
  it('keeps the extension of the original and names an unexpected size file after its size key', () => {
    const plan = renamePlan({ filename: 'a.jpeg', sizes: { w320: { filename: 'other.jpeg' } } }, 'x')
    expect(plan.filename).toBe('x.jpeg')
    expect(plan.sizes).toEqual({ w320: 'x-w320.jpeg' })
  })
})

describe('needsSeoRename (#209)', () => {
  const doc = { status: 'approved', filename: 'IMG_1.webp', seoFilename: 'bahce-evi' }
  it('is true for an approved upload whose file is not SEO-named', () => {
    expect(needsSeoRename(doc)).toBe(true)
    expect(needsSeoRename({ ...doc, seoFilename: '' })).toBe(true)
  })
  it('is false for pending/hidden (unless forced), seeded, renamed or already SEO-named files', () => {
    expect(needsSeoRename({ ...doc, status: 'pending' })).toBe(false)
    expect(needsSeoRename({ ...doc, status: 'hidden' })).toBe(false)
    expect(needsSeoRename({ ...doc, status: 'hidden' }, { force: true })).toBe(true)
    expect(needsSeoRename({ ...doc, status: 'pending' }, { force: true })).toBe(false) // pending is renamed once approved
    expect(needsSeoRename({ ...doc, seedKey: 'x/y.webp' })).toBe(false)
    expect(needsSeoRename({ ...doc, seoRenamed: true })).toBe(false)
    expect(needsSeoRename({ ...doc, filename: 'bahce-evi-2.webp' })).toBe(false)
    expect(needsSeoRename({ ...doc, filename: null })).toBe(false)
  })
})
