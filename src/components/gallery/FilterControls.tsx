'use client'

import { ChevronDown, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * One-line chip rail (no wrap): scrolls sideways with snap, fades at its inline end, and centres the active chip
 * (`aria-current`) on load. Physical scrollBy deltas, so it works in RTL and never scrolls the page itself. Mouse users
 * get previous/next arrows while there is more to scroll (touch swipes, keyboard tabs through the chips).
 * `className` places the rail in its row; `railClassName` pads the scrolling strip.
 */
export function FilterRail({
  className = '',
  railClassName = '',
  children,
  ...rest
}: { className?: string; railClassName?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState({ back: false, next: false })
  useEffect(() => {
    const box = ref.current
    if (!box) return
    const el = box.querySelector('[aria-current]')
    if (el) {
      const b = box.getBoundingClientRect()
      const r = el.getBoundingClientRect()
      if (r.left < b.left + 40 || r.right > b.right - 40) box.scrollBy({ left: r.left - b.left - (b.width - r.width) / 2 })
    }
    // RTL scrollLeft runs negative from 0, so the magnitude is the distance from the start in both directions.
    const sync = () => {
      const x = Math.abs(box.scrollLeft)
      setMore({ back: x > 1, next: x + box.clientWidth < box.scrollWidth - 1 })
    }
    const ro = new ResizeObserver(sync)
    ro.observe(box)
    box.addEventListener('scroll', sync, { passive: true })
    return () => (ro.disconnect(), box.removeEventListener('scroll', sync))
  }, [])
  const page = (dir: 1 | -1) => {
    const box = ref.current
    if (!box) return
    const rtl = getComputedStyle(box).direction === 'rtl' ? -1 : 1
    box.scrollBy({ left: dir * rtl * box.clientWidth * 0.8, behavior: 'smooth' })
  }
  const arrow =
    'absolute top-1/2 z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-paper text-ink shadow-[0_2px_8px_rgb(29_31_28/0.12)] transition-colors hover:border-ink/40 pointer-fine:flex'
  return (
    <div className={`relative min-w-0 ${className}`}>
      <div ref={ref} {...rest} className={`rail ${railClassName}`}>
        {children}
      </div>
      {/* Mouse-only shortcuts: keyboard and screen readers already reach every chip in order. */}
      {more.back && (
        <button type="button" tabIndex={-1} aria-hidden onClick={() => page(-1)} className={`${arrow} start-0`}>
          <ChevronLeft size={18} strokeWidth={2} className="rtl:rotate-180" />
        </button>
      )}
      {more.next && (
        <button type="button" tabIndex={-1} aria-hidden onClick={() => page(1)} className={`${arrow} end-0`}>
          <ChevronRight size={18} strokeWidth={2} className="rtl:rotate-180" />
        </button>
      )}
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
      <div id={id} className={`flex-col gap-3 ${open ? 'flex' : 'hidden'} ${auto ? 'max-md:hidden' : ''}`}>
        {children}
      </div>
    </>
  )
}
