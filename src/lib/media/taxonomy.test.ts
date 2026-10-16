import { describe, expect, it } from 'vitest'

import { approvalTags, duplicateToHide, importStatus, mediaRefs, moveAction, pickCover, remedyDue, remedyUnfinished, tagIdsToAdd, type TagRef } from './taxonomy'

const TAGS: TagRef[] = [
  { id: 1, axis: 'type', slug: 'deck', name: 'Deck' },
  { id: 2, axis: 'type', slug: 'korkuluk', name: 'Korkuluk' },
  { id: 3, axis: 'setting', slug: 'bahce', name: 'Bahçe' },
  { id: 4, axis: 'setting', slug: 'teras', name: 'Teras' },
  { id: 5, axis: 'wood', slug: 'emprenyeli-cam', name: 'Emprenyeli çam' },
  { id: 6, axis: 'finish', slug: 'dogal', name: 'Doğal ton' },
  { id: 7, axis: 'finish', slug: 'vernikli', name: 'Vernik / cila' },
  { id: 8, axis: 'stage', slug: 'oncesi', name: 'Öncesi' },
  { id: 9, axis: 'stage', slug: 'uygulama-asamasi', name: 'Uygulama aşaması' },
  { id: 10, axis: 'stage', slug: 'detay', name: 'Detay' },
]

describe('tagIdsToAdd', () => {
  it('maps the photo facts by tag slug, stage through its TR tag', () => {
    const r = tagIdsToAdd({ type: ['deck', 'korkuluk'], setting: ['bahce'], wood: ['emprenyeli-cam'], finish: ['dogal'], stage: ['before'] }, undefined, TAGS, [])
    expect(r.add).toEqual([1, 2, 3, 5, 6, 8])
    expect(r.unmapped).toEqual([])
  })

  it('treats a finished photo as having no stage tag and a workshop photo as in progress', () => {
    expect(tagIdsToAdd({ stage: ['finished'] }, undefined, TAGS, []).add).toEqual([])
    expect(tagIdsToAdd({ stage: ['workshop'] }, undefined, TAGS, []).add).toEqual([9])
  })

  it('falls back to the meta tag names (TR name, any case) only for an axis the facts leave empty', () => {
    const r = tagIdsToAdd({ finish: ['dogal'] }, { finish: ['vernik / cila'], setting: ['TERAS', 'dış mekân'], stage: ['detail'] }, TAGS, [])
    expect(r.add).toEqual([4, 6, 10])
    expect(r.unmapped).toEqual(['setting:dış mekân'])
  })

  it('maps the roof-frame facts (other:cati-kirisi, other:roof-truss-frame) to the çatı iskeleti type tag', () => {
    const tags: TagRef[] = [...TAGS, { id: 11, axis: 'type', slug: 'cati-iskeleti', name: 'Çatı iskeleti / kiriş' }]
    const r = tagIdsToAdd({ type: ['other:cati-kirisi', 'other:roof-truss-frame'] }, undefined, tags, [])
    expect(r.add).toEqual([11])
    expect(r.unmapped).toEqual([])
  })

  it('maps the frequent other:* facts to the existing type tags they belong to', () => {
    const tags: TagRef[] = [
      ...TAGS,
      { id: 11, axis: 'type', slug: 'cati-iskeleti', name: 'Çatı iskeleti / kiriş' },
      { id: 12, axis: 'type', slug: 'oturma-grubu', name: 'Oturma grubu' },
      { id: 13, axis: 'type', slug: 'ciceklik', name: 'Çiçeklik / saksı' },
    ]
    const facts = { type: ['other:ahsap-koltuk', 'other:yüzer platform', 'other:el-arabasi-ciceklik', 'other:lamine-cati'] }
    const r = tagIdsToAdd(facts, undefined, tags, [])
    expect(r.add).toEqual([1, 11, 12, 13])
    expect(r.unmapped).toEqual([])
  })

  it('lists values without a tag, including other:* types', () => {
    expect(tagIdsToAdd({ type: ['other:tabela', 'deck'], setting: ['orman'] }, undefined, TAGS, []).unmapped).toEqual(['type:other:tabela', 'setting:orman'])
  })

  it('never re-adds a tag the photo has, and leaves a single-value axis the photo already has alone', () => {
    const current = [{ id: 3, axis: 'setting' }, { id: 7, axis: 'finish' }]
    const r = tagIdsToAdd({ type: ['deck'], setting: ['bahce', 'teras'], finish: ['dogal'] }, undefined, TAGS, current)
    expect(r.add).toEqual([1, 4])
  })

  it('adds one tag per single-value axis: the first value that maps to a tag; unmapped values are still listed', () => {
    const tags: TagRef[] = [...TAGS, { id: 11, axis: 'wood', slug: 'iroko', name: 'İroko' }, { id: 12, axis: 'wood', slug: 'teak', name: 'Teak' }]
    const r = tagIdsToAdd({}, { wood: ['bilinmeyen', 'iroko', 'teak'], stage: ['finished', 'before', 'detail'], setting: ['bahce', 'teras'] }, tags, [])
    expect(r.add).toEqual([3, 4, 8, 11])
    expect(r.unmapped).toEqual(['wood:bilinmeyen'])
  })

  it('does not match a slug on another axis', () => {
    expect(tagIdsToAdd({ setting: ['deck'] }, undefined, TAGS, []).add).toEqual([])
  })
})

