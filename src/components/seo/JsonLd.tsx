import { safeJsonLd } from '@/lib/seo/jsonld'

/** schema.org markup from the src/lib/seo/jsonld builders; null entries (nothing to say) render nothing. */
export function JsonLd({ data }: { data: object | null | undefined | (object | null | undefined)[] }) {
  const nodes = (Array.isArray(data) ? data : [data]).filter((d): d is object => Boolean(d))
  return nodes.map((d, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(d) }} />)
}
