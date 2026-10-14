'use client'

import { Check, ChevronDown, Globe } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'

import type { Locale } from '@/i18n/routing'

// Endonyms: each language is named in itself, never translated.
const NATIVE = { tr: 'Türkçe', en: 'English', ru: 'Русский', de: 'Deutsch', ar: 'العربية' } as const satisfies Record<Locale, string>

/** Follows the page's own <link rel="alternate" hreflang> (set by each page's metadata), so CMS slugs switch correctly. */
// locale, locales (the ones with content) and label come from the server Header, keeping the i18n runtime out of the client bundle.
// `menu`: a native <details> dropdown for the header; `list`: the same links laid out open, for the mobile menu panel.
export function LanguageSwitcher({
  locale,
  locales,
  label,
  variant = 'menu',
  className = '',
}: {
  locale: string
  locales: readonly string[]
  label: string
  variant?: 'menu' | 'list'
  className?: string
}) {
  const details = useRef<HTMLDetailsElement>(null)
  const labelId = useId()

  // <details> opens and closes on its own; this adds close on outside click, Escape and tab-out.
  useEffect(() => {
    const d = details.current
    if (!d) return
    const close = (focus: boolean) => {
      if (!d.open) return
      d.open = false
      if (focus) d.querySelector('summary')?.focus()
    }
    const onPointer = (e: PointerEvent) => !d.contains(e.target as Node) && close(false)
    // Return focus to the summary only if it was inside (a mouse open in Safari never focuses the summary).
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close(d.contains(document.activeElement))
    // A null relatedTarget (click on a non-focusable spot, window blur) is left to the pointer handler,
    // so a click on a link that does not take focus (Safari) still lands before the panel closes.
    const onFocusOut = (e: FocusEvent) => e.relatedTarget instanceof Node && !d.contains(e.relatedTarget) && close(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    d.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
      d.removeEventListener('focusout', onFocusOut)
    }
  }, [])

  // Real links (crawlable, work without JS); on click, prefer the page's own alternate URL.
  const onClick = (e: React.MouseEvent<HTMLAnchorElement>, target: string) => {
    if (target === locale) {
      e.preventDefault()
      if (details.current) details.current.open = false
      return
    }
    const alt = document.querySelector<HTMLLinkElement>(`link[rel="alternate"][hreflang="${target}"]`)
    if (alt?.href) {
      e.preventDefault()
      if (details.current) details.current.open = false // not restored open from the bfcache on Back
      window.location.assign(alt.href)
    }
  }

  const items = (row: string) =>
    locales.map((l) => (
      <li key={l}>
        <a href={`/${l}`} hrefLang={l} lang={l} onClick={(e) => onClick(e, l)} aria-current={l === locale ? 'true' : undefined} className={row}>
          {NATIVE[l as Locale] ?? l.toUpperCase()}
          {l === locale && <Check aria-hidden size={18} strokeWidth={2} className="shrink-0 text-action" />}
        </a>
      </li>
    ))

  if (variant === 'list')
    return (
      <nav aria-labelledby={labelId} className={className}>
        <p id={labelId} className="flex items-center gap-2 px-3 pb-1 font-[family-name:var(--font-display)] text-sm font-semibold text-ink-soft">
          <Globe aria-hidden size={18} strokeWidth={1.75} />
          {label}
        </p>
        <ul className="grid gap-0.5">
          {items('flex min-h-12 items-center justify-between gap-4 rounded-md px-3 text-[1.05rem] text-ink hover:bg-mist aria-[current=true]:font-semibold')}
        </ul>
      </nav>
    )

  return (
    <nav aria-label={label} className={className}>
      <details ref={details} className="group/lang relative">
        <summary className="inline-flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center gap-1.5 rounded-[var(--radius-control)] px-2 font-[family-name:var(--font-display)] text-sm font-semibold text-ink hover:text-action [&::-webkit-details-marker]:hidden">
          <Globe aria-hidden size={18} strokeWidth={1.75} />
          <span className="sr-only">{label}: </span>
          {locale.toUpperCase()}
          <ChevronDown aria-hidden size={16} strokeWidth={1.75} className="text-ink-soft transition-transform group-open/lang:rotate-180" />
        </summary>
        <ul className="absolute end-0 top-full z-50 mt-1 grid w-max min-w-44 gap-0.5 rounded-[var(--radius-photo)] border border-line bg-paper p-1.5 shadow-[var(--shadow-float)]">
          {items('flex min-h-11 items-center justify-between gap-4 rounded-md px-3 text-[0.95rem] text-ink hover:bg-mist aria-[current=true]:font-semibold')}
        </ul>
      </details>
    </nav>
  )
}
