import { Result } from 'tsentials/result'
import { Err, type AppError } from 'tsentials/errors'
import type { DateTimeProvider } from 'tsentials/time'

import { normalizeTrPhone } from '@/lib/whatsapp'

export const MAX_PHOTOS = 5
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024
const MAX_TEXT = 5000
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

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
  const phone = normalizeTrPhone(input.phone ?? '')
  if (Result.isFailure(phone)) errors.push(Err.validation('Lead.PhoneInvalid', 'Geçerli bir telefon numarası girin.'))
  if (!input.consentKvkk) errors.push(Err.validation('Lead.ConsentRequired', 'KVKK aydınlatma metnini onaylayın.'))
  const email = input.email?.trim()
  if (email && !EMAIL.test(email)) errors.push(Err.validation('Lead.EmailInvalid', 'E-posta adresi geçersiz.'))
  if ((input.message?.length ?? 0) > MAX_TEXT) errors.push(Err.validation('Lead.MessageTooLong', 'Mesaj çok uzun.'))
  const photos = input.photos ?? []
  if (photos.length > MAX_PHOTOS) errors.push(Err.validation('Lead.TooManyPhotos', `En fazla ${MAX_PHOTOS} fotoğraf.`))
  if (photos.some((p) => !p.type.startsWith('image/'))) errors.push(Err.validation('Lead.PhotoType', 'Yalnızca fotoğraf yüklenebilir.'))
  if (photos.some((p) => p.size > MAX_PHOTO_BYTES)) errors.push(Err.validation('Lead.PhotoTooLarge', 'Fotoğraf en fazla 10 MB olabilir.'))
  if (errors.length || Result.isFailure(phone)) return Result.failure(...errors)
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
