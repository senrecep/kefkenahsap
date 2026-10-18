import { Result } from 'tsentials/result'

import { normalizeTrPhone, whatsappUrl } from '@/lib/whatsapp'

type Settings = {
  whatsappNumber?: string | null
  phones?: { number: string; whatsapp?: boolean | null; label?: string | null }[] | null
  whatsappTemplates?: Partial<Record<'default' | 'category' | 'project' | 'image' | 'contact', string | null>> | null
}
export type WaContext = { kind: 'default' | 'category' | 'project' | 'image' | 'contact'; vars?: Record<string, string | undefined> }

/** WhatsApp deep link for the current page, or null when no mobile number is configured. */
export function waLink(s: Settings, ctx: WaContext = { kind: 'default' }): string | null {
  const phone = s.whatsappNumber || s.phones?.find((p) => p.whatsapp)?.number
  if (!phone) return null
  const template = s.whatsappTemplates?.[ctx.kind] || s.whatsappTemplates?.default || undefined
  const r = whatsappUrl({ phone, template: template ?? undefined, vars: ctx.vars })
  return Result.isSuccess(r) ? r.value : null
}

/** tel: link for the first phone (E.164). */
export function telLink(s: Settings): { href: string; label: string } | null {
  const p = s.phones?.[0]
  if (!p) return null
  const r = normalizeTrPhone(p.number)
  return Result.isSuccess(r) ? { href: `tel:+${r.value}`, label: p.number } : null
}

type Address = { street?: string | null; district?: string | null; city?: string | null; postalCode?: string | null; mapUrl?: string | null }

/** "Yol tarifi" link: the admin's Google Maps link, else a Maps search of the address (the click-to-load map is LocationMap, #143). */
export function directionsUrl(a: Address | null | undefined): string | null {
  if (a?.mapUrl) return a.mapUrl
  const q = [a?.street, a?.district, a?.city].filter(Boolean).join(', ')
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null
}
