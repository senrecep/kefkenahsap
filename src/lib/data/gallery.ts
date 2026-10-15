import { unstable_cache } from 'next/cache'

import { getPathname } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { categoryRank, diversify } from '@/lib/gallery/curate'
import type { GalleryItem } from '@/lib/gallery/item'
import { encodeCursor, galleryWhere, PAGE_SIZE, START_CURSOR_ID, type GalleryQuery } from '@/lib/gallery/query'
import type { Category, Media, Project } from '@/payload-types'

import { markFallbackAlt, type WithAltLang } from './media-alt'
import { getPayload, TAGS } from './payload'
import { getNavCategories } from './site'

const HOUR = 3600
const tags = [TAGS.media, TAGS.categories, TAGS.projects]

const select = {
  title: true,
  alt: true,
  caption: true,
  seoFilename: true,
  category: true,
  project: true,
  url: true,
  width: true,
  height: true,
  sizes: true,
  lqip: true,
  dominantColor: true,
  focalX: true,
  focalY: true,
  featured: true,
  // The storage plugin builds file URLs from these; without them a prefixed bucket (dev/) yields broken URLs.
  filename: true,
  prefix: true,
  _objectKey: true,
} as const
const populate = { categories: { name: true, slug: true }, projects: { title: true, slug: true } } as const

// Public reads run with access control (overrideAccess: false): unapproved media and draft categories/projects
// stay out, and a relation the visitor may not read comes back as a bare id, which `rel` drops.
// Metadata may still be missing in a non-default locale; show the Turkish text rather than an empty alt.
export const mediaQuery = { depth: 1, select, populate, fallbackLocale: 'tr', overrideAccess: false } as const

const rel = <T extends object>(v: number | T | null | undefined) => (v && typeof v === 'object' ? v : undefined)

export function toGalleryItem(doc: WithAltLang<Media>, locale: Locale): GalleryItem {
  const slug = doc.seoFilename ?? '' // galleryWhere only returns media with a seoFilename
  const cat = rel<Category>(doc.category)
  const sizes = Object.fromEntries(
    Object.entries(doc.sizes ?? {}).map(([k, s]) => [k, s ? { url: s.url, width: s.width, height: s.height } : s]),
  )
  // Grid + lightbox use every generated width; only url/width/height per size go to the client.
  return {
    id: doc.id,
    slug,
    href: getPathname({ locale, href: { pathname: '/galeri/[slug]', params: { slug } } }),
    title: doc.title ?? '',
    alt: doc.alt ?? '',
    ...(doc.altLang ? { altLang: doc.altLang } : {}),
    ...(doc.caption ? { caption: doc.caption } : {}),
    width: doc.width ?? 0,
    height: doc.height ?? 0,
    media: { url: doc.url, width: doc.width, height: doc.height, lqip: doc.lqip, dominantColor: doc.dominantColor, focalX: doc.focalX, focalY: doc.focalY, sizes },
    ...(cat?.slug
      ? { category: { name: cat.name, href: getPathname({ locale, href: { pathname: '/[category]', params: { category: cat.slug } } }) } }
      : {}),
  }
}

/** Featured first, then a round-robin across categories (outdoor first), max 2 per category in the first 12. */
export async function curate(docs: Media[]): Promise<Media[]> {
  // Ranked by the Turkish slugs, the same in every locale.
  const cats = await getNavCategories('tr')
  const slugById = new Map(cats.map((c) => [String(c.id), c.slug ?? '']))
  const rank = categoryRank(cats.map((c) => c.slug ?? ''))
  const catId = (d: Media) => String(typeof d.category === 'object' && d.category ? d.category.id : (d.category ?? ''))
  return diversify(docs, { group: catId, rank: (id) => rank(slugById.get(id) ?? ''), featured: (d) => Boolean(d.featured) })
}

export type GalleryPage = { items: GalleryItem[]; total: number; nextCursor: string | null }

// Old watermarked photos vary a lot; the curated pool uses featured or large ones only.
const LARGE = 1280

/**
 * One curated selection (ids, one page) shared by the homepage gallery and the first page of the unfiltered /galeri:
 * featured first, then large photos mixed across categories, outdoor first.
 */
export const getCuratedSelection = (locale: Locale) =>
  unstable_cache(
    async () => {
      const res = await (await getPayload()).find({
        collection: 'media',
        locale,
        ...mediaQuery,
        where: { and: [...galleryWhere({}).and, { or: [{ featured: { equals: true } }, { width: { greater_than_equal: LARGE } }] }] },
        sort: ['-featured', '-id'],
        // shortcut: the mix draws from the newest 200 candidates; raise if large photos outgrow it.
        limit: 200,
      })
      const payload = await getPayload()
      return (await markFallbackAlt(payload, locale, (await curate(res.docs as Media[])).slice(0, PAGE_SIZE))).map((d) => toGalleryItem(d, locale))
    },
    ['curatedSelection', locale],
    { tags, revalidate: HOUR },
  )()

