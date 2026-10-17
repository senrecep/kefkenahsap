import { describe, expect, it } from 'vitest'

import { retargetLegacyMaps, type LiveMedia } from './retarget'

const live = (entries: [string, string, string?][]) =>
  new Map<string, LiveMedia>(entries.map(([seedKey, filename, seoFilename]) => [seedKey, { filename, seoFilename: seoFilename ?? filename.replace(/\.webp$/, '') }]))

describe('retargetLegacyMaps', () => {
  it('keeps targets whose file is still current', () => {
    const maps = { media: { '2018/09/1-1': { file: 'deck.webp', seedKey: 'deck/1-1.webp' } }, attachments: { '/deck/1-6/': { slug: 'deck', seedKey: 'deck/1-1.webp' } } }
    const out = retargetLegacyMaps(maps, live([['deck/1-1.webp', 'deck.webp']]), { duplicates: [], rejects: [] })
    expect(out).toEqual({ maps, unresolved: [] })
  })

  it('follows a replaced file: the CDN file gets the new name, the gallery slug stays the SEO file name', () => {
    const maps = { media: { '2018/09/1-1': { file: 'deck.webp', seedKey: 'deck/1-1.webp' } }, attachments: { '/deck/1-6/': { slug: 'deck', seedKey: 'deck/1-1.webp' } } }
    const out = retargetLegacyMaps(maps, live([['deck/1-1.webp', 'deck-1.webp', 'deck']]), { duplicates: [], rejects: [] })
    expect(out.maps.media['2018/09/1-1']).toEqual({ file: 'deck-1.webp', seedKey: 'deck/1-1.webp' })
    expect(out.maps.attachments['/deck/1-6/']).toEqual({ slug: 'deck', seedKey: 'deck/1-1.webp' })
    expect(out.unresolved).toEqual([])
  })

  it('sends a deleted duplicate to the photo it duplicates, also when that one was replaced', () => {
    const maps = { media: { '2018/09/16': { file: 'dus.webp', seedKey: 'deck/16.webp' } }, attachments: { '/deck/16/': { slug: 'dus', seedKey: 'deck/16.webp' } } }
    const out = retargetLegacyMaps(maps, live([['yapi/87-1.webp', 'kulube-1.webp', 'kulube']]), { duplicates: [{ hide: 'deck/16.webp', keep: 'yapi/87-1.webp' }], rejects: [] })
    expect(out.maps.media['2018/09/16']).toEqual({ file: 'kulube-1.webp', seedKey: 'yapi/87-1.webp' })
    expect(out.maps.attachments['/deck/16/']).toEqual({ slug: 'kulube', seedKey: 'yapi/87-1.webp' })
    expect(out.unresolved).toEqual([])
  })

  it('drops a rejected photo (its old URLs answer 410)', () => {
    const maps = { media: { '2018/09/19': { file: 'x.webp', seedKey: 'yapi/19.webp' } }, attachments: { '/yapi/19/': { slug: 'x', seedKey: 'yapi/19.webp' } } }
    const out = retargetLegacyMaps(maps, live([]), { duplicates: [], rejects: ['yapi/19.webp'] })
    expect(out).toEqual({ maps: { media: {}, attachments: {} }, unresolved: [] })
  })

  it('lists a photo that is neither live, a duplicate nor rejected and leaves its entry as it was', () => {
    const maps = { media: { '2018/09/7': { file: 'gone.webp', seedKey: 'deck/7.webp' } }, attachments: {} }
    const out = retargetLegacyMaps(maps, live([]), { duplicates: [], rejects: [] })
    expect(out.unresolved).toEqual(['deck/7.webp'])
    expect(out.maps.media['2018/09/7']).toEqual({ file: 'gone.webp', seedKey: 'deck/7.webp' })
  })
})
