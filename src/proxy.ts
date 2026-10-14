import createMiddleware from 'next-intl/middleware'
import { NextResponse, type NextRequest } from 'next/server'

import { routing } from './i18n/routing'
import { isAuthorized } from './lib/http/basic-auth'
import attachments from './lib/legacy/attachment-map.json'
import media from './lib/legacy/media-map.json'
import attachmentPathList from './lib/legacy/wp-attachment-paths.json'
import { apexRedirectOrigin } from './lib/legacy/host'
import { resolveLegacy, type LegacyMaps } from './lib/legacy/resolve'

const intl = createMiddleware(routing)
const FEED_PATHS = new Set(
  routing.locales.map((l) => {
    const p = routing.pathnames['/galeri']
    return `/${l}${typeof p === 'string' ? p : p[l]}/feed`
  }),
)

const legacyMaps: LegacyMaps = { media, attachments, attachmentPaths: new Set(attachmentPathList) }
const mediaBase = [process.env.MEDIA_PUBLIC_URL, process.env.S3_PREFIX].filter(Boolean).join('/')

// Browsers keep a bare 301 forever; a day lets a corrected map take effect.
const legacyRedirect = (location: URL, status: 301 | 308) => {
  const res = NextResponse.redirect(location, status)
  res.headers.set('Cache-Control', 'public, max-age=86400')
  return res
}

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // The container healthcheck must work without credentials.
  if (pathname === '/api/health') return NextResponse.next()
  // Apex host: one hop to the final target on the canonical host (legacy target, 410, or the same path) (PLAN §5.1).
  const canonical = apexRedirectOrigin(req.headers.get('host'), process.env.NEXT_PUBLIC_SITE_URL)
  if (canonical) {
    // 308 keeps the method and body of a POST; GET/HEAD get the cacheable 301.
    const status = req.method === 'GET' || req.method === 'HEAD' ? 301 : 308
    const legacy = resolveLegacy(pathname, req.nextUrl.search, legacyMaps, mediaBase)
    if (legacy.kind === 'gone') return new NextResponse(null, { status: 410 })
    if (legacy.kind === 'redirect') return legacyRedirect(new URL(legacy.location, canonical), status)
    // Set pathname/search on the canonical URL rather than resolving request input against it: "//evil.com/x" would become another host.
    const to = new URL(canonical)
    to.pathname = pathname.replace(/^\/{2,}/, '/')
    to.search = req.nextUrl.search
    return legacyRedirect(to, status)
  }

  // Admin PWA assets hold no secrets; browsers fetch the manifest without credentials, so exempt them (installability on dev).
  if (pathname === '/admin.webmanifest' || pathname.startsWith('/brand/pwa-')) return NextResponse.next()

  // The deployed development environment sits entirely behind HTTP Basic auth (pages, admin, API, files)
  // and fails closed when the credential is missing.
  const basic = process.env.SITE_BASIC_AUTH
  if (process.env.SITE_ENV === 'development' && !basic) return new NextResponse('Not configured', { status: 503 })
  if (!isAuthorized(req.headers.get('authorization'), basic)) {
    return new NextResponse('Authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="kefkenahsap development", charset="UTF-8"' },
    })
  }

  // Payload admin/API: auth only, no locale handling.
  if (/^\/(admin|api)(\/|$)/.test(pathname)) return NextResponse.next()

  // Old WordPress URLs (incl. dotted ones like /wp-login.php): one hop to the new page/CDN file, or 410 (PLAN §5.2).
  const legacy = resolveLegacy(pathname, req.nextUrl.search, legacyMaps, mediaBase)
  if (legacy.kind === 'redirect') {
    return legacyRedirect(new URL(legacy.location, req.url), legacy.status)
  }
  if (legacy.kind === 'gone') return new NextResponse(null, { status: 410 })

  // Other files (robots.txt, sitemap.xml, icons): no locale handling.
  if (/\.[a-z0-9]+$/i.test(pathname)) return NextResponse.next()

  // A malformed percent-escape (e.g. /tr/projeler/%E0%A4%A) makes the locale middleware throw (500); it is a bad request.
  try {
    decodeURIComponent(pathname)
  } catch {
    return new NextResponse('Bad request', { status: 400 })
  }

  // `/` picks a language with content (src/app/route.ts), which next-intl's negotiation cannot know.
  if (pathname === '/') return NextResponse.next()

  const isLocalized = routing.locales.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`))
  if (isLocalized && pathname.length > 1 && pathname.endsWith('/')) {
    // Same safe construction as the apex branch: only the path changes, never the host.
    // A plain URL: NextURL.clone() re-applies the trailing slash on serialisation.
    const to = new URL(req.url)
    to.pathname = pathname.replace(/\/+$/, '')
    return NextResponse.redirect(to, 308)
  }

  const res = intl(req)
  // The gallery feed is cacheable JSON: a locale Set-Cookie would make the edge skip it.
  if (FEED_PATHS.has(pathname)) res.headers.delete('set-cookie')
  return res
}

export const config = {
  // Everything except Next's own static assets; admin/API/files only pass the auth gate (see above).
  matcher: ['/((?!_next/static|_next/image).*)'],
}
