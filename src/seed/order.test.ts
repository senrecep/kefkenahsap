import { describe, expect, it } from 'vitest'

import { fileKey, orderForCategory } from './order'

describe('fileKey (live WP name ↔ local webp name)', () => {
  it('ignores extension, case, WP size suffix and the .jpg1_ quirk', () => {
    expect(fileKey('IMG_20180503_114721.jpg1_.jpg')).toBe(fileKey('IMG_20180503_114721.jpg1_.webp'))
    expect(fileKey('10-169x300.jpg')).toBe(fileKey('10.webp'))
    expect(fileKey('kefken-ahşap-iş-resimleri-168.JPG1_.jpg')).toBe('kefken-ahsap-is-resimleri-168')
  })
  it('folds Turkish letters so kapıdolap1.jpeg matches kapidolap1.webp', () => {
    expect(fileKey('kapıdolap1.jpeg')).toBe(fileKey('kapidolap1.webp'))
  })
  it('keeps WP duplicate counters: 1 and 1-1 are different images', () => {
    expect(fileKey('1.jpg')).not.toBe(fileKey('1-1.webp'))
  })
})

describe('orderForCategory', () => {
  it('follows the live page order, then appends local-only photos alphabetically', () => {
    const live = ['3.jpg', '1-1.jpg', 'missing-on-disk.jpg', '2-169x300.jpg']
    const local = ['z-new.webp', '1-1.webp', '2.webp', '3.webp', 'a-new.webp']
    expect(orderForCategory(live, local)).toEqual(['3.webp', '1-1.webp', '2.webp', 'a-new.webp', 'z-new.webp'])
  })
  it('never lists a local file twice even if the live page repeats it', () => {
    expect(orderForCategory(['1.jpg', '1-300x200.jpg'], ['1.webp'])).toEqual(['1.webp'])
  })
})
