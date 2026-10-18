import { routing } from '@/i18n/routing'

type Route = keyof typeof routing.pathnames
const localized = (route: Route, locale: string) => {
  const p = routing.pathnames[route]
  return typeof p === 'string' ? p : p[locale as keyof typeof p]
}

// Pages whose query string changes what they render; the rest ignore it, so they stay on their cached copy.
const LISTS: Route[] = ['/galeri', '/projeler']
const LIST_PATHS = new Map(routing.locales.flatMap((l) => LISTS.map((r) => [`/${l}${localized(r, l)}`, `/${l}/_q${r}`])))
// First segments of fixed routes in any locale: under /<locale>/ any other single segment is a category.
const FIXED = new Set(
  Object.entries(routing.pathnames)
    .flatMap(([internal, p]) => [internal, ...(typeof p === 'string' ? [] : Object.values(p))])
    .map((p) => p.split('/')[1])
    .filter((seg) => seg && !seg.startsWith('[')),
)

/**
 * #211: the internal per-request route for a public URL that carries a query string, or null when the cached page serves
 * it. Gallery / project list filters, the no-JS "?sayfa=N" pages and live preview render under /<locale>/_q/…, so the
 * bare URLs can be ISR (reading searchParams would make every visit to them dynamic).
 */
export function queryRoute(pathname: string): string | null {
  const list = LIST_PATHS.get(pathname)
  if (list) return list
  const m = /^\/([^/]+)\/([^/]+)$/.exec(pathname)
  if (!m || !(routing.locales as readonly string[]).includes(m[1]!) || FIXED.has(m[2]!)) return null
  return `/${m[1]}/_q/${m[2]}`
}
