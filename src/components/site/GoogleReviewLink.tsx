import { Star } from 'lucide-react'
import type { ReactNode } from 'react'

/** The owner's Google review link (siteSettings social.googleReview); renders nothing when it is empty. */
export function GoogleReviewLink({ href, place, className, children }: { href?: string | null; place: string; className?: string; children: ReactNode }) {
  if (!href) return null
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" data-umami-event="google_review_click" data-umami-event-place={place} className={className}>
      <Star aria-hidden size={18} strokeWidth={1.75} />
      {children}
    </a>
  )
}
