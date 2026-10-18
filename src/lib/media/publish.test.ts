import { describe, expect, it } from 'vitest'
import { Result } from 'tsentials/result'

import { changeIsPublic, checkPublishable } from './publish'

const code = (r: ReturnType<typeof checkPublishable>) => (Result.isFailure(r) ? r.errors.map((e) => e.code) : [])

describe('media publish rule (PLAN §9: published images need approved alt text)', () => {
  it('allows pending and hidden images without alt text', () => {
    expect(Result.isSuccess(checkPublishable({ status: 'pending', alt: {} }))).toBe(true)
    expect(Result.isSuccess(checkPublishable({ status: 'hidden', alt: {} }))).toBe(true)
  })

  it('requires default-locale (tr) alt text to approve', () => {
    expect(code(checkPublishable({ status: 'approved', alt: {} }))).toEqual(['Media.AltRequired'])
    expect(code(checkPublishable({ status: 'approved', alt: { tr: '   ' } }))).toEqual(['Media.AltRequired'])
    expect(code(checkPublishable({ status: 'approved', alt: { en: 'Deck' } }))).toEqual(['Media.AltRequired'])
  })

  it('approves when Turkish alt text is present', () => {
    expect(Result.isSuccess(checkPublishable({ status: 'approved', alt: { tr: 'Havuz kenarı iroko deck' } }))).toBe(true)
  })

  it('rejects alt text longer than 125 characters', () => {
    expect(code(checkPublishable({ status: 'approved', alt: { tr: 'a'.repeat(126) } }))).toEqual(['Media.AltTooLong'])
  })
})

describe('changeIsPublic (#211)', () => {
  const approved = { id: 1, status: 'approved', alt: 'Deck', title: 'Deck', aiSuggestion: null, i18nSync: null, updatedAt: '2026-10-18T10:00:00Z' }
  it('a photo that is not public before or after never refreshes the site', () => {
    expect(changeIsPublic({ ...approved, status: 'pending', alt: 'x' }, { ...approved, status: 'pending' })).toBe(false)
  })
  it('approving or un-approving a photo does', () => {
    expect(changeIsPublic(approved, { ...approved, status: 'pending' })).toBe(true)
    expect(changeIsPublic({ ...approved, status: 'hidden' }, approved)).toBe(true)
  })
  it('a public field of an approved photo does', () => {
    expect(changeIsPublic({ ...approved, alt: 'Yeni' }, approved)).toBe(true)
  })
  it('the seoRename job moving an approved photo to new file URLs does (#210)', () => {
    const before = { ...approved, filename: 'IMG_1.webp', url: '/a/IMG_1.webp', sizes: { w320: { url: '/a/IMG_1-320x240.webp' } }, seoRenamed: false }
    const after = { ...before, filename: 'bahce-deck.webp', url: '/a/bahce-deck.webp', sizes: { w320: { url: '/a/bahce-deck-320x240.webp' } }, seoRenamed: true }
    expect(changeIsPublic(after, before)).toBe(true)
  })
  it('an AI job writing only its own bookkeeping does not', () => {
    expect(changeIsPublic({ ...approved, aiSuggestion: { alt: 'öneri' }, i18nSync: { en: {} }, updatedAt: '2026-10-18T10:05:00Z' }, approved)).toBe(false)
  })
  it('a create (no previous doc) counts when approved', () => {
    expect(changeIsPublic(approved, undefined)).toBe(true)
    expect(changeIsPublic({ ...approved, status: 'pending' }, undefined)).toBe(false)
  })
})
