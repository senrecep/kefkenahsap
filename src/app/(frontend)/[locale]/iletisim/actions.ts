'use server'

import { hasLocale } from 'next-intl'
import { headers } from 'next/headers'
import { SystemDateTimeProvider } from 'tsentials/time'

import { routing } from '@/i18n/routing'
import { getPayload } from '@/lib/data/payload'
import { createRateLimiter, pickUtm, verifyTurnstile } from '@/lib/leads/guard'
import { validateLead } from '@/lib/leads/validate'

export type LeadField = 'name' | 'phone' | 'email' | 'consent' | 'message' | 'photos'
/** Error values are reason codes (`PhoneInvalid`); the form turns them into localized text. */
export type LeadFormState = { status: 'idle' | 'success' | 'error'; fields?: Partial<Record<LeadField, string>>; form?: string }

const FIELD_OF: Record<string, LeadField> = {
  NameRequired: 'name',
  PhoneInvalid: 'phone',
  EmailInvalid: 'email',
  ConsentRequired: 'consent',
  MessageTooLong: 'message',
  TooManyPhotos: 'photos',
  PhotoType: 'photos',
  PhotoTooLarge: 'photos',
}

const limiter = createRateLimiter({ limit: 5, windowMs: 10 * 60_000, clock: SystemDateTimeProvider })
const text = (fd: FormData, key: string, max = 200) => String(fd.get(key) ?? '').trim().slice(0, max)

export async function submitLead(_prev: LeadFormState, fd: FormData): Promise<LeadFormState> {
  // Honeypot: bots fill every field. Pretend success so they don't retry.
  if (text(fd, 'website')) return { status: 'success' }

  const photos = fd.getAll('photos').filter((f): f is File => typeof f === 'object' && f.size > 0)
  const valid = validateLead({
    name: text(fd, 'name'),
    phone: text(fd, 'phone', 40),
    consentKvkk: fd.get('consent') === 'on',
    email: text(fd, 'email') || undefined,
    service: text(fd, 'service') || undefined,
    city: text(fd, 'city', 80) || undefined,
    district: text(fd, 'district', 80) || undefined,
    message: String(fd.get('message') ?? '') || undefined,
    photos: photos.map((p) => ({ type: p.type, size: p.size })),
  })
  if (!valid.ok) {
    const fields: LeadFormState['fields'] = {}
    for (const e of valid.errors) {
      const reason = e.code.split('.')[1]!
      fields[FIELD_OF[reason] ?? 'message'] ??= reason
    }
    return { status: 'error', fields }
  }

  const h = await headers()
  const ip = h.get('cf-connecting-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  // Counted only for well-formed submissions, so a visitor fixing typos is never locked out.
  if (!limiter.hit(ip)) return { status: 'error', form: 'RateLimited' }

  const human = await verifyTurnstile({
    token: String(fd.get('cf-turnstile-response') ?? ''),
    secret: process.env.TURNSTILE_SECRET_KEY,
    ...(ip !== 'unknown' ? { ip } : {}),
  })
  if (!human.ok) return { status: 'error', form: 'SpamCheckFailed' }

  const locale = String(fd.get('locale') ?? '')
  const payload = await getPayload()
  const photoIds: number[] = []
  try {
    for (const p of photos) {
      const doc = await payload.create({
        collection: 'lead-photos',
        data: {},
        file: { data: Buffer.from(await p.arrayBuffer()), mimetype: p.type, name: p.name || 'foto.webp', size: p.size },
        overrideAccess: true,
      })
      photoIds.push(doc.id)
    }
    await payload.create({
      collection: 'leads',
      overrideAccess: true,
      data: {
        ...valid.value,
        photos: photoIds,
        locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale,
        sourcePage: text(fd, 'sourcePage', 300) || undefined,
        utm: pickUtm(Object.fromEntries([...fd.entries()].filter((e): e is [string, string] => typeof e[1] === 'string'))),
      },
    })
  } catch (err) {
    payload.logger.error({ err }, 'lead save failed')
    // Don't keep personal photos that no lead points to.
    for (const id of photoIds) await payload.delete({ collection: 'lead-photos', id, overrideAccess: true }).catch(() => {})
    return { status: 'error', form: 'SaveFailed' }
  }
  return { status: 'success' }
}
