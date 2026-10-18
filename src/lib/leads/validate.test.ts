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

  it('keeps every Turkish form: 0xxx, 5xx, +90 and 0090 → 90… digits', () => {
    const phone = (p: string) => { const r = validateLead({ ...ok, phone: p }); return Result.isSuccess(r) ? r.value.phone : null }
    for (const p of ['0532 111 22 33', '532 111 22 33', '+90 532 111 22 33', '0090 532 111 22 33']) expect(phone(p), p).toBe('905321112233')
  })

  it('accepts international numbers in E.164 form: + (or 00) and a country code, 8–15 digits', () => {
    const phone = (p: string) => { const r = validateLead({ ...ok, phone: p }); return Result.isSuccess(r) ? r.value.phone : null }
    expect(phone('+49 30 1234567')).toBe('49301234567') // 10 digits after +: not read as a Turkish number
    expect(phone('+7 916 123-45-67')).toBe('79161234567')
    expect(phone('0049 1512 3456789')).toBe('4915123456789')
    expect(phone('+44 20 7946 0958')).toBe('442079460958')
    expect(phone('+1234567')).toBeNull() // 7 digits: too short
    expect(phone('+1234567890123456')).toBeNull() // 16 digits: too long
    expect(phone('+0 123 456 789')).toBeNull() // no country code starts with 0
    expect(phone('+90 532 11')).toBeNull() // +90 must still be a valid Turkish number
  })

  it('drops a trunk 0 written after the country code (+49 0170…, +49 (0)30…); a second 0 is still invalid', () => {
    const phone = (p: string) => { const r = validateLead({ ...ok, phone: p }); return Result.isSuccess(r) ? r.value.phone : null }
    expect(phone('+49 0170 1234567')).toBe('491701234567')
    expect(phone('+49 (0)30 1234567')).toBe('49301234567')
    expect(phone('0049-0170-1234567')).toBe('491701234567')
    expect(phone('+90 0532 111 22 33')).toBe('905321112233')
    expect(phone('+49 00170 1234567')).toBeNull()
    expect(phone('+4930 1234567')).toBe('49301234567') // no separator after the code: nothing is dropped
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
    // Scriptable SVG is an image/* type but never a lead photo.
    expect(codes(validateLead({ ...ok, photos: [{ type: 'image/svg+xml', size: 10 }] }))).toEqual(['Lead.PhotoType'])
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
