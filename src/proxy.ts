import createMiddleware from 'next-intl/middleware'
import { NextResponse, type NextRequest } from 'next/server'

import { routing } from './i18n/routing'
import { mediaKey, pageKey } from './lib/legacy/normalize'

const intl = createMiddleware(routing)

// shortcut: spike-sized legacy tables; the full map (16 pages + attachments + ~1169 media) arrives with #32.
const LEGACY_PAGES = new Set(['deck-ve-zeminler', 'hakkimizda', 'iletisim', 'referanslar', 'hizmetlerimiz'])
const LEGACY_MEDIA: Record<string, string> = { '1-1': 'deck-ve-zeminler/1-1.webp' }

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

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
  // Everything except Payload (admin, api), Next internals and files — plus old WP upload URLs, which contain dots.
  matcher: ['/((?!admin(?:/|$)|api(?:/|$)|_next|_vercel|.*\\..*).*)', '/wp-content/uploads/:path*'],
}
