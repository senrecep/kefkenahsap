'use client'

import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'

import type { Quote, QuoteInput } from '@/lib/calc/quote'

import { buildSheet, type SheetLine } from './sheet'
import type { CalcUi } from './ui'

/**
 * The "PDF olarak kaydet" page: shown only in print (styles.css hides the site chrome around it). Same content and
 * branding as the PNG. The time is the moment of printing (`beforeprint`: the button and the browser menu alike).
 */
export function PrintSheet({ state, quote, ui, locale, logoSrc }: { state: QuoteInput; quote: Quote; ui: CalcUi; locale: string; logoSrc: string }) {
  const [printedAt, setPrintedAt] = useState<Date | null>(null)
  useEffect(() => {
    const before = () => flushSync(() => setPrintedAt(new Date()))
    window.addEventListener('beforeprint', before)
    return () => window.removeEventListener('beforeprint', before)
  }, [])
  const s = buildSheet(state, quote, ui, locale, printedAt)
  return (
    <section data-calc-print className="relative hidden text-[11pt] leading-snug text-ink print:block">
      <img src={logoSrc} alt="" aria-hidden className="pointer-events-none fixed top-1/2 left-1/2 w-[70%] max-w-none -translate-x-1/2 -translate-y-1/2 opacity-[0.06]" />
      <header className="flex items-start justify-between gap-6 border-b border-ink pb-4">
        <img src={logoSrc} alt="Kefken Ahşap" className="h-12 w-auto" />
        {s.stamp && <p className="text-end text-ink-soft">{s.stamp}</p>}
      </header>
      <p className="mt-5 font-[family-name:var(--font-display)] text-[20pt] font-semibold">{s.title}</p>
      {s.customer && <p className="mt-1">{s.customer}</p>}
      {s.note && <p className="mt-2 whitespace-pre-line text-ink-soft">{s.note}</p>}
      {s.timber.length > 0 && <Block title={ui.timber} lines={s.timber} />}
      {s.extras.length > 0 && <Block title={ui.extras} lines={s.extras} />}
      <dl className="mt-6 ms-auto max-w-[24rem] tabular-nums">
        {s.totals.map((l) => (
          <div key={l.text} className="flex justify-between gap-6 border-b border-line py-1.5">
            <dt className={l.strong ? 'font-semibold' : 'text-ink-soft'}>{l.text}</dt>
            <dd className={l.strong ? 'font-semibold' : ''}>
              <bdi>{l.value}</bdi>
            </dd>
          </div>
        ))}
        <div className="flex justify-between gap-6 border-t-2 border-ink pt-2 text-[15pt] font-semibold">
          <dt>{s.grand.text}</dt>
          <dd>
            <bdi>{s.grand.value}</bdi>
          </dd>
        </div>
      </dl>
      <footer className="mt-8 border-t border-line pt-3 text-[9.5pt] text-ink-soft">
        {s.footer.map((f) => (
          <p key={f}>{f}</p>
        ))}
      </footer>
    </section>
  )
}

function Block({ title, lines }: { title: string; lines: SheetLine[] }) {
  return (
    <section className="mt-6 break-inside-avoid">
      <p className="border-b border-line pb-1 font-[family-name:var(--font-display)] text-[13pt] font-semibold">{title}</p>
      <ul>
        {lines.map((l, i) => (
          <li key={i} className="flex items-baseline justify-between gap-6 border-b border-line py-1.5 tabular-nums">
            <span>
              <bdi>{l.text}</bdi>
              {l.sub && <span className="block text-[9.5pt] text-ink-soft">{l.sub}</span>}
            </span>
            <bdi className="shrink-0">{l.value}</bdi>
          </li>
        ))}
      </ul>
    </section>
  )
}
