import { describe, expect, it } from 'vitest'
import { Result } from 'tsentials/result'
import { createFakeDateTimeProvider } from 'tsentials/time'

import { MAX_PHOTOS, MAX_PHOTO_BYTES, retentionUntil, validateLead } from './validate'

const codes = (r: Result<unknown>) => (Result.isFailure(r) ? r.errors.map((e) => e.code).sort() : [])
const ok = { name: 'Ayşe Yılmaz', phone: '0532 111 22 33', consentKvkk: true }

describe('validateLead', () => {
  it('accepts the three required fields alone (everything else optional)', () => {
    const r = validateLead(ok)
    expect(Result.isSuccess(r)).toBe(true)
    if (Result.isSuccess(r)) expect(r.value.phone).toBe('905321112233')
  })

  it('reports every missing required field at once', () => {
    expect(codes(validateLead({ name: ' ', phone: '', consentKvkk: false }))).toEqual(
      ['Lead.ConsentRequired', 'Lead.NameRequired', 'Lead.PhoneInvalid'].sort(),
    )
  })

  it('accepts landlines too (calls, not WhatsApp)', () => {
    expect(Result.isSuccess(validateLead({ ...ok, phone: '0212 322 43 59' }))).toBe(true)
  })

  it('validates optional e-mail only when given', () => {
    expect(codes(validateLead({ ...ok, email: 'not-an-email' }))).toEqual(['Lead.EmailInvalid'])
    expect(Result.isSuccess(validateLead({ ...ok, email: 'a@b.co' }))).toBe(true)
  })

  it('limits photos to 5 images of at most 10 MB', () => {
    const img = { type: 'image/jpeg', size: 1_000_000 }
    expect(codes(validateLead({ ...ok, photos: Array(MAX_PHOTOS + 1).fill(img) }))).toEqual(['Lead.TooManyPhotos'])
    expect(codes(validateLead({ ...ok, photos: [{ type: 'image/png', size: MAX_PHOTO_BYTES + 1 }] }))).toEqual(['Lead.PhotoTooLarge'])
    expect(codes(validateLead({ ...ok, photos: [{ type: 'application/pdf', size: 10 }] }))).toEqual(['Lead.PhotoType'])
  })

  it('caps free text lengths', () => {
    expect(codes(validateLead({ ...ok, message: 'x'.repeat(5001) }))).toEqual(['Lead.MessageTooLong'])
  })
})

describe('retentionUntil (KVKK: 2 years)', () => {
  it('is exactly two calendar years after receipt', () => {
    const clock = createFakeDateTimeProvider(new Date('2026-10-14T03:00:00Z'))
    expect(retentionUntil(clock).toISOString()).toBe('2028-10-14T03:00:00.000Z')
  })
})
