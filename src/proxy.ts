import createMiddleware from 'next-intl/middleware'
import { NextResponse, type NextRequest } from 'next/server'

import { routing } from './i18n/routing'
import { isAuthorized } from './lib/http/basic-auth'
import attachments from './lib/legacy/attachment-map.json'
import media from './lib/legacy/media-map.json'
import attachmentPathList from './lib/legacy/wp-attachment-paths.json'
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

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // The container healthcheck must work without credentials.
  if (pathname === '/api/health') return NextResponse.next()
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
    const res = NextResponse.redirect(new URL(legacy.location, req.url), legacy.status)
    // Browsers keep a bare 301 forever; a day lets a corrected map take effect.
    res.headers.set('Cache-Control', 'public, max-age=86400')
    return res
  }
  if (legacy.kind === 'gone') return new NextResponse(null, { status: 410 })

  // Other files (robots.txt, sitemap.xml, icons): no locale handling.
  if (/\.[a-z0-9]+$/i.test(pathname)) return NextResponse.next()

  const isLocalized = routing.locales.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`))
  if (isLocalized && pathname.length > 1 && pathname.endsWith('/')) {
    return NextResponse.redirect(new URL(pathname.replace(/\/+$/, '') + req.nextUrl.search, req.url), 308)
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
