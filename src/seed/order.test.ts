import { describe, expect, it } from 'vitest'

import { fileKey, orderForCategory, uploadsForPhoto } from './order'

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

describe('uploadsForPhoto (which WP uploads are this local photo)', () => {
  const up = (path: string, w: number, h: number, page?: string) => ({ source_url: `https://x/wp-content/uploads/${path}`, w, h, page })
  const local = { w: 1600, h: 1200, category: 'deck-ve-zeminler' }
  const seeded = new Set(['deck-ve-zeminler', 'pergola-ve-kamelyalar'])

  it('takes uploads attached to this category page and same-size re-uploads', () => {
    const own = up('2018/09/20.jpg', 1024, 768, 'deck-ve-zeminler')
    const reupload = up('2019/01/20.jpg', 1024, 768)
    expect(uploadsForPhoto([own, reupload], local, seeded)).toEqual([own, reupload])
  })
  it('drops a same-name photo with a different shape (portrait 20.jpeg vs landscape 20.jpg)', () => {
    const own = up('2018/09/20.jpg', 1024, 768, 'deck-ve-zeminler')
    const other = up('2020/09/20.jpeg', 739, 1600)
    expect(uploadsForPhoto([own, other], local, seeded)).toEqual([own])
  })
  it("drops uploads attached to another seeded category's page", () => {
    expect(uploadsForPhoto([up('2018/09/20.jpg', 1024, 768, 'pergola-ve-kamelyalar')], local, seeded)).toEqual([])
  })
  it('takes unattached uploads only when they are all one size (the same file uploaded again)', () => {
    const a = up('2015/09/11.jpg', 1600, 1200)
    const b = up('2016/02/11.jpg', 1600, 1200)
    expect(uploadsForPhoto([a, b], local, seeded)).toEqual([a, b])
    expect(uploadsForPhoto([a, up('2017/03/11.jpg', 800, 600)], local, seeded)).toEqual([])
  })
})
