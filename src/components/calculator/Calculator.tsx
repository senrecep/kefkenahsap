'use client'

import { Copy, FileDown, ImageDown, Plus, Save, Share2, Trash2 } from 'lucide-react'
import { useEffect, useId, useMemo, useReducer, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react'
import type { AppError } from 'tsentials/errors'

import { buttonClass } from '@/components/ui/button'
import { decodeQuote, encodeQuote, isFilled, MAX_ROWS } from '@/lib/calc/codec'
import { formatM3, formatMoney, ISTANBUL } from '@/lib/calc/format'
import { parseRemembered, parseRememberedV1, parseSaved, remember, saveEntry, type SavedEntry } from '@/lib/calc/memory'
import {
  computeQuote,
  emptyExtra,
  emptyQuote,
  emptyTimber,
  EXTRA_UNITS,
  LENGTH_UNITS,
  VAT_RATES,
  type ExtraInput,
  type LengthUnit,
  type QuoteInput,
  type QuoteMeta,
  type TimberInput,
  type VatRate,
} from '@/lib/calc/quote'

import { PrintSheet } from './PrintSheet'
import { fill, type CalcUi } from './ui'

const HASH = '#c='
const SAVED_KEY = 'kefken.calc.saved.v1'
const EXTRAS_KEY = 'kefken.calc.extras.v2'
const EXTRAS_KEY_V1 = 'kefken.calc.extras.v1' // prices read with the page's rules before #236; migrated on read

type T = TimberInput & { id: number }
type X = ExtraInput & { id: number }
type State = Omit<QuoteInput, 'timber' | 'extras'> & { timber: T[]; extras: X[] }

// Row keys (and input ids) derived from the state itself: the reducer stays pure, server and client agree.
const withIds = (q: QuoteInput): State => ({ ...q, timber: q.timber.map((r, i) => ({ ...r, id: i + 1 })), extras: q.extras.map((r, i) => ({ ...r, id: q.timber.length + i + 1 })) })
const newId = (s: State) => Math.max(0, ...s.timber.map((r) => r.id), ...s.extras.map((r) => r.id)) + 1

type Action =
  | { type: 'timber'; id: number; field: keyof TimberInput; value: string }
  | { type: 'addTimber' }
  | { type: 'dupTimber'; id: number }
  | { type: 'removeTimber'; id: number }
  | { type: 'extra'; id: number; patch: Partial<ExtraInput> }
  | { type: 'addExtra' }
  | { type: 'removeExtra'; id: number }
  | { type: 'unit'; index: number; unit: LengthUnit }
  | { type: 'waste'; value: string }
  | { type: 'vat'; on?: boolean; rate?: VatRate }
  | { type: 'meta'; field: keyof QuoteMeta; value: string }
  | { type: 'load'; quote: QuoteInput }

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'timber':
      return { ...s, timber: s.timber.map((r) => (r.id === a.id ? { ...r, [a.field]: a.value } : r)) }
    case 'addTimber':
      return s.timber.length >= MAX_ROWS ? s : { ...s, timber: [...s.timber, { ...emptyTimber(), id: newId(s) }] }
    case 'dupTimber': {
      if (s.timber.length >= MAX_ROWS) return s
      const i = s.timber.findIndex((r) => r.id === a.id)
      return { ...s, timber: [...s.timber.slice(0, i + 1), { ...s.timber[i]!, id: newId(s) }, ...s.timber.slice(i + 1)] }
    }
    case 'removeTimber': {
      const timber = s.timber.filter((r) => r.id !== a.id)
      return { ...s, timber: timber.length ? timber : [{ ...emptyTimber(), id: newId(s) }] }
    }
    case 'extra':
      return { ...s, extras: s.extras.map((r) => (r.id === a.id ? { ...r, ...a.patch } : r)) }
    case 'addExtra':
      return s.extras.length >= MAX_ROWS ? s : { ...s, extras: [...s.extras, { ...emptyExtra(), id: newId(s) }] }
    case 'removeExtra':
      return { ...s, extras: s.extras.filter((r) => r.id !== a.id) }
    case 'unit':
      return { ...s, units: s.units.map((u, i) => (i === a.index ? a.unit : u)) as State['units'] }
    case 'waste':
      return { ...s, waste: a.value }
    case 'vat':
      return { ...s, vat: { on: a.on ?? s.vat.on, rate: a.rate ?? s.vat.rate } }
    case 'meta':
      return { ...s, meta: { ...s.meta, [a.field]: a.value } }
    case 'load':
      return withIds(a.quote)
  }
}

