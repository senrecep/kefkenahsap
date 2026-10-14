import { Maybe } from 'tsentials/maybe'

export const GALLERY_PAGE_SIZE = 24
const MAX_PAGE = 20

/** `?sayfa=` → page number; anything that is not a positive integer is page 1 (capped to bound the query). */
export function pageFromQuery(v: string | string[] | undefined): number {
  if (typeof v !== 'string' || !/^\d+$/.test(v)) return 1
  const n = Number(v)
  return n < 1 ? 1 : Math.min(n, MAX_PAGE)
}

/** Pages are cumulative: page n shows the first n × 24 photos, so earlier photos stay in view. */
export const galleryLimit = (page: number) => page * GALLERY_PAGE_SIZE

type PriceInput = {
  min?: number | null
  max?: number | null
  unit?: string | null
  currency?: string | null
  note?: string | null
  updatedAt?: string | null
}
export type PriceGuide = { range: string; unit?: string; note?: string; updatedAt?: string }

/** Price range only when the owner entered at least one bound (no invented prices). */
export function priceGuide(p: PriceInput | null | undefined, locale: string): Maybe<PriceGuide> {
  const bounds = [p?.min, p?.max].filter((n): n is number => typeof n === 'number')
  if (!bounds.length) return Maybe.none()
  const fmt = new Intl.NumberFormat(locale, { style: 'currency', currency: p?.currency || 'TRY', maximumFractionDigits: 0 })
  const range = [...new Set(bounds)].map((n) => fmt.format(n)).join(' – ')
  return Maybe.some({
    range,
    ...(p?.unit ? { unit: p.unit } : {}),
    ...(p?.note?.trim() ? { note: p.note.trim() } : {}),
    ...(p?.updatedAt ? { updatedAt: p.updatedAt } : {}),
  })
}

type LexicalNode = { type?: string; text?: string; children?: LexicalNode[]; [k: string]: unknown }

/** Lexical stores a cleared field as a root with one empty paragraph; treat that as empty. */
export function hasRichText(value: { root?: LexicalNode } | null | undefined): boolean {
  const filled = (n: LexicalNode): boolean =>
    n.type === 'text' ? Boolean(n.text?.trim()) : n.children ? n.children.some(filled) : !['paragraph', 'linebreak', 'heading', 'root'].includes(n.type ?? '')
  return Boolean(value?.root?.children?.some(filled))
}
