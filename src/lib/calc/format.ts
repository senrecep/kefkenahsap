import { parseDecimal } from './number'

export const ISTANBUL = 'Europe/Istanbul'

// Latin digits in every locale (the site's rule for ar too): server and browser ICU then format alike.
const nu = { numberingSystem: 'latn' } as const

/** m³ with three decimals; a volume too small to show as 0,001 reads "<0,001", never a bare 0 (bug D). */
export function formatM3(m3: number, locale: string): string {
  const f = new Intl.NumberFormat(locale, { ...nu, minimumFractionDigits: 3, maximumFractionDigits: 3 })
  return m3 > 0 && m3 < 0.0005 ? `<${f.format(0.001)}` : f.format(m3)
}

/** Integer kuruş as Turkish lira with kuruş, in the page's number format. */
export const formatMoney = (kurus: number, locale: string) =>
  new Intl.NumberFormat(locale, { ...nu, style: 'currency', currency: 'TRY', currencyDisplay: 'narrowSymbol' }).format(kurus / 100)

/** Date and time in Istanbul, whatever the device's time zone (the label "TSİ" comes from the messages). */
export const formatStamp = (date: Date, locale: string) =>
  new Intl.DateTimeFormat(locale, { ...nu, dateStyle: 'long', timeStyle: 'short', timeZone: ISTANBUL }).format(date)

/**
 * The value of a typed field as the page read it (owner decision 2026-10-19): money in lira with kuruş, other numbers
 * without grouping ("1.000" on tr shows 1000). Null when the field is empty, unreadable, or already reads as typed.
 */
export function echoValue(raw: string, kind: 'money' | 'number', locale: string): string | null {
  const r = parseDecimal(raw, locale)
  if (!raw.trim() || !r.ok) return null
  const value = Number(r.value.n) / 10 ** r.value.s
  const text =
    kind === 'money'
      ? formatMoney(Math.round(value * 100), locale)
      : new Intl.NumberFormat(locale, { ...nu, useGrouping: false, maximumFractionDigits: 6 }).format(value)
  return text === raw.trim() ? null : text
}
