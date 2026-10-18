type Pathnames = Record<string, string | Record<string, string>>
type Query = Record<string, string | number | (string | number)[]>
type Href<P extends string> = P | { pathname: P; params?: Record<string, string | number>; query?: Query }

/**
 * next-intl's getPathname for `localePrefix: 'always'` routing: localized template, params, query, locale prefix.
 * Ours because importing next-intl's createNavigation on the server also ships its client Link, and with it the
 * whole message formatter (~13 KB gz), to every page (#52). Parity is checked against next-intl in the test.
 */
export function localizedPathname<P extends string>(routing: { pathnames: Record<P, Pathnames[string]> }, args: { locale: string; href: Href<P> }): string {
  const { pathname, params = {}, query } = typeof args.href === 'string' ? { pathname: args.href } : args.href
  const config = routing.pathnames[pathname]
  let path = typeof config === 'string' ? config : (config[args.locale] ?? pathname)
  for (const [key, value] of Object.entries(params)) path = path.replaceAll(`[${key}]`, encodeURIComponent(String(value)))
  if (path.includes('[')) throw new Error(`Missing params for ${pathname}: ${JSON.stringify(params)}`)
  path = new URL(path, 'http://l').pathname
  if (path !== '/' && path.endsWith('/')) path = path.slice(0, -1)
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) for (const v of [value].flat()) search.append(key, String(v))
  const qs = query ? `?${search}` : ''
  return `/${args.locale}${path === '/' ? '' : path}${qs}`
}
