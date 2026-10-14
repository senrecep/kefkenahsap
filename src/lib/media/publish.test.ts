import { describe, expect, it } from 'vitest'
import { Result } from 'tsentials/result'

import { checkPublishable } from './publish'

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
