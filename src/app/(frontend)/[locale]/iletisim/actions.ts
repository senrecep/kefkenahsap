'use server'

import { hasLocale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { headers } from 'next/headers'
import { SystemDateTimeProvider } from 'tsentials/time'

import { routing } from '@/i18n/routing'
import { getPayload } from '@/lib/data/payload'
import { getNavCategories } from '@/lib/data/site'
import { clientIp, createRateLimiter, pickUtm, verifyTurnstile } from '@/lib/leads/guard'
import { KVKK_TEXT_VERSION, validateLead } from '@/lib/leads/validate'

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

const TEN_MIN = 10 * 60_000
// Every attempt (invalid, oversized, bot) counts here; only well-formed submissions count against the strict one.
const attempts = createRateLimiter({ limit: 20, windowMs: TEN_MIN, clock: SystemDateTimeProvider })
const submissions = createRateLimiter({ limit: 5, windowMs: TEN_MIN, clock: SystemDateTimeProvider })
const safeErr = (err: unknown) => ({ name: (err as Error)?.name, message: (err as Error)?.message }) // never the payload/doc
const text = (fd: FormData, key: string, max = 200) => String(fd.get(key) ?? '').trim().slice(0, max)

export async function submitLead(_prev: LeadFormState, fd: FormData): Promise<LeadFormState> {
  const ip = clientIp(await headers(), process.env.NODE_ENV === 'production')
  if (!attempts.hit(ip)) return { status: 'error', form: 'RateLimited' }
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

  // Counted only for well-formed submissions, so a visitor fixing typos is not locked out early.
  if (!submissions.hit(ip)) return { status: 'error', form: 'RateLimited' }

  const human = await verifyTurnstile({
    token: String(fd.get('cf-turnstile-response') ?? ''),
    secret: process.env.TURNSTILE_SECRET_KEY,
    ...(ip !== 'unknown' && ip !== 'no-cf' ? { ip } : {}),
  })
  if (!human.ok) return { status: 'error', form: 'SpamCheckFailed' }

  const raw = String(fd.get('locale') ?? '')
  const locale = hasLocale(routing.locales, raw) ? raw : routing.defaultLocale
  // Service must be one of the offered options (category names or "Diğer"); anything else is dropped.
  const [categories, t] = await Promise.all([getNavCategories(locale), getTranslations({ locale, namespace: 'Contact' })])
  const services = new Set([...categories.map((c) => c.name), t('serviceOther')])
  const service = valid.value.service && services.has(valid.value.service) ? valid.value.service : undefined
  const payload = await getPayload()
  const photoIds: number[] = []
  try {
    for (const p of photos) {
      const doc = await payload.create({
        collection: 'lead-photos',
        data: {},
        file: { data: Buffer.from(await p.arrayBuffer()), mimetype: p.type, name: p.name || 'foto.webp', size: p.size },
        overrideAccess: true,
        depth: 0,
      })
      photoIds.push(doc.id)
    }
    await payload.create({
      collection: 'leads',
      overrideAccess: true,
      depth: 0,
      data: {
        ...valid.value,
        service,
        photos: photoIds,
        consentTextVersion: KVKK_TEXT_VERSION,
        locale,
        sourcePage: text(fd, 'sourcePage', 300) || undefined,
        utm: pickUtm(Object.fromEntries([...fd.entries()].filter((e): e is [string, string] => typeof e[1] === 'string'))),
      },
    })
  } catch (err) {
    payload.logger.error({ err: safeErr(err) }, 'lead save failed')
    // Don't keep personal photos that no lead points to.
    for (const id of photoIds) await payload.delete({ collection: 'lead-photos', id, overrideAccess: true }).catch(() => {})
    return { status: 'error', form: 'SaveFailed' }
  }
  return { status: 'success' }
}