/** Newest first, keyset-paginated by id (stable when new photos are added); `exclude` skips the curated first page. */
export function getGalleryPage(locale: Locale, f: { categoryId?: number; tagId?: number; cursor?: number; exclude?: number[]; limit: number }) {
  const load = async (): Promise<GalleryPage> => {
    const res = await (await getPayload()).find({
      collection: 'media',
      locale,
      ...mediaQuery,
      where: galleryWhere(f),
      sort: '-id',
      limit: f.limit,
    })
    const docs = res.docs as Media[]
    return {
      items: (await markFallbackAlt(await getPayload(), locale, docs)).map((d) => toGalleryItem(d, locale)),
      total: res.totalDocs,
      nextCursor: res.hasNextPage && docs.length ? encodeCursor(docs.at(-1)!.id) : null,
    }
  }
  // Cursor pages are visitor-chosen keys: never cache them in-process (the feed's Cache-Control covers the edge).
  if (f.cursor) return load()
  return unstable_cache(load, ['galleryPage', locale, JSON.stringify(f)], { tags, revalidate: HOUR })()
}

/**
 * Unfiltered gallery, `pages` pages deep: page 1 is the curated selection, then the rest newest-first.
 * The feed continues from START_CURSOR_ID with the same exclusion, so nothing repeats or goes missing.
 */
export async function getUnfilteredGallery(locale: Locale, pages: number): Promise<GalleryPage> {
  const curated = await getCuratedSelection(locale)
  const exclude = curated.map((i) => i.id)
  // Payload treats limit 0 as "no limit": on page 1 fetch one row only for the count.
  const rest = await getGalleryPage(locale, { exclude, limit: Math.max(1, PAGE_SIZE * (pages - 1)) })
  return {
    items: [...curated, ...(pages > 1 ? rest.items : [])],
    total: curated.length + rest.total,
    nextCursor: pages > 1 ? rest.nextCursor : rest.total > 0 ? encodeCursor(START_CURSOR_ID) : null,
  }
}

export const getGalleryTags = (locale: Locale) =>
  unstable_cache(
    async () => {
      const res = await (await getPayload()).find({ collection: 'tags', locale, limit: 100, sort: 'name', depth: 0, overrideAccess: false, select: { name: true, slug: true } })
      // The database sorts bytewise (Ç, İ, Ö after Z); chips follow the locale's alphabet.
      const collator = new Intl.Collator(locale)
      return res.docs.filter((d) => d.slug && d.name).sort((x, y) => collator.compare(x.name, y.name))
    },
    ['galleryTags', locale],
    { tags: [TAGS.tags], revalidate: HOUR },
  )()

/** One approved image by its SEO filename, plus which locales have their own title (hreflang). */
export const getImage = (locale: Locale, slug: string) =>
  unstable_cache(
    async () => {
      const payload = await getPayload()
      const where = { and: [...galleryWhere({}).and, { seoFilename: { equals: slug } }] }
      const res = await payload.find({ collection: 'media', locale, ...mediaQuery, where, limit: 1 })
      const doc = res.docs[0] as Media | undefined
      if (!doc) return null
      const all = await payload.find({ collection: 'media', locale: 'all', where, limit: 1, depth: 0, overrideAccess: false, select: { title: true } })
      const titles = (all.docs[0]?.title ?? {}) as unknown as Record<string, string | null | undefined>
      const project = rel<Project>(doc.project)
      return {
        item: toGalleryItem((await markFallbackAlt(payload, locale, [doc]))[0]!, locale),
        categoryId: rel<Category>(doc.category)?.id,
        project: project?.slug
          ? { title: project.title, href: getPathname({ locale, href: { pathname: '/projeler/[slug]', params: { slug: project.slug } } }) }
          : undefined,
        titledLocales: Object.keys(titles).filter((l) => titles[l]),
      }
    },
    ['galleryImage', locale, slug],
    { tags, revalidate: HOUR },
  )()

/** Resolve `?kategori=&etiket=` slugs; `unknown` means a filter that no longer exists (empty result, not everything). */
export async function resolveGalleryFilter(locale: Locale, q: GalleryQuery) {
  const [categories, tags] = await Promise.all([getNavCategories(locale), getGalleryTags(locale)])
  const category = q.category ? categories.find((c) => c.slug === q.category) : undefined
  const tag = q.tag ? tags.find((x) => x.slug === q.tag) : undefined
  return { categories, tags, category, tag, unknown: Boolean((q.category && !category) || (q.tag && !tag)) }
}

/**
 * Approved photos from the given categories (Turkish slugs), newest first and alternating between categories.
 * The about page uses it to show the big jobs (bridges, piers, structures); an unknown slug or no photo → fewer/none.
 */
export async function getWorkPhotos(locale: Locale, trSlugs: readonly string[], limit: number): Promise<GalleryItem[]> {
  const ids = await unstable_cache(
    async () => {
      const res = await (await getPayload()).find({
        collection: 'categories',
        locale: 'tr',
        where: { slug: { in: [...trSlugs] } },
        select: { slug: true },
        depth: 0,
        limit: trSlugs.length,
        overrideAccess: false,
      })
      // Keep the caller's order (find() does not).
      return trSlugs.flatMap((s) => res.docs.find((d) => d.slug === s)?.id ?? [])
    },
    ['workPhotoCategories', ...trSlugs],
    { tags: [TAGS.categories], revalidate: HOUR },
  )()
  const pages = await Promise.all(ids.map((categoryId) => getGalleryPage(locale, { categoryId, limit })))
  const out: GalleryItem[] = []
  for (let i = 0; i < limit; i++) for (const p of pages) if (p.items[i]) out.push(p.items[i]!)
  return out.slice(0, limit)
}
