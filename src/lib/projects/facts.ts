import { Maybe } from 'tsentials/maybe'

type Named = { name?: string | null } | number | null | undefined
type Unit = 'm2' | 'm' | 'piece'
type Input = {
  city?: string | null
  district?: string | null
  year?: number | null
  areaValue?: number | null
  areaUnit?: Unit | null
  duration?: string | null
  woodSpecies?: Named[] | null
  finish?: string | null
  categories?: Named[] | null
}
export type Fact = { key: 'location' | 'year' | 'area' | 'duration' | 'wood' | 'finish' | 'categories'; value: string | string[] }

const names = (xs: Named[] | null | undefined) =>
  (xs ?? []).map((x) => (typeof x === 'object' ? x?.name?.trim() : undefined)).filter((n): n is string => Boolean(n))

/** "Proje künyesi": only the fields the owner filled, in display order (empty fields render nothing). */
export function projectFacts(p: Input, locale: string, units: Record<Unit, string>): Fact[] {
  const facts: Fact[] = []
  const push = (key: Fact['key'], value: string | string[] | undefined) => {
    if (Array.isArray(value) ? value.length : value?.trim()) facts.push({ key, value: Array.isArray(value) ? value : value!.trim() })
  }
  push('location', [p.district, p.city].map((s) => s?.trim()).filter(Boolean).join(', '))
  push('year', p.year ? String(p.year) : undefined)
  push('area', typeof p.areaValue === 'number' ? [new Intl.NumberFormat(locale).format(p.areaValue), p.areaUnit ? units[p.areaUnit] : ''].join(' ').trim() : undefined)
  push('duration', p.duration ?? undefined)
  push('wood', names(p.woodSpecies))
  push('finish', p.finish ?? undefined)
  push('categories', names(p.categories))
  return facts
}

/** `?kategori=<slug>` → the matching category; anything else means "all projects". */
export function categoryFilter<C extends { id: number; slug?: string | null }>(v: string | string[] | undefined, cats: C[]): Maybe<C> {
  const hit = typeof v === 'string' && v ? cats.find((c) => c.slug === v) : undefined
  return hit ? Maybe.some(hit) : Maybe.none()
}
