import { describe, expect, it } from 'vitest'

import { mediaKey, pageKey } from './normalize'

describe('legacy URL normalization', () => {
  it('maps a WP page path with or without trailing slash to its slug', () => {
    expect(pageKey('/deck-ve-zeminler/')).toBe('deck-ve-zeminler')
    expect(pageKey('/deck-ve-zeminler')).toBe('deck-ve-zeminler')
    expect(pageKey('/')).toBe('')
  })

  it('reduces WP upload URLs to the original file base name', () => {
    // Size variant, duplicate counter and the old ".jpg1_" scrape quirk all collapse to one key.
    expect(mediaKey('/wp-content/uploads/2018/09/1-1-400x400.jpg')).toBe('1-1')
    expect(mediaKey('/wp-content/uploads/2018/09/1-1.jpg')).toBe('1-1')
    expect(mediaKey('/wp-content/uploads/2018/10/IMG_20180503_114721.jpg1_-400x400.jpg')).toBe('img_20180503_114721')
    expect(mediaKey('/wp-content/uploads/2018/10/IMG_20180503_114721.jpg1_.jpg')).toBe('img_20180503_114721')
  })

  it('decodes percent-encoded Turkish characters and normalizes to NFC', () => {
    const encoded = '/wp-content/uploads/2021/04/kap%C4%B1dolap2-300x200.jpeg'
    const decomposed = '/wp-content/uploads/2021/04/kapıdolap2.jpeg'.normalize('NFD')
    expect(mediaKey(encoded)).toBe('kapıdolap2')
    expect(mediaKey(decomposed)).toBe('kapıdolap2')
  })

  it('returns null for paths outside wp-content/uploads', () => {
    expect(mediaKey('/tr/deck-ve-zeminler')).toBeNull()
  })
})
