import { Maybe } from 'tsentials/maybe'

type Input = { quote?: string | null; author?: string | null; consentGiven?: boolean | null } | null | undefined

/** A testimonial (and its Review schema) is shown only with the customer's recorded consent (PRODUCT.md). */
export function publicTestimonial(t: Input): Maybe<{ quote: string; author?: string }> {
  const quote = t?.quote?.trim()
  if (!t?.consentGiven || !quote) return Maybe.none()
  return Maybe.some(t.author ? { quote, author: t.author } : { quote })
}
