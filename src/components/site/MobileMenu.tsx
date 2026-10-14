'use client'

import { Menu, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

/** Disclosure for the small-screen navigation; content is server-rendered and passed in. */
export function MobileMenu({ label, closeLabel, children }: { label: string; closeLabel: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return setOpen(false)
      if (e.key !== 'Tab' || !panel.current || !toggle.current) return
      // Focus trap: Tab cycles through the toggle and the panel's visible controls.
      const items = [toggle.current, ...panel.current.querySelectorAll<HTMLElement>('a[href],button,summary')].filter((el) => el.getClientRects().length > 0)
      const first = items[0]!
      const last = items.at(-1)!
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    panel.current?.querySelector<HTMLElement>('a,button,summary')?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      toggle.current?.focus() // return focus to the toggle on close
    }
  }, [open])
  return (
    <div className="lg:hidden">
      <button
        ref={toggle}
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-[var(--radius-control)] text-ink"
      >
        {open ? <X aria-hidden size={26} strokeWidth={1.75} /> : <Menu aria-hidden size={26} strokeWidth={1.75} />}
        <span className="sr-only">{open ? closeLabel : label}</span>
      </button>
      <div
        id="mobile-menu"
        ref={panel}
        hidden={!open}
        onClick={(e) => (e.target as HTMLElement).closest('a') && setOpen(false)}
        className="fixed inset-x-0 top-[var(--header-h)] bottom-0 z-40 flex flex-col overflow-y-auto bg-paper px-4 pt-4"
      >
        {children}
      </div>
    </div>
  )
}
