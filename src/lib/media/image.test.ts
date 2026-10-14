import { describe, expect, it } from 'vitest'

import { responsiveImage } from './image'

const media = {
  url: 'https://cdn.kefkenahsap.com/deck.webp',
  width: 1600,
  height: 1200,
  alt: 'Havuz kenarı deck',
  lqip: 'data:image/webp;base64,AAA',
  dominantColor: '#a07850',
  sizes: {
    w320: { url: 'https://cdn.kefkenahsap.com/deck-320x240.webp', width: 320, height: 240 },
    w640: { url: 'https://cdn.kefkenahsap.com/deck-640x480.webp', width: 640, height: 480 },
    w960: { url: 'https://cdn.kefkenahsap.com/deck-960x720.webp', width: 960, height: 720 },
    w1280: { url: 'https://cdn.kefkenahsap.com/deck-1280x960.webp', width: 1280, height: 960 },
    w1920: { url: null, width: null, height: null }, // not generated: source is smaller
  },
}

describe('responsiveImage', () => {
  it('builds a width-descriptor srcset from generated sizes plus the original, skipping missing ones', () => {
    const img = responsiveImage(media)
    expect(img.srcSet).toBe(
      [
        'https://cdn.kefkenahsap.com/deck-320x240.webp 320w',
        'https://cdn.kefkenahsap.com/deck-640x480.webp 640w',
        'https://cdn.kefkenahsap.com/deck-960x720.webp 960w',
        'https://cdn.kefkenahsap.com/deck-1280x960.webp 1280w',
        'https://cdn.kefkenahsap.com/deck.webp 1600w',
      ].join(', '),
    )
  })
  it('uses the 960 size as the default src and keeps intrinsic dimensions for CLS-free layout', () => {
    const img = responsiveImage(media)
    expect(img.src).toBe('https://cdn.kefkenahsap.com/deck-960x720.webp')
    expect([img.width, img.height]).toEqual([1600, 1200])
    expect(img.alt).toBe('Havuz kenarı deck')
    expect(img.placeholder).toBe('data:image/webp;base64,AAA')
  })
  it('never lets an image without alt text through silently (alt="" marks it decorative)', () => {
    expect(responsiveImage({ ...media, alt: null }).alt).toBe('')
  })
  it('caps the largest candidate (maxWidth) for small slots', () => {
    expect(responsiveImage(media, { maxWidth: 640 }).srcSet.split(', ')).toHaveLength(2)
  })
  it('drops candidates below minWidth (slots that crop and so render wider than sizes says)', () => {
    expect(responsiveImage(media, { minWidth: 960 }).srcSet).toBe(
      ['https://cdn.kefkenahsap.com/deck-960x720.webp 960w', 'https://cdn.kefkenahsap.com/deck-1280x960.webp 1280w', 'https://cdn.kefkenahsap.com/deck.webp 1600w'].join(', '),
    )
  })
  it('applies minWidth and maxWidth together', () => {
    expect(responsiveImage(media, { minWidth: 640, maxWidth: 960 }).srcSet).toBe(
      ['https://cdn.kefkenahsap.com/deck-640x480.webp 640w', 'https://cdn.kefkenahsap.com/deck-960x720.webp 960w'].join(', '),
    )
  })
  it('keeps a source narrower than minWidth as its only candidate', () => {
    const small = { url: 'https://cdn.kefkenahsap.com/small.webp', width: 600, height: 400, sizes: { w320: { url: 'https://cdn.kefkenahsap.com/small-320x213.webp', width: 320, height: 213 } } }
    const img = responsiveImage(small, { minWidth: 960 })
    expect(img.srcSet).toBe('https://cdn.kefkenahsap.com/small.webp 600w')
    expect(img.src).toBe('https://cdn.kefkenahsap.com/small.webp')
  })
  it('keeps the largest candidate when every one is below minWidth', () => {
    expect(responsiveImage(media, { minWidth: 4000 }).srcSet).toBe('https://cdn.kefkenahsap.com/deck.webp 1600w')
  })
})
