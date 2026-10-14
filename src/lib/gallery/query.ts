import { Err } from 'tsentials/errors'
import { Result } from 'tsentials/result'
import type { Where } from 'payload'

export const PAGE_SIZE = 24
/** No-JS "?sayfa=N" renders N pages at once; capped so one request stays cheap. */
export const MAX_PAGES = 20

export type GalleryQuery = { category?: string; tag?: string; page: number; cursor?: number }
type Params = Record<string, string | string[] | undefined>

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined

/** Opaque keyset cursor: the last shown media id. */
export const encodeCursor = (id: number) => Buffer.from(`c${id}`).toString('base64url')

/** Gallery URL/feed params (`kategori`, `etiket`, `sayfa`, `cursor`) — validated at the trust boundary. */
export function parseGalleryQuery(params: Params): Result<GalleryQuery> {
  const category = first(params.kategori)
  const tag = first(params.etiket)
  for (const slug of [category, tag])
    if (slug !== undefined && (slug.length > 120 || !SLUG.test(slug)))
      return Result.failure(Err.validation('Gallery.BadFilter', 'Geçersiz filtre.'))

  let cursor: number | undefined
  const rawCursor = first(params.cursor)
  if (rawCursor !== undefined) {
    const m = /^c([1-9]\d{0,14})$/.exec(Buffer.from(rawCursor, 'base64url').toString())
    if (!m) return Result.failure(Err.validation('Gallery.BadCursor', 'Geçersiz sayfa imleci.'))
    cursor = Number(m[1])
  }

  const page = Math.min(MAX_PAGES, Math.max(1, Number.parseInt(first(params.sayfa) ?? '1', 10) || 1))
  return Result.success({
    ...(category ? { category } : {}),
    ...(tag ? { tag } : {}),
    page,
    ...(cursor ? { cursor } : {}),
  })
}

/** Payload `where` for the public gallery, newest first (sort `-id`). The Local API skips access rules, so approval is enforced here. */
export function galleryWhere(f: { categoryId?: number; tagId?: number; cursor?: number }): Where & { and: Where[] } {
  return {
    and: [
      { status: { equals: 'approved' } },
      ...(f.categoryId ? [{ category: { equals: f.categoryId } }] : []),
      ...(f.tagId ? [{ tags: { in: [f.tagId] } }] : []),
      ...(f.cursor ? [{ id: { less_than: f.cursor } }] : []),
    ],
  }
}
