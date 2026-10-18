import { routing } from '@/i18n/routing'

type Route = keyof typeof routing.pathnames
const localized = (route: Route, locale: string) => {
  const p = routing.pathnames[route]
  return typeof p === 'string' ? p : p[locale as keyof typeof p]
}

// The query keys each page reads (galeri/view.tsx, projeler/view.tsx, [category]/view.tsx). Any other key (utm_*, gclid,
// fbclid…) changes nothing on the page, so it stays on the cached copy.
const LISTS: [Route, readonly string[]][] = [
  ['/galeri', ['kategori', 'etiket', 'sayfa']],
  ['/projeler', ['kategori']],
]
const CATEGORY_KEYS = ['sayfa']
const LIST_PATHS = new Map<string, { to: string; keys: readonly string[] }>(routing.locales.flatMap((l) => LISTS.map(([r, keys]) => [`/${l}${localized(r, l)}`, { to: `/${l}/_q${r}`, keys }] as const)))
// First segments of fixed routes in any locale: under /<locale>/ any other single segment is a category.
const FIXED = new Set(
  Object.entries(routing.pathnames)
    .flatMap(([internal, p]) => [internal, ...(typeof p === 'string' ? [] : Object.values(p))])
    .map((p) => p.split('/')[1])
    .filter((seg) => seg && !seg.startsWith('[')),
)

/**
 * #211: the internal per-request route for a public URL whose query string changes the page, or null when the cached
 * page serves it. Gallery / project list filters and the no-JS "?sayfa=N" pages render under /<locale>/_q/…, so the
 * bare URLs can be ISR (reading searchParams would make every visit to them dynamic).
 */
export function queryRoute(pathname: string, query: URLSearchParams): string | null {
  const reads = (keys: readonly string[]) => keys.some((k) => query.has(k))
  const list = LIST_PATHS.get(pathname)
  if (list) return reads(list.keys) ? list.to : null
  const m = /^\/([^/]+)\/([^/]+)$/.exec(pathname)
  if (!m || !(routing.locales as readonly string[]).includes(m[1]!) || FIXED.has(m[2]!) || !reads(CATEGORY_KEYS)) return null
  return `/${m[1]}/_q/${m[2]}`
}
