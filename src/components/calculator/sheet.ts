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
  const [u0, u1, u2] = state.units
  const sameUnit = u0 === u1 && u1 === u2
  const t = quote.totals
  const timber = state.timber.flatMap((r, i) => {
    const line = quote.timber[i]
    if (!line?.ok || !line.value) return []
    const dims = ltr(sameUnit ? `${r.t.trim()} × ${r.w.trim()} × ${r.l.trim()} ${u0}` : `${r.t.trim()} ${u0} × ${r.w.trim()} ${u1} × ${r.l.trim()} ${u2}`)
    const price = line.value.kurus === null ? undefined : `${ltr(r.p.trim())} ${ui.perM3}`
    return [{ text: `${dims} · ${ltr(r.q.trim())} ${ui.pieceShort}`, sub: [m3(line.value.m3), price].filter(Boolean).join(' · '), value: line.value.kurus === null ? '—' : money(line.value.kurus) }]
  })
  const extras = state.extras.flatMap((r, i) => {
    const line = quote.extras[i]
    if (!line?.ok || !line.value) return []
    const qty = r.u === 'goturu' ? ui.unitNames.goturu : `${ltr(r.q.trim())} ${ui.unitNames[r.u]} × ${ltr(`${r.p.trim()} ₺`)}`
    return [{ text: r.d.trim(), sub: qty, value: money(line.value.kurus) }]
  })
  const totals: SheetLine[] = [
    { text: ui.timberVolume, value: m3(t.m3) },
    { text: ui.timberAmount, value: money(t.timberKurus) },
    ...(t.wasteKurus > 0 || t.wasteM3 > 0 ? [{ text: fill(ui.wasteLine, { rate: state.waste.trim() }), value: `${ltr(`+${formatM3(t.wasteM3, locale)} m³`)} · ${money(t.wasteKurus)}` }] : []),
    ...(extras.length ? [{ text: ui.extrasAmount, value: money(t.extrasKurus) }] : []),
    { text: ui.subtotal, value: money(t.subtotalKurus), strong: true },
    ...(state.vat.on ? [{ text: fill(ui.vatLine, { rate: state.vat.rate }), value: money(t.vatKurus) }] : []),
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
    grand: { text: ui.total, value: money(t.grandKurus), strong: true },
    footer: [ui.exclVat, ui.disclaimer, ui.prepared, 'kefkenahsap.com'],
  }
}
