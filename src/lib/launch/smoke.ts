/**
 * Launch smoke checks (#53): which URLs to hit and what each must answer. Pure; the CLI is scripts/launch/smoke.ts.
 * Legacy samples and targets come from PLAN §5.2 and the committed legacy maps (seed #31), not from the resolver.
 */
import attachments from '../legacy/attachment-map.json'
import media from '../legacy/media-map.json'

export type Check = {
  /** Path on the base URL, or an absolute URL (the CDN file a legacy redirect points to). */
  path: string
  status: number
  /** Redirects: a "/path" target is compared by pathname (Location may be absolute), a full URL exactly. */
  location?: string
  /** Pages: self canonical on the site origin plus tr + x-default hreflang. */
  html?: boolean
  bodyIncludes?: string[]
  bodyMatches?: RegExp[]
  bodyExcludes?: RegExp[]
}
export type Answer = { status: number; location: string | null; body: string }

// From the committed maps, so a replaced file (#190) moves the check with it.
const LEGACY_IMAGE = (media['2018/09/1-1'] ?? Object.values(media)[0])?.file ?? ''
const LEGACY_SLUG = (attachments['/deck-ve-zeminler/1-6/'] ?? Object.values(attachments)[0])?.slug ?? ''

export function smokeChecks(opts: { site: string; mediaBase: string; production: boolean }): Check[] {
  const site = opts.site.replace(/\/$/, '')
  const media = `${opts.mediaBase.replace(/\/$/, '')}/${LEGACY_IMAGE}`
  return [
    { path: '/api/health', status: 200, bodyIncludes: ['"ok":true'] },
    ...['/tr', '/en', '/tr/deck-ve-zeminler', '/tr/iletisim'].map((path) => ({ path, status: 200, html: true })),
    opts.production
      ? { path: '/robots.txt', status: 200, bodyIncludes: [`Sitemap: ${site}/sitemap.xml`], bodyExcludes: [/^Disallow: \/\s*$/m] }
      : { path: '/robots.txt', status: 200, bodyMatches: [/^Disallow: \/\s*$/m], bodyExcludes: [/^Sitemap:/im] },
    // An index of per-locale child sitemaps; the Turkish pages one lists the home page.
    { path: '/sitemap.xml', status: 200, bodyIncludes: ['<sitemapindex', `<loc>${site}/sitemaps/tr-pages.xml</loc>`] },
    { path: '/sitemaps/tr-pages.xml', status: 200, bodyIncludes: ['<urlset', `<loc>${site}/tr</loc>`] },
    // Old WordPress URLs: one 301 each (pages, the WP home page, a size variant, an attachment page).
    { path: '/deck-ve-zeminler/', status: 301, location: '/tr/deck-ve-zeminler' },
    { path: '/ireko-teak/', status: 301, location: '/tr/ireko-teak' },
    { path: '/kefken-ahsap-dekorasyon/', status: 301, location: '/tr' },
    { path: '/wp-content/uploads/2018/09/1-1-400x400.jpg', status: 301, location: media },
    { path: '/deck-ve-zeminler/1-6/', status: 301, location: `/tr/galeri/${LEGACY_SLUG}` },
    // An upload the new site has no match for (Turkish characters, encoded).
    { path: '/wp-content/uploads/2021/02/kap%C4%B1dolap2.jpeg', status: 410 },
    // The redirect target must exist: catches an unseeded media bucket/prefix.
    { path: media, status: 200 },
  ]
}

const attrs = (tag: string) => Object.fromEntries([...tag.matchAll(/([a-zA-Z-]+)="([^"]*)"/g)].map((m) => [m[1]!.toLowerCase(), m[2]!]))

/** Problems found (empty = pass). `site` is the canonical origin, which may differ from the URL that was fetched. */
export function evaluate(check: Check, res: Answer, site: string): string[] {
  const problems: string[] = []
  if (res.status !== check.status) problems.push(`status ${res.status}, expected ${check.status}`)
  if (check.location !== undefined) {
    const got = res.location ?? ''
    const same = check.location.startsWith('/')
      ? (() => {
          const u = new URL(got, 'http://relative.invalid')
          return u.pathname + u.search === check.location
        })()
      : got === check.location
    if (!same) problems.push(`location ${got || '(none)'}, expected ${check.location}`)
  }
  for (const s of check.bodyIncludes ?? []) if (!res.body.includes(s)) problems.push(`body lacks ${s}`)
  for (const r of check.bodyMatches ?? []) if (!r.test(res.body)) problems.push(`body does not match ${r}`)
  for (const r of check.bodyExcludes ?? []) if (r.test(res.body)) problems.push(`body matches ${r}`)
  if (check.html) {
    const links = [...res.body.matchAll(/<link\b[^>]*>/gi)].map((m) => attrs(m[0]))
    const canonical = links.find((l) => l.rel === 'canonical')?.href
    const want = `${site.replace(/\/$/, '')}${check.path}`
    if (canonical !== want) problems.push(`canonical ${canonical ?? '(none)'}, expected ${want}`)
    const langs = new Set(links.filter((l) => l.rel === 'alternate' && l.hreflang).map((l) => l.hreflang))
    for (const l of ['tr', 'x-default']) if (!langs.has(l)) problems.push(`hreflang ${l} missing`)
  }
  return problems
}
