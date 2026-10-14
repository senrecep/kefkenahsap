import { hasLocale } from 'next-intl'
import { NextResponse, type NextRequest } from 'next/server'

import { routing } from '@/i18n/routing'
import { getGalleryPage, resolveGalleryFilter } from '@/lib/data/gallery'
import { PAGE_SIZE, parseGalleryQuery } from '@/lib/gallery/query'

/** Infinite-scroll feed: `?cursor=&kategori=&etiket=` → next 24 gallery items (outside /api so the edge can cache it). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return NextResponse.json({ error: 'Unknown locale' }, { status: 404 })
  const parsed = parseGalleryQuery(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.ok) return NextResponse.json({ error: parsed.errors[0]!.code }, { status: 400 })
  const q = parsed.value

  const f = await resolveGalleryFilter(locale, q)
  const page = f.unknown
    ? { items: [], nextCursor: null }
    : await getGalleryPage(locale, { categoryId: f.category?.id, tagId: f.tag?.id, cursor: q.cursor, limit: PAGE_SIZE })

  return NextResponse.json(
    { items: page.items, nextCursor: page.nextCursor },
    { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=60' } },
  )
}
