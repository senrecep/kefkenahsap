import { formatM3, formatMoney, formatStamp } from '@/lib/calc/format'
import type { Quote, QuoteInput } from '@/lib/calc/quote'

import { fill, type CalcUi } from './ui'

// Numbers with their units stay left-to-right inside Arabic text (canvas has no <bdi>): "2,5 × 12 × 300 cm", "0,216 m³".
const ltr = (s: string) => `\u2066${s}\u2069`

export type SheetLine = { text: string; sub?: string; value: string; strong?: boolean }
export type Sheet = {
  title: string
  customer?: string
  note?: string
  stamp?: string
  timber: SheetLine[]
  extras: SheetLine[]
  totals: SheetLine[]
  grand: SheetLine
  footer: string[]
}

/**
 * What the PNG and the print sheet show: the same lines as the screen, valid rows only (an export is blocked while any
 * row is invalid), with the quote details only when filled.
 */
export function buildSheet(state: QuoteInput, quote: Quote, ui: CalcUi, locale: string, date: Date | null): Sheet {
  const money = (k: number) => formatMoney(k, locale)
  const m3 = (v: number) => ltr(`${formatM3(v, locale)} m³`)
  const n = new Intl.NumberFormat(locale, { numberingSystem: 'latn', maximumFractionDigits: 4 }).format
  const [u0, u1, u2] = state.units
  const sameUnit = u0 === u1 && u1 === u2
  const tot = quote.totals
  const timber = state.timber.flatMap((r, i) => {
    const line = quote.timber[i]
    if (!line?.ok || !line.value) return []
    const [t, w, l] = line.value.dims.map(n)
    const dims = ltr(sameUnit ? `${t} × ${w} × ${l} ${u0}` : `${t} ${u0} × ${w} ${u1} × ${l} ${u2}`)
    const price = line.value.priceKurus === null ? undefined : ltr(`${money(line.value.priceKurus)}/m³`)
    return [{ text: `${dims} · ${ltr(n(line.value.pieces))} ${ui.pieceShort}`, sub: [m3(line.value.m3), price].filter(Boolean).join(' · '), value: line.value.kurus === null ? '—' : money(line.value.kurus) }]
  })
  const extras = state.extras.flatMap((r, i) => {
    const line = quote.extras[i]
    if (!line?.ok || !line.value) return []
    const qty = r.u === 'goturu' ? ui.unitNames.goturu : `${ltr(n(line.value.qty))} ${ui.unitNames[r.u]} × ${ltr(money(line.value.priceKurus))}`
    return [{ text: r.d.trim(), sub: qty, value: money(line.value.kurus) }]
  })
  const totals: SheetLine[] = [
    { text: ui.timberVolume, value: m3(tot.m3) },
    { text: ui.timberAmount, value: money(tot.timberKurus) },
    ...(tot.wasteKurus > 0 || tot.wasteM3 > 0 ? [{ text: fill(ui.wasteLine, { rate: state.waste.trim() }), value: `${ltr(`+${formatM3(tot.wasteM3, locale)} m³`)} · ${money(tot.wasteKurus)}` }] : []),
    ...(extras.length ? [{ text: ui.extrasAmount, value: money(tot.extrasKurus) }] : []),
    { text: ui.subtotal, value: money(tot.subtotalKurus), strong: true },
    ...(state.vat.on ? [{ text: fill(ui.vatLine, { rate: state.vat.rate }), value: money(tot.vatKurus) }] : []),
  ]
  const job = state.meta.job.trim()
  const customer = state.meta.customer.trim()
  const note = state.meta.note.trim()
  return {
    title: job || ui.title,
    ...(customer ? { customer: `${ui.quoteFor}: ${customer}` } : {}),
    ...(note ? { note } : {}),
    ...(date ? { stamp: `${formatStamp(date, locale)} ${ui.timeZone}` } : {}),
    timber,
    extras,
    totals,
    grand: { text: ui.total, value: money(tot.grandKurus), strong: true },
    footer: [ui.exclVat, ui.disclaimer, ui.prepared, 'kefkenahsap.com'],
  }
}
