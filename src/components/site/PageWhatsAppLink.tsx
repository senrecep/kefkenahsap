'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef, type ReactNode } from 'react'

// The page's own WhatsApp button in <main> carries its context (category, project, image, contact); the bar reuses that link.
const PAGE_WA = 'main a[data-umami-event="whatsapp_click"]'

/** Mobile-bar WhatsApp link: starts with the default message (no JS), then adopts the current page's contextual link. */
export function PageWhatsAppLink({ href, className, children }: { href: string; className: string; children: ReactNode }) {
  const pathname = usePathname()
  const ref = useRef<HTMLAnchorElement>(null)
  // Syncs with the page DOM after each navigation; no re-render needed.
  useEffect(() => {
    if (ref.current) ref.current.href = document.querySelector<HTMLAnchorElement>(PAGE_WA)?.href ?? href
  }, [pathname, href])
  return (
    <a ref={ref} href={href} target="_blank" rel="noopener" data-umami-event="whatsapp_click" data-umami-event-place="mobile-bar" className={className}>
      {children}
    </a>
  )
}
