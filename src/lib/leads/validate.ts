import { Result } from 'tsentials/result'
import { Err, type AppError } from 'tsentials/errors'
import type { DateTimeProvider } from 'tsentials/time'

import { normalizeTrPhone } from '@/lib/whatsapp'

/** Accepted lead photo types (no SVG: scriptable). Shared with the LeadPhotos upload config. */
export const LEAD_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
export const MAX_PHOTOS = 5
/** Date of the in-repo KVKK/cookie texts (messages/<locale>/legal.json), shown as "Son güncelleme" on both pages; legal.test.ts fails until it is updated with the text. */
export const KVKK_TEXT_DATE = '2026-10-18'
/** Version of the KVKK notice the form's acknowledgment box links to; stored on every lead. */
export const KVKK_TEXT_VERSION = `kvkk-${KVKK_TEXT_DATE}`
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024
const MAX_TEXT = 5000
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// A national trunk 0 written after the country code: "+49 0170…", "+49 (0)30…" (needs a separator after the code;
// "+490170…" cannot be told apart and is taken as written).
const TRUNK = /^(\s*(?:\+|00)\s*\d{1,3})(?:[\s\-./]+0|[\s\-./]*\(0\))/

/**
 * Lead phone → E.164 digits without "+". A number written with + or 00 and a country code other than 90 is
 * international (8–15 digits, E.164); everything else, +90 included, must be a valid Turkish number. One trunk 0
 * after the country code is dropped.
 */
function leadPhone(raw: string): Result<string> {
  const input = raw.replace(TRUNK, '$1 ')
  if (TRUNK.test(input)) return Result.failure(Err.validation('Phone.Invalid', 'Geçersiz telefon numarası'))
  const digits = input.replace(/\D/g, '').replace(/^00/, '')
  if (/^\s*(\+|00)/.test(input) && !digits.startsWith('90'))
    return Result.successIf(/^[1-9]\d{7,14}$/.test(digits), digits, Err.validation('Phone.Invalid', 'Geçersiz telefon numarası'))
  return normalizeTrPhone(input)
}

export type LeadInput = {
  name: string
  phone: string
  consentKvkk: boolean
  email?: string
  service?: string
  city?: string
  district?: string
  message?: string
  photos?: { type: string; size: number }[]
}
export type ValidLead = Omit<LeadInput, 'photos'> & { phone: string }

/** Lead form rules (PLAN §4): name, phone and KVKK consent are required; the rest is optional. All errors at once. */
export function validateLead(input: LeadInput): Result<ValidLead> {
  const errors: AppError[] = []
  const name = input.name?.trim() ?? ''
  if (!name) errors.push(Err.validation('Lead.NameRequired', 'Ad soyad gerekli.'))
  const phone = leadPhone(input.phone ?? '')
  if (Result.isFailure(phone)) errors.push(Err.validation('Lead.PhoneInvalid', 'Geçerli bir telefon numarası girin.'))
  if (!input.consentKvkk) errors.push(Err.validation('Lead.ConsentRequired', 'Aydınlatma metnini okuduğunuzu işaretleyin.'))
  const email = input.email?.trim()
  if (email && !EMAIL.test(email)) errors.push(Err.validation('Lead.EmailInvalid', 'E-posta adresi geçersiz.'))
  if ((input.message?.length ?? 0) > MAX_TEXT) errors.push(Err.validation('Lead.MessageTooLong', 'Mesaj çok uzun.'))
  const photos = input.photos ?? []
  if (photos.length > MAX_PHOTOS) errors.push(Err.validation('Lead.TooManyPhotos', `En fazla ${MAX_PHOTOS} fotoğraf.`))
  if (photos.some((p) => !LEAD_PHOTO_TYPES.includes(p.type))) errors.push(Err.validation('Lead.PhotoType', 'Yalnızca fotoğraf yüklenebilir.'))
  if (photos.some((p) => p.size > MAX_PHOTO_BYTES)) errors.push(Err.validation('Lead.PhotoTooLarge', 'Fotoğraf en fazla 10 MB olabilir.'))
  if (errors.length || !Result.isSuccess(phone)) return Result.failure(...errors)
  return Result.success({
    name,
    phone: phone.value,
    consentKvkk: true,
    ...(email ? { email } : {}),
    ...(input.service ? { service: input.service } : {}),
    ...(input.city ? { city: input.city.trim() } : {}),
    ...(input.district ? { district: input.district.trim() } : {}),
    ...(input.message ? { message: input.message.trim() } : {}),
  })
}

/** KVKK retention: leads (and their photos) are deleted two years after receipt. */
export function retentionUntil(clock: DateTimeProvider): Date {
  const d = new Date(clock.utcNow())
  d.setUTCFullYear(d.getUTCFullYear() + 2)
  return d
}
