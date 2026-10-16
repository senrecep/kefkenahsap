'use client'

import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * One-line chip rail (no wrap): scrolls sideways with snap, fades at its inline end, and centres the active chip
 * (`aria-current`) on load. A physical scrollBy delta, so it works in RTL and never scrolls the page itself.
 */
export function FilterRail({ className = '', children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const box = ref.current
    const el = box?.querySelector('[aria-current]')
    if (!box || !el) return
    const b = box.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    if (r.left >= b.left && r.right <= b.right - 40) return
    box.scrollBy({ left: r.left - b.left - (b.width - r.width) / 2 })
  }, [])
  return (
    <div ref={ref} {...rest} className={`rail ${className}`}>
      {children}
    </div>
  )
}

/**
 * "More filters" disclosure: the toggle sits in the type row (`lead`, then the toggle, then `after`; on phones the toggle
 * leads), the panel opens full width below that row. Without JS the panel shows open (noscript style).
 */
export function FilterMore({
  id,
  label,
  mobileLabel,
  defaultOpen,
  rowClassName,
  lead,
  after,
  children,
}: {
  id: string
  label: string
  mobileLabel: string
  defaultOpen: boolean
  rowClassName: string
  lead: ReactNode
  after?: ReactNode
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  // Opened for an active tag: on phones that would push the photos below the fold, so there it stays closed until the
  // first tap (the row shows the active chip instead). Phone and desktop toggles each report their own state.
  const [auto, setAuto] = useState(defaultOpen)
  const btn =
    'js-only inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-line bg-paper px-3.5 font-[family-name:var(--font-display)] text-sm font-semibold whitespace-nowrap text-ink transition-colors hover:border-ink/40 aria-expanded:border-ink aria-expanded:bg-mist'
  const toggle = (
    <>
      <button
        type="button"
        aria-expanded={open && !auto}
        aria-controls={id}
        onClick={() => (setAuto(false), setOpen(auto || !open))}
        data-umami-event="filter_more"
        className={`${btn} max-md:order-first md:hidden`}
      >
        <SlidersHorizontal aria-hidden size={16} strokeWidth={2} />
        {mobileLabel}
      </button>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => (setAuto(false), setOpen(!open))}
        data-umami-event="filter_more"
        className={`${btn} max-md:hidden`}
      >
        {label}
        <ChevronDown aria-hidden size={16} strokeWidth={2} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
    </>
  )
  return (
    <>
      <div className={rowClassName}>
        {lead}
        {toggle}
        {after}
      </div>
      <noscript>
        <style>{`#${id}{display:flex!important}.js-only{display:none!important}`}</style>
      </noscript>
      <div id={id} hidden={!open} className={`flex flex-col gap-3 ${auto ? 'max-md:hidden' : ''}`}>
        {children}
      </div>
    </>
  )
}