describe('importStatus', () => {
  it('holds back only a photo the tagger doubted (category disagrees, confidence 0.3 or less)', () => {
    expect(importStatus({ categoryAgrees: false, confidence: 0.3 })).toBe('pending')
    expect(importStatus({ categoryAgrees: false, confidence: 0.4 })).toBe('approved')
    expect(importStatus({ categoryAgrees: true, confidence: 0.1 })).toBe('approved')
  })
})

describe('moveAction', () => {
  it('moves only from the planned category', () => {
    expect(moveAction(10, 10, 20)).toBe('move')
    expect(moveAction(20, 10, 20)).toBe('done')
    expect(moveAction(30, 10, 20)).toBe('mismatch')
    expect(moveAction(undefined, 10, 20)).toBe('mismatch')
  })
})

describe('remedyUnfinished', () => {
  const source = { width: 2048, height: 1536 }
  it('spots an unstamped replacement whose watermark write did not happen (new file in, watermark none)', () => {
    expect(remedyUnfinished({ watermark: 'none', width: 2048, height: 1536 }, source, false)).toBe(true)
  })
  it('leaves a finished one, a stamped one and a file of other size alone', () => {
    expect(remedyUnfinished({ watermark: 'already', width: 2048, height: 1536 }, source, false)).toBe(false)
    expect(remedyUnfinished({ watermark: 'none', width: 2048, height: 1536 }, source, true)).toBe(false)
    expect(remedyUnfinished({ watermark: 'none', width: 960, height: 720 }, source, false)).toBe(false)
  })
})

describe('remedyDue', () => {
  const planned = { filename: 'a.webp', filesize: 1000 }
  it('replaces only while the stored file is still the planned one', () => {
    expect(remedyDue({ filename: 'a.webp', filesize: 1000 }, planned)).toBe(true)
    expect(remedyDue({ filename: 'a.webp', filesize: 999 }, planned)).toBe(false)
    expect(remedyDue({ filename: 'a-1.webp', filesize: 1000 }, planned)).toBe(false)
  })
})

describe('pickCover', () => {
  const c = (id: number, width: number, height: number, live: boolean, quality = 'good') => ({ id, width, height, live, quality })
  it('takes a good, landscape, at least 1280 px wide photo, live ones first, then the widest', () => {
    expect(pickCover([c(1, 2560, 1440, false), c(2, 1600, 1200, true), c(3, 1920, 1080, true)])).toBe(3)
  })
  it('skips portrait, narrow and not-good photos', () => {
    expect(pickCover([c(1, 1200, 1600, true), c(2, 1024, 768, true), c(3, 2048, 1536, true, 'ok'), { id: 4, width: 2048, height: 1536, live: true }])).toBeUndefined()
  })
  it('breaks ties on the lower id', () => {
    expect(pickCover([c(5, 2048, 1536, true), c(4, 2048, 1536, true)])).toBe(4)
  })
})