// Device storage can be missing or refused (private mode, blocked site data): every access is guarded. It is read as
// an external store, so the server render (and hydration) see nothing saved and the lists appear right after.
const listeners = new Set<() => void>()
const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set: (k: string, v: unknown) => {
    try {
      localStorage.setItem(k, JSON.stringify(v))
      listeners.forEach((l) => l())
      return true
    } catch {
      return false
    }
  },
  subscribe: (l: () => void) => {
    listeners.add(l)
    window.addEventListener('storage', l)
    return () => {
      listeners.delete(l)
      window.removeEventListener('storage', l)
    }
  },
}
const useStored = (key: string) => useSyncExternalStore(store.subscribe, () => store.get(key), () => null)
const track = (event: string) => window.umami?.track(event)
const errKey = (section: string, row: number, field: string) => `${section}:${row}:${field}`
const errorMap = (errors: AppError[]) => new Map(errors.map((e) => [errKey(String(e.metadata?.get('section')), Number(e.metadata?.get('row')), String(e.metadata?.get('field'))), e.code]))

// Shared field styles (DESIGN.md Inputs): white, ink 25% border, 10px radius, 16px text, green border on focus.
const fieldCls =
  'block min-h-12 w-full rounded-[var(--radius-control)] border bg-white px-3.5 text-base text-ink tabular-nums placeholder:text-ink-soft focus:border-action aria-[invalid=true]:border-error'
const labelCls = 'mb-1.5 block font-[family-name:var(--font-display)] text-[0.875rem] font-semibold text-ink'
const iconBtn =
  'inline-flex size-12 items-center justify-center rounded-[var(--radius-control)] text-ink-soft transition-colors duration-150 hover:bg-mist hover:text-ink disabled:opacity-40'

export type CalculatorProps = { locale: string; ui: CalcUi; logoSrc: string }

