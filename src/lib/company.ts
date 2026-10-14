import { Maybe } from 'tsentials/maybe'
import type { DateTimeProvider } from 'tsentials/time'

type Facts = { foundingYear?: number | null; craftStartYear?: number | null }

const plausible = (y: number | null | undefined): y is number => typeof y === 'number' && y >= 1900 && y <= 2100

/** "2009'dan beri" — only when the founding year is confirmed in siteSettings. */
export const sinceYear = (f: Facts): Maybe<number> => (plausible(f.foundingYear) ? Maybe.some(f.foundingYear) : Maybe.none())

/** "X yıllık usta" — only from the confirmed craft start year (PRODUCT.md: never derive "30 yıl" from anything else). */
export const craftYears = (f: Facts, clock: DateTimeProvider): Maybe<number> => {
  if (!plausible(f.craftStartYear)) return Maybe.none()
  const years = clock.utcNow().getUTCFullYear() - f.craftStartYear
  return years >= 1 ? Maybe.some(years) : Maybe.none()
}

type Area = { name?: string | null; kind?: string | null }

/** "İstanbul ve Türkiye geneli": areaServed as one phrase; a country reads as nationwide coverage. */
export const areaLine = (areas: readonly Area[] | null | undefined, locale: string, nationwide: (country: string) => string): string =>
  new Intl.ListFormat(locale, { type: 'conjunction' }).format(
    (areas ?? []).filter((a) => a.name).map((a) => (a.kind === 'country' ? nationwide(a.name!) : a.name!)),
  )
