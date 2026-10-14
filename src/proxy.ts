import createMiddleware from 'next-intl/middleware'
import { NextResponse, type NextRequest } from 'next/server'

import { routing } from './i18n/routing'
import { isAuthorized } from './lib/http/basic-auth'
import { mediaKey, pageKey } from './lib/legacy/normalize'

const intl = createMiddleware(routing)

// shortcut: spike-sized legacy tables; the full map (16 pages + attachments + ~1169 media) arrives with #32.
const LEGACY_PAGES = new Set(['deck-ve-zeminler', 'hakkimizda', 'iletisim', 'referanslar', 'hizmetlerimiz'])
const LEGACY_MEDIA: Record<string, string> = { '1-1': 'deck-ve-zeminler/1-1.webp' }

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // The container healthcheck must work without credentials.
  if (pathname === '/api/health') return NextResponse.next()

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

  // Payload admin/API and static files: auth only, no locale handling.
  if (/^\/(admin|api)(\/|$)/.test(pathname) || /\.[a-z0-9]+$/i.test(pathname) && !pathname.startsWith('/wp-content/')) {
    return NextResponse.next()
  }

  const mk = mediaKey(pathname)
  if (mk !== null) {
    const target = LEGACY_MEDIA[mk]
    return target
      ? NextResponse.redirect(`${process.env.MEDIA_PUBLIC_URL}/${target}`, 301)
      : new NextResponse(null, { status: 410 })
  }

  const isLocalized = routing.locales.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`))
  if (!isLocalized) {
    const key = pageKey(pathname)
    // Old WP pages land on their TR page in a single hop (trailing slash handled here, not by Next).
    if (key && LEGACY_PAGES.has(key))
      return NextResponse.redirect(new URL(`/tr/${key}${req.nextUrl.search}`, req.url), 301)
  } else if (pathname.length > 1 && pathname.endsWith('/')) {
    return NextResponse.redirect(new URL(pathname.replace(/\/+$/, '') + req.nextUrl.search, req.url), 308)
  }

  return intl(req)
}

export const config = {
  // Everything except Next's own static assets; admin/API/files only pass the auth gate (see above).
  matcher: ['/((?!_next/static|_next/image).*)'],
}