export function Calculator({ locale, ui, logoSrc }: CalculatorProps) {
  const [state, dispatch] = useReducer(reducer, undefined, () => withIds(emptyQuote()))
  const [touched, setTouched] = useState<Set<string>>(() => new Set())
  const [showAll, setShowAll] = useState(false)
  const [status, setStatus] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null)
  const savedRaw = useStored(SAVED_KEY)
  const memoryRaw = useStored(EXTRAS_KEY)
  const memoryV1 = useStored(EXTRAS_KEY_V1)
  const saved = useMemo(() => parseSaved(savedRaw), [savedRaw])
  const memory = useMemo(() => (memoryRaw === null ? parseRememberedV1(memoryV1) : parseRemembered(memoryRaw)), [memoryRaw, memoryV1])
  const [savedId, setSavedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [live, setLive] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const uid = useId()

  // Totals are derived from the current rows on every render (bug E: no watcher, no stale copy).
  const quote = useMemo(() => computeQuote(state), [state])
  const errors = useMemo(() => errorMap(quote.errors), [quote.errors])
  const filled = isFilled(state)
  const money = (k: number) => formatMoney(k, locale)
  // No grouping: a lone "20.000" is ambiguous and rejected (number.ts).
  const priceExample = new Intl.NumberFormat(locale, { numberingSystem: 'latn', useGrouping: false }).format(20000)

  // A shared link (#c=…) is read after hydration only (the server render is the empty form), in a microtask: it runs in
  // a background tab too (requestAnimationFrame does not). Until it has run, the address writer below leaves the URL
  // alone, so an unread link is never replaced (#236 review). `data-ready` marks the hydrated island for e2e.
  const hashRead = useRef(false)
  useEffect(() => {
    root.current?.setAttribute('data-ready', '')
    let live = true
    const open = () => {
      if (!live) return
      hashRead.current = true
      if (!location.hash.startsWith(HASH)) return
      const r = decodeQuote(location.hash.slice(HASH.length))
      if (r.ok) dispatch({ type: 'load', quote: r.value })
      else setStatus({ text: ui.linkInvalid, tone: 'error' })
    }
    queueMicrotask(open)
    window.addEventListener('hashchange', open)
    return () => {
      live = false
      window.removeEventListener('hashchange', open)
    }
  }, [ui.linkInvalid])

  // The address always carries the current calculation (bookmarkable); a fragment never reaches the server or its logs.
  useEffect(() => {
    const id = setTimeout(() => {
      if (!hashRead.current) return
      const url = `${location.pathname}${location.search}${filled ? HASH + encodeQuote(state) : ''}`
      if (url !== `${location.pathname}${location.search}${location.hash}`) history.replaceState(history.state, '', url)
    }, 300)
    return () => clearTimeout(id)
  }, [state, filled])

  // Screen readers hear the total once typing pauses, not on every key.
  const totalText = money(quote.totals.grandKurus)
  useEffect(() => {
    const id = setTimeout(() => setLive(filled ? fill(ui.totalLive, { total: totalText }) : ''), 900)
    return () => clearTimeout(id)
  }, [totalText, filled, ui.totalLive])

  // Extra items are remembered when the user leaves or acts on the page, never per keystroke.
  const rememberExtras = () => {
    const valid = state.extras.filter((_, i) => quote.extras[i]?.ok && quote.extras[i].value)
    if (!valid.length) return
    store.set(EXTRAS_KEY, remember(memory, valid, new Date()))
  }
  const rememberRef = useRef(rememberExtras)
  useEffect(() => {
    rememberRef.current = rememberExtras
  })
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && rememberRef.current()
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [])

  /** Gate for share/save/export: something typed and nothing invalid; otherwise show every error and focus the first. */
  const ready = () => {
    if (!filled) return setStatus({ text: ui.nothingYet, tone: 'error' }), false
    if (!quote.ok) {
      setShowAll(true)
      setStatus({ text: ui.fixErrors, tone: 'error' })
      requestAnimationFrame(() => root.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return false
    }
    rememberExtras()
    return true
  }

  const shareLink = async () => {
    if (!ready()) return
    // Built from the current state, not the address bar (which is updated 300 ms later).
    const url = `${location.origin}${location.pathname}${location.search}${HASH}${encodeQuote(state)}`
    track('calc_share_link')
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ title: state.meta.job || ui.untitled, url }).catch(() => undefined)
      return
    }
    const ok = await navigator.clipboard?.writeText(url).then(() => true, () => false)
    setStatus(ok ? { text: ui.copied, tone: 'ok' } : { text: url, tone: 'ok' })
  }

  const save = () => {
    if (!ready()) return
    const id = savedId ?? crypto.randomUUID()
    const title = [state.meta.job, state.meta.customer].filter((s) => s.trim()).join(' · ') || ui.untitled
    const next = saveEntry(saved, { id, title, savedAt: new Date().toISOString(), link: encodeQuote(state) })
    track('calc_save_local')
    if (!store.set(SAVED_KEY, next)) return setStatus({ text: ui.storageOff, tone: 'error' })
    setSavedId(id)
    setStatus({ text: ui.savedOk, tone: 'ok' })
  }

  const openSaved = (e: SavedEntry) => {
    const r = decodeQuote(e.link)
    if (!r.ok) return setStatus({ text: ui.linkInvalid, tone: 'error' })
    dispatch({ type: 'load', quote: r.value })
    setSavedId(e.id)
    setTouched(new Set())
    setShowAll(false)
    setStatus(null)
    root.current?.scrollIntoView({ block: 'start' })
  }
  const deleteSaved = (id: string) => {
    store.set(SAVED_KEY, saved.filter((s) => s.id !== id))
    if (savedId === id) setSavedId(null)
  }

  const exportPng = async () => {
    if (!ready()) return
    setBusy(true)
    track('calc_export_png')
    try {
      const { renderQuoteImage, shareOrDownload } = await import('./export-image')
      const date = new Date()
      const blob = await renderQuoteImage({ state, quote, ui, locale, date, logoSrc, rtl: getComputedStyle(document.documentElement).direction === 'rtl' })
      await shareOrDownload(blob, date, state.meta.job || ui.title)
      setStatus(null)
    } catch {
      setStatus({ text: ui.exportFailed, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const exportPdf = () => {
    if (!ready()) return
    track('calc_export_pdf')
    window.print() // PrintSheet stamps the time on `beforeprint`
  }

  const reset = () => {
    if (!confirm(ui.resetConfirm)) return
    dispatch({ type: 'load', quote: emptyQuote() })
    setSavedId(null)
    setTouched(new Set())
    setShowAll(false)
    setStatus(null)
  }

  const touch = (k: string) => setTouched((s) => (s.has(k) ? s : new Set(s).add(k)))
  const errorFor = (k: string) => (showAll || touched.has(k) ? errors.get(k) : undefined)

  // Enter moves to the next field, like a paper form (no submit).
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement
    if (e.key !== 'Enter' || t.tagName !== 'INPUT' || (t as HTMLInputElement).type === 'checkbox') return
    e.preventDefault()
    const fields = [...(root.current?.querySelectorAll<HTMLElement>('input:not([disabled]), select') ?? [])]
    fields[fields.indexOf(t) + 1]?.focus()
  }

  const removeTimber = (id: number, index: number) => {
    dispatch({ type: 'removeTimber', id })
    // Focus stays in the list: the row that took this place, else the add button.
    requestAnimationFrame(() => {
      const rows = root.current?.querySelectorAll<HTMLElement>('[data-timber-row] input')
      const target = root.current?.querySelector<HTMLElement>(`[data-timber-row]:nth-child(${index + 1}) input`) ?? root.current?.querySelector<HTMLElement>('[data-add-timber]')
      ;(target ?? rows?.[0])?.focus()
    })
  }
  const removeExtra = (id: number, index: number) => {
    dispatch({ type: 'removeExtra', id })
    requestAnimationFrame(() =>
      (root.current?.querySelector<HTMLElement>(`[data-extra-row]:nth-child(${index + 1}) input`) ?? root.current?.querySelector<HTMLElement>('[data-add-extra]'))?.focus(),
    )
  }

  const dimLabels = [ui.thickness, ui.width, ui.length] as const
  const t = quote.totals
  const vatRateText = fill(ui.vatLine, { rate: state.vat.rate })

  return (
    <div ref={root} onKeyDown={onKeyDown} className="grid gap-x-12 gap-y-10 xl:grid-cols-[minmax(0,1fr)_23rem]">
      <div className="min-w-0 print:hidden">
        {/* Quote details: optional, quiet until opened (or filled from a link). */}
        <details className="group border-y border-line" open={!!(state.meta.customer || state.meta.job || state.meta.note) || undefined}>
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 font-[family-name:var(--font-display)] text-[1.05rem] font-semibold text-ink [&::-webkit-details-marker]:hidden">
            <span>
              {ui.quoteInfo} <span className="font-[family-name:var(--font-body)] font-normal text-ink-soft">({ui.optional})</span>
            </span>
            <Plus aria-hidden size={20} strokeWidth={1.75} className="shrink-0 text-ink-soft transition-transform group-open:rotate-45" />
          </summary>
          <div className="grid gap-4 pb-6 sm:grid-cols-2">
            <TextField id={`${uid}-customer`} label={ui.customer} value={state.meta.customer} maxLength={80} onChange={(v) => dispatch({ type: 'meta', field: 'customer', value: v })} />
            <TextField id={`${uid}-job`} label={ui.job} value={state.meta.job} maxLength={120} onChange={(v) => dispatch({ type: 'meta', field: 'job', value: v })} />
            <div className="sm:col-span-2">
              <label htmlFor={`${uid}-note`} className={labelCls}>
                {ui.note}
              </label>
              <textarea
                id={`${uid}-note`}
                rows={3}
                maxLength={500}
                value={state.meta.note}
                onChange={(e) => dispatch({ type: 'meta', field: 'note', value: e.target.value })}
                className={`${fieldCls} border-ink/25 py-3`}
              />
            </div>
            <p className="text-[0.95rem] text-ink-soft sm:col-span-2">{ui.metaHint}</p>
          </div>
        </details>

        {/* Timber */}
        <section aria-labelledby={`${uid}-timber`} className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <h2 id={`${uid}-timber`} className="text-[1.5rem] md:text-[1.75rem]">
              {ui.timber}
            </h2>
            <fieldset className="flex flex-wrap items-end gap-3">
              <legend className="sr-only">{ui.units}</legend>
              {dimLabels.map((label, i) => (
                <label key={label} className="grid gap-1 text-[0.875rem] text-ink-soft">
                  <span className="font-[family-name:var(--font-display)] font-semibold text-ink">{label}</span>
                  <select
                    value={state.units[i]}
                    onChange={(e) => dispatch({ type: 'unit', index: i, unit: e.target.value as LengthUnit })}
                    className="min-h-11 rounded-[var(--radius-control)] border border-ink/25 bg-white ps-3 pe-8 text-base text-ink focus:border-action"
                  >
                    {LENGTH_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </fieldset>
          </div>

          {/* Column heads (desktop): the inputs keep their own labels for assistive tech. */}
          <div aria-hidden className="mt-6 hidden gap-3 border-b border-line pb-2 text-[0.875rem] text-ink-soft md:grid md:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.5fr)_8.5rem_6rem]">
            {dimLabels.map((l, i) => (
              <span key={l} className="font-[family-name:var(--font-display)] font-semibold text-ink">
                {l} <span className="font-[family-name:var(--font-body)] font-normal text-ink-soft">({state.units[i]})</span>
              </span>
            ))}
            <span className="font-[family-name:var(--font-display)] font-semibold text-ink">{ui.pieces}</span>
            <span className="font-[family-name:var(--font-display)] font-semibold text-ink">
              {ui.price} <span className="font-[family-name:var(--font-body)] font-normal text-ink-soft">({ui.perM3})</span>
            </span>
            <span className="text-end font-[family-name:var(--font-display)] font-semibold text-ink">{ui.volume} · {ui.amount}</span>
          </div>

          <ol className="mt-4 md:mt-0">
            {state.timber.map((r, i) => {
              const line = quote.timber[i]
              const value = line?.ok ? line.value : null
              const rowName = fill(ui.row, { n: i + 1 })
              const field = (f: keyof TimberInput, label: string, unit: string, opts: { numeric?: boolean; example: string; className: string }) => {
                const k = errKey('timber', i, f)
                return (
                  <NumberField
                    key={f}
                    id={`${uid}-t${r.id}${f}`}
                    label={label}
                    srSuffix={`, ${rowName}`}
                    unit={unit}
                    value={r[f]}
                    numeric={opts.numeric}
                    placeholder={fill(ui.placeholder, { value: opts.example })}
                    error={errorFor(k) && ui.errors[errorFor(k) as keyof CalcUi['errors']]}
                    className={opts.className}
                    onChange={(v) => dispatch({ type: 'timber', id: r.id, field: f, value: v })}
                    onBlur={() => touch(k)}
                  />
                )
              }
              return (
                <li key={r.id} data-timber-row className="border-b border-line py-5 md:py-3">
                  <p className="mb-3 text-[0.95rem] font-semibold text-ink-soft md:hidden">{rowName}</p>
                  <div className="grid grid-cols-6 items-start gap-3 md:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.5fr)_8.5rem_6rem]">
                    {field('t', ui.thickness, state.units[0], { example: '5', className: 'col-span-2 md:col-span-1' })}
                    {field('w', ui.width, state.units[1], { example: '10', className: 'col-span-2 md:col-span-1' })}
                    {field('l', ui.length, state.units[2], { example: '400', className: 'col-span-2 md:col-span-1' })}
                    {field('q', ui.pieces, ui.pieceShort, { numeric: true, example: '10', className: 'col-span-2 md:col-span-1' })}
                    {field('p', ui.price, ui.perM3, { example: priceExample, className: 'col-span-4 md:col-span-1' })}
                    <p className="col-span-4 flex min-h-12 flex-col justify-center text-start tabular-nums md:col-span-1 md:items-end md:text-end">
                      <span className="sr-only">{`${ui.volume} · ${ui.amount}, ${rowName}: `}</span>
                      <bdi className="font-[family-name:var(--font-display)] font-semibold text-ink">{value ? `${formatM3(value.m3, locale)} m³` : '—'}</bdi>
                      <bdi className="text-[0.95rem] text-ink-soft">{value && value.kurus !== null ? money(value.kurus) : ''}</bdi>
                    </p>
                    <div className="col-span-2 flex min-h-12 items-center justify-end md:col-span-1">
                      <button type="button" className={iconBtn} aria-label={`${ui.duplicateRow}, ${rowName}`} title={ui.duplicateRow} onClick={() => dispatch({ type: 'dupTimber', id: r.id })} disabled={state.timber.length >= MAX_ROWS}>
                        <Copy aria-hidden size={20} strokeWidth={1.75} />
                      </button>
                      <button type="button" className={iconBtn} aria-label={`${ui.removeRow}, ${rowName}`} title={ui.removeRow} onClick={() => removeTimber(r.id, i)}>
                        <Trash2 aria-hidden size={20} strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                  {value?.suspiciousLength && <p className="mt-2 text-[0.95rem] text-ink">{ui.suspiciousLength}</p>}
                </li>
              )
            })}
          </ol>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-5">
            <button
              type="button"
              data-add-timber
              className={buttonClass.outline}
              disabled={state.timber.length >= MAX_ROWS}
              onClick={() => {
                dispatch({ type: 'addTimber' })
                track('calc_row_add')
                requestAnimationFrame(() => root.current?.querySelector<HTMLElement>('[data-timber-row]:last-child input')?.focus())
              }}
            >
              <Plus aria-hidden size={20} strokeWidth={1.75} />
              {ui.addRow}
            </button>
            <NumberField
              id={`${uid}-waste`}
              label={ui.waste}
              unit="%"
              value={state.waste}
              placeholder="0"
              hint={ui.wasteHint}
              error={errorFor('waste:0:waste') && ui.errors[errorFor('waste:0:waste') as keyof CalcUi['errors']]}
              className="w-full sm:w-56"
              onChange={(v) => dispatch({ type: 'waste', value: v })}
              onBlur={() => touch('waste:0:waste')}
            />
          </div>
        </section>

        {/* Extra items */}
        <section aria-labelledby={`${uid}-extras`} className="mt-14">
          <h2 id={`${uid}-extras`} className="text-[1.5rem] md:text-[1.75rem]">
            {ui.extras}
          </h2>
          <p className="mt-1 text-ink-soft">{ui.extrasHint}</p>
          <datalist id={`${uid}-remembered`}>
            {memory.map((m) => (
              <option key={m.d} value={m.d} />
            ))}
          </datalist>
          {state.extras.length > 0 && (
            <div aria-hidden className="mt-6 hidden gap-3 border-b border-line pb-2 font-[family-name:var(--font-display)] text-[0.875rem] font-semibold text-ink md:grid md:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.3fr)_8.5rem_3rem]">
              <span>{ui.description}</span>
              <span>{ui.quantity}</span>
              <span>{ui.unit}</span>
              <span>
                {ui.unitPrice} <span className="font-[family-name:var(--font-body)] font-normal text-ink-soft">(₺)</span>
              </span>
              <span className="text-end">{ui.amount}</span>
            </div>
          )}
          <ol className="mt-4 md:mt-0">
            {state.extras.map((r, i) => {
              const line = quote.extras[i]
              const value = line?.ok ? line.value : null
              const rowName = fill(ui.item, { n: i + 1 })
              const lump = r.u === 'goturu'
              const err = (f: string) => {
                const c = errorFor(errKey('extras', i, f))
                return c && ui.errors[c as keyof CalcUi['errors']]
              }
              const descId = `${uid}-x${r.id}d`
              return (
                <li key={r.id} data-extra-row className="border-b border-line py-5 md:py-3">
                  <p className="mb-3 text-[0.95rem] font-semibold text-ink-soft md:hidden">{rowName}</p>
                  <div className="grid grid-cols-6 items-start gap-3 md:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.3fr)_8.5rem_3rem]">
                    <div className="col-span-6 md:col-span-1">
                      <label htmlFor={descId} className={`${labelCls} md:sr-only`}>
                        {ui.description}
                        <span className="sr-only">, {rowName}</span>
                      </label>
                      <input
                        id={descId}
                        type="text"
                        list={`${uid}-remembered`}
                        autoComplete="off"
                        enterKeyHint="next"
                        maxLength={80}
                        value={r.d}
                        aria-invalid={!!err('d') || undefined}
                        aria-describedby={err('d') ? `${descId}-e` : undefined}
                        onChange={(e) => {
                          const d = e.target.value
                          // Picking a remembered item fills its unit and last price, unless a price is already typed.
                          const hit = memory.find((m) => m.d.toLocaleLowerCase('tr') === d.trim().toLocaleLowerCase('tr'))
                          dispatch({ type: 'extra', id: r.id, patch: hit && !r.p.trim() ? { d, u: hit.u, p: hit.p } : { d } })
                        }}
                        onBlur={() => touch(errKey('extras', i, 'd'))}
                        className={`${fieldCls} ${err('d') ? 'border-error' : 'border-ink/25'}`}
                      />
                      {err('d') && <FieldError id={`${descId}-e`}>{err('d')}</FieldError>}
                    </div>
                    <NumberField
                      id={`${uid}-x${r.id}q`}
                      label={ui.quantity}
                      srSuffix={`, ${rowName}`}
                      value={lump ? '1' : r.q}
                      disabled={lump}
                      hint={lump ? ui.lumpSum : undefined}
                      hintHidden
                      error={err('q')}
                      className="col-span-2 md:col-span-1"
                      onChange={(v) => dispatch({ type: 'extra', id: r.id, patch: { q: v } })}
                      onBlur={() => touch(errKey('extras', i, 'q'))}
                    />
                    <div className="col-span-2 md:col-span-1">
                      <label htmlFor={`${uid}-x${r.id}u`} className={`${labelCls} md:sr-only`}>
                        {ui.unit}
                        <span className="sr-only">, {rowName}</span>
                      </label>
                      <select
                        id={`${uid}-x${r.id}u`}
                        value={r.u}
                        onChange={(e) => dispatch({ type: 'extra', id: r.id, patch: { u: e.target.value as ExtraInput['u'] } })}
                        className={`${fieldCls} border-ink/25 px-2.5`}
                      >
                        {EXTRA_UNITS.map((u) => (
                          <option key={u} value={u}>
                            {ui.unitNames[u]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <NumberField
                      id={`${uid}-x${r.id}p`}
                      label={ui.unitPrice}
                      srSuffix={`, ${rowName}`}
                      unit="₺"
                      value={r.p}
                      placeholder={fill(ui.placeholder, { value: '180' })}
                      error={err('p')}
                      className="col-span-2 md:col-span-1"
                      onChange={(v) => dispatch({ type: 'extra', id: r.id, patch: { p: v } })}
                      onBlur={() => touch(errKey('extras', i, 'p'))}
                    />
                    <p className="col-span-4 flex min-h-12 items-center font-[family-name:var(--font-display)] font-semibold tabular-nums md:col-span-1 md:justify-end">
                      <span className="sr-only">{`${ui.amount}, ${rowName}: `}</span>
                      <bdi>{value ? money(value.kurus) : '—'}</bdi>
                    </p>
                    <div className="col-span-2 flex min-h-12 items-center justify-end md:col-span-1">
                      <button type="button" className={iconBtn} aria-label={`${ui.removeExtra}, ${rowName}`} title={ui.removeExtra} onClick={() => removeExtra(r.id, i)}>
                        <Trash2 aria-hidden size={20} strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
          {state.extras.length === 0 && <p className="mt-4 border-y border-line py-4 text-ink-soft">{ui.extrasEmpty}</p>}
          <button
            type="button"
            data-add-extra
            className={`${buttonClass.outline} mt-5`}
            disabled={state.extras.length >= MAX_ROWS}
            onClick={() => {
              dispatch({ type: 'addExtra' })
              requestAnimationFrame(() => root.current?.querySelector<HTMLElement>('[data-extra-row]:last-child input')?.focus())
            }}
          >
            <Plus aria-hidden size={20} strokeWidth={1.75} />
            {ui.addExtra}
          </button>
        </section>
      </div>

      {/* Summary: sticky beside the rows on wide screens, after them on phones. */}
      <aside aria-labelledby={`${uid}-summary`} className="print:hidden xl:sticky xl:top-[calc(4.5rem+1.5rem)] xl:self-start">
        <div className="border-t-2 border-ink pt-4">
          <h2 id={`${uid}-summary`} className="text-[1.5rem]">
            {ui.summary}
          </h2>
          <dl className="mt-3 tabular-nums">
            <Line label={ui.timberVolume} value={`${formatM3(t.m3, locale)} m³`} />
            <Line label={ui.timberAmount} value={money(t.timberKurus)} />
            {t.wasteKurus > 0 || t.wasteM3 > 0 ? (
              <Line label={fill(ui.wasteLine, { rate: state.waste.trim() })} value={`+${formatM3(t.wasteM3, locale)} m³ · ${money(t.wasteKurus)}`} />
            ) : null}
            {state.extras.length > 0 && <Line label={ui.extrasAmount} value={money(t.extrasKurus)} />}
            <Line label={ui.subtotal} value={money(t.subtotalKurus)} strong />
          </dl>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3">
            <label className="flex min-h-11 cursor-pointer items-center gap-3">
              <input type="checkbox" checked={state.vat.on} onChange={(e) => dispatch({ type: 'vat', on: e.target.checked })} className="size-5 accent-action" />
              <span className="font-[family-name:var(--font-display)] text-[0.95rem] font-semibold">{ui.vatToggle}</span>
            </label>
            <label className="flex items-center gap-2 text-[0.95rem] text-ink-soft">
              <span className="sr-only">{ui.vatRate}</span>
              <select
                value={state.vat.rate}
                disabled={!state.vat.on}
                onChange={(e) => dispatch({ type: 'vat', rate: Number(e.target.value) as VatRate })}
                className="min-h-11 rounded-[var(--radius-control)] border border-ink/25 bg-white ps-3 pe-8 text-base text-ink focus:border-action disabled:opacity-50"
              >
                {VAT_RATES.map((r) => (
                  <option key={r} value={r}>
                    %{r}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <dl className="tabular-nums">
            {state.vat.on && <Line label={vatRateText} value={money(t.vatKurus)} />}
            <div className="flex items-baseline justify-between gap-4 pt-4">
              <dt className="font-[family-name:var(--font-display)] text-[1.05rem] font-semibold">{ui.total}</dt>
              <dd className="font-[family-name:var(--font-display)] text-[1.75rem] leading-tight font-semibold md:text-[2rem]">
                <bdi>{totalText}</bdi>
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-[0.95rem] text-ink-soft">{ui.exclVat}</p>
          <p className="mt-1 text-[0.95rem] text-ink-soft">{ui.disclaimer}</p>
          <p aria-live="polite" className="sr-only">
            {live}
          </p>

          <h3 className="sr-only">{ui.actions}</h3>
          <div className="mt-6 grid gap-3">
            <button type="button" onClick={exportPng} disabled={busy} className={buttonClass.primary}>
              <ImageDown aria-hidden size={20} strokeWidth={1.75} />
              {ui.exportPng}
            </button>
            <button type="button" onClick={shareLink} className={buttonClass.outline}>
              <Share2 aria-hidden size={20} strokeWidth={1.75} />
              {ui.copyLink}
            </button>
            <button type="button" onClick={exportPdf} className={buttonClass.outline}>
              <FileDown aria-hidden size={20} strokeWidth={1.75} />
              {ui.exportPdf}
            </button>
            <button type="button" onClick={save} className={buttonClass.outline}>
              <Save aria-hidden size={20} strokeWidth={1.75} />
              {ui.save}
            </button>
          </div>
          <p role="status" className={`mt-3 min-h-6 text-[0.95rem] break-words ${status?.tone === 'error' ? 'text-error' : 'text-ink'}`}>
            {status?.text}
          </p>

          <details className="group mt-4 border-y border-line">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between font-[family-name:var(--font-display)] font-semibold [&::-webkit-details-marker]:hidden">
              <span>
                {ui.savedList} <span className="font-[family-name:var(--font-body)] font-normal text-ink-soft">({saved.length})</span>
              </span>
              <Plus aria-hidden size={20} strokeWidth={1.75} className="text-ink-soft transition-transform group-open:rotate-45" />
            </summary>
            {saved.length ? (
              <ul className="pb-2">
                {saved.map((e) => (
                  <li key={e.id} className="flex items-center gap-2 border-t border-line py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{e.title}</span>
                      <span className="block text-[0.875rem] text-ink-soft">{new Date(e.savedAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short', numberingSystem: 'latn', timeZone: ISTANBUL })}</span>
                    </span>
                    <button type="button" onClick={() => openSaved(e)} className="min-h-11 rounded-[var(--radius-control)] px-3 font-[family-name:var(--font-display)] text-[0.95rem] font-semibold text-action hover:bg-mist hover:text-action-deep">
                      {ui.open}
                      <span className="sr-only">: {e.title}</span>
                    </button>
                    <button type="button" onClick={() => deleteSaved(e.id)} className={iconBtn} aria-label={`${ui.delete}: ${e.title}`} title={ui.delete}>
                      <Trash2 aria-hidden size={20} strokeWidth={1.75} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pb-3 text-ink-soft">{ui.savedEmpty}</p>
            )}
          </details>
          <button type="button" onClick={reset} className={`${buttonClass.quiet} mt-2`}>
            {ui.reset}
          </button>
        </div>
      </aside>

      <PrintSheet state={state} quote={quote} ui={ui} locale={locale} logoSrc={logoSrc} />
    </div>
  )
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5">
      <dt className={strong ? 'font-[family-name:var(--font-display)] font-semibold' : 'text-ink-soft'}>{label}</dt>
      <dd className={`text-end ${strong ? 'font-[family-name:var(--font-display)] font-semibold' : ''}`}>
        <bdi>{value}</bdi>
      </dd>
    </div>
  )
}

function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1.5 text-[0.9rem] leading-snug text-error">
      {children}
    </p>
  )
}

function TextField({ id, label, value, maxLength, onChange }: { id: string; label: string; value: string; maxLength: number; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      <input id={id} type="text" value={value} maxLength={maxLength} autoComplete="off" enterKeyHint="next" onChange={(e) => onChange(e.target.value)} className={`${fieldCls} border-ink/25`} />
    </div>
  )
}

/** A number as typed (text + decimal keypad), with its unit inside the field and its error tied to it. */
function NumberField(p: {
  id: string
  label: string
  srSuffix?: string
  unit?: string
  value: string
  numeric?: boolean
  placeholder?: string
  hint?: string
  hintHidden?: boolean
  error?: string | false
  disabled?: boolean
  className?: string
  onChange: (v: string) => void
  onBlur?: () => void
}) {
  const described = [p.error && `${p.id}-e`, p.hint && `${p.id}-h`].filter(Boolean).join(' ') || undefined
  return (
    <div className={p.className}>
      <label htmlFor={p.id} className={`${labelCls} ${p.srSuffix ? 'md:sr-only' : ''}`}>
        {p.label}
        {p.srSuffix && <span className="sr-only">{p.srSuffix}</span>}
      </label>
      <div className="relative" dir="ltr">
        <input
          id={p.id}
          type="text"
          inputMode={p.numeric ? 'numeric' : 'decimal'}
          enterKeyHint="next"
          autoComplete="off"
          spellCheck={false}
          value={p.value}
          placeholder={p.placeholder}
          disabled={p.disabled}
          aria-invalid={!!p.error || undefined}
          aria-describedby={described}
          onChange={(e) => p.onChange(e.target.value)}
          onBlur={p.onBlur}
          className={`${fieldCls} ${p.error ? 'border-error' : 'border-ink/25'} disabled:bg-mist ${p.unit ? (p.srSuffix ? 'pe-14 md:pe-3.5' : 'pe-14') : ''}`}
        />
        {p.unit && (
          <span aria-hidden className={`pointer-events-none absolute inset-y-0 end-3 flex items-center text-[0.95rem] text-ink-soft ${p.srSuffix ? 'md:hidden' : ''}`}>
            {p.unit}
          </span>
        )}
      </div>
      {p.error && <FieldError id={`${p.id}-e`}>{p.error}</FieldError>}
      {p.hint && (
        <p id={`${p.id}-h`} className={p.hintHidden ? 'sr-only' : 'mt-1.5 text-[0.9rem] text-ink-soft'}>
          {p.hint}
        </p>
      )}
    </div>
  )
}
