import { Maybe } from 'tsentials/maybe'
import type { DateTimeProvider } from 'tsentials/time'

type Facts = { foundingYear?: number | null; craftStartYear?: number | null }

const plausible = (y: number | null | undefined): y is number => typeof y === 'number' && y >= 1900 && y <= 2100

/** "2009'dan beri" — only when the founding year is confirmed in siteSettings. */
export const sinceYear = (f: Facts): Maybe<number> => (plausible(f.foundingYear) ? Maybe.some(f.foundingYear) : Maybe.none())

/** "X yıllık usta" — only from the confirmed craft start year (PRODUCT.md: never derive "30 yıl" from anything else). */
export const craftYears = (f: Facts, clock: DateTimeProvider): Maybe<number> =>
  plausible(f.craftStartYear) ? Maybe.some(clock.utcNow().getUTCFullYear() - f.craftStartYear) : Maybe.none()