describe('mediaRefs', () => {
  it('collects the media ids of upload fields anywhere in a depth-0 document, in every locale', () => {
    const doc = { id: 9, cover: 4, gallery: [5, 6], hero: { image: 7, mobileImage: null }, seo: { tr: { ogImage: 8 }, en: { ogImage: 8 } }, sort: 3, layout: [{ blockType: 'hero', image: { id: 11 } }] }
    expect([...mediaRefs(doc)].sort((a, b) => a - b)).toEqual([4, 5, 6, 7, 8, 11])
  })

  it('collects images placed in rich text (Lexical upload nodes), not other uploads', () => {
    const body = { root: { children: [{ type: 'paragraph', children: [] }, { type: 'upload', relationTo: 'media', value: 12 }, { type: 'upload', relationTo: 'media', value: { id: 13 } }, { type: 'upload', relationTo: 'lead-photos', value: 14 }] } }
    expect([...mediaRefs({ tr: { body } })].sort((a, b) => a - b)).toEqual([12, 13])
  })
})

describe('duplicateToHide', () => {
  it('hides the planned copy, else the kept one when only the planned copy is in use, else neither', () => {
    expect(duplicateToHide({ id: 1, used: false }, { id: 2, used: false })).toBe(1)
    expect(duplicateToHide({ id: 1, used: true }, { id: 2, used: false })).toBe(2)
    expect(duplicateToHide({ id: 1, used: true }, { id: 2, used: true })).toBeUndefined()
  })
})

describe('approvalTags', () => {
  const s = (tags: object, promptVersion = 'tagImage@3') => ({ promptVersion, tags })

  it('adds the suggested tags that exist (TR name in any case, or slug), stage through its TR tag, unknown names ignored', () => {
    expect(approvalTags(s({ type: ['DECK', 'Yok böyle'], setting: ['bahçe'], wood: ['emprenyeli-cam'], finish: [], stage: ['before'] }), TAGS, [])).toEqual([1, 3, 5, 8])
  })

  it('only adds: keeps the editor tags and leaves a filled single-value axis alone', () => {
    expect(approvalTags(s({ type: ['Deck'], wood: ['Emprenyeli çam'], finish: ['Doğal ton'], stage: ['detail'] }), TAGS, [7, 10, 2])).toEqual([7, 10, 2, 1, 5])
  })

  it('returns the current tags when there is nothing to add', () => {
    const current = [3]
    expect(approvalTags(s({ setting: ['Bahçe'], stage: ['finished'] }), TAGS, current)).toBe(current)
  })

  it('keeps one tag per single-value axis from a multi-value suggestion', () => {
    const tags: TagRef[] = [...TAGS, { id: 11, axis: 'wood', slug: 'iroko', name: 'İroko' }, { id: 12, axis: 'wood', slug: 'teak', name: 'Teak' }]
    expect(approvalTags(s({ wood: ['bilinmeyen', 'iroko', 'teak'], stage: ['finished', 'before', 'detail'] }), tags, [])).toEqual([8, 11])
  })

  it('skips a missing, malformed or pre-tagImage@2 suggestion', () => {
    for (const bad of [null, undefined, {}, s({ type: ['Deck'] }, 'tagImage@1'), s({ type: ['Deck'] }, 'other@9'), { tags: { type: ['Deck'] } }, s({ type: 'Deck' })])
      expect(approvalTags(bad, TAGS, [4])).toEqual([4])
    expect(approvalTags(s({ type: ['Deck'] }, 'tagImage@2'), TAGS, [])).toEqual([1])
  })
})
