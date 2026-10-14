import { NextResponse, type NextRequest } from 'next/server'

import { routing } from '@/i18n/routing'
import { getContentLocales } from '@/lib/data/categories'
import { rootLocale } from '@/lib/i18n/root'

export const dynamic = 'force-dynamic'

/** `/` → the visitor's language among those with content (PLAN §5.1); the proxy hands `/` here instead of next-intl. */
export async function GET(req: NextRequest) {
  const live = await getContentLocales().catch((err) => {
    console.error('root redirect: content locales unavailable', err)
    return [routing.defaultLocale]
  })
  const locale = rootLocale({ accept: req.headers.get('accept-language'), cookie: req.cookies.get('NEXT_LOCALE')?.value, live })
  const res = NextResponse.redirect(new URL(`/${locale}${req.nextUrl.search}`, req.url), 302)
  // Depends on the visitor's headers and cookie: never cached.
  res.headers.set('Cache-Control', 'private, no-store')
  return res
}
