import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import { unstable_cache } from 'next/cache'
import type { Payload } from 'payload'

import { getPathname } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { livePaths } from '@/lib/i18n/published'
import { responsiveImage, type MediaLike } from '@/lib/media/image'
import { mediaFileURL } from '@/lib/media/url'
import type { SitemapDoc } from '@/lib/seo/sitemap'

import { getPayload, TAGS } from './payload'

const HOUR = 3600
type ByLocale<T = string> = Record<string, T | null | undefined> | null | undefined

/** Per-locale paths of a localized document; null where the translation is not live (PLAN §5.1). */
const docPaths = (slug: ByLocale, title: ByLocale, path: (locale: string, slug: string) => string) =>
  livePaths(Object.fromEntries(routing.locales.map((l) => [l, { slug: slug?.[l], title: title?.[l] }])), path)

type Locale = (typeof routing.locales)[number]
const categoryPath = (l: string, category: string) => getPathname({ locale: l as Locale, href: { pathname: '/[category]', params: { category } } })
const projectPath = (l: string, slug: string) => getPathname({ locale: l as Locale, href: { pathname: '/projeler/[slug]', params: { slug } } })
const guidePath = (l: string, slug: string) => getPathname({ locale: l as Locale, href: { pathname: '/rehber/[slug]', params: { slug } } })
const imagePath = (l: string, slug: string) => getPathname({ locale: l as Locale, href: { pathname: '/galeri/[slug]', params: { slug } } })

/** Published services with every locale's text (public reads only). */
export const getServicesAllLocales = () =>
  unstable_cache(
    async () => {
      const res = await (await getPayload()).find({
        collection: 'categories',
        locale: 'all',
        sort: '_order',
        limit: 100,
        depth: 0,
        overrideAccess: false,
        where: { _status: { equals: 'published' } },
        select: { name: true, slug: true, shortDesc: true, faq: true, updatedAt: true },
      })
      return res.docs.map((d) => {
        const doc = d as unknown as { name: ByLocale; slug: ByLocale; shortDesc: ByLocale; faq: ByLocale<{ q: string; a: string }[]>; updatedAt: string }
        return { ...doc, paths: docPaths(doc.slug, doc.name, categoryPath) }
      })
    },
    ['seoServices'],
    { tags: [TAGS.categories], revalidate: HOUR },
  )()

/** Page sitemaps: published services, projects and guides — only their live locales (fixed routes and regions: data/sitemap). */
export const getSitemapPageDocs = () =>
  unstable_cache(
    async (): Promise<Record<'services' | 'projects' | 'guides', SitemapDoc[]>> => {
      const payload = await getPayload()
      const [services, projects, guides] = await Promise.all([
        getServicesAllLocales(),
        payload.find({
          collection: 'projects',
          locale: 'all',
          pagination: false,
          depth: 0,
          overrideAccess: false,
          where: { _status: { equals: 'published' } },
          select: { title: true, slug: true, updatedAt: true },
        }),
        payload.find({
          collection: 'guides',
          locale: 'all',
          pagination: false,
          depth: 0,
          overrideAccess: false,
          where: { _status: { equals: 'published' } },
          select: { title: true, slug: true, updatedAt: true },
        }),
      ])
      return {
        services: services.map((s) => ({ paths: s.paths, lastModified: s.updatedAt })),
        projects: projects.docs.map((d) => {
          const p = d as unknown as { title: ByLocale; slug: ByLocale; updatedAt: string }
          return { paths: docPaths(p.slug, p.title, projectPath), lastModified: p.updatedAt }
        }),
        guides: guides.docs.map((d) => {
          const g = d as unknown as { title: ByLocale; slug: ByLocale; updatedAt: string }
          return { paths: docPaths(g.slug, g.title, guidePath), lastModified: g.updatedAt }
        }),
      }
    },
    ['seoSitemapPageDocs'],
    { tags: [TAGS.categories, TAGS.projects, TAGS.guides], revalidate: HOUR },
  )()

/**
 * Approved gallery photos (the gallery's own filter: approved + an SEO filename), every locale's title, one SQL query.
 * The Payload find (locale 'all', afterRead per photo) took ~5 s cold for 3,300 photos; this reads only the columns the
 * sitemap needs and builds the CDN URLs with the storage plugin's own generateFileURL (mediaFileURL), never trusting
 * stored URL columns. tests/int/sitemap-photos checks it against the Payload read. Public data only (status approved).
 */
export async function loadSitemapPhotoDocs(payload: Payload): Promise<SitemapDoc[]> {
  const sizes = (payload.collections.media.config.upload.imageSizes ?? []).map((s) => s.name)
  // Size names are already snake case (w320…, portrait), as Payload names their columns.
  const col = (name: string, field: string) => sql.raw(`m."sizes_${name}_${field}"`)
  const res = await (payload.db as unknown as PostgresAdapter).drizzle.execute(sql`
    SELECT m."seo_filename" AS slug, m."updated_at" AS updated, m."filename", m."prefix", m."width", m."height",
      ${sql.join(sizes.map((n, i) => sql`${col(n, 'filename')} AS ${sql.raw(`"f${i}"`)}, ${col(n, 'width')} AS ${sql.raw(`"w${i}"`)}`), sql`, `)},
      (SELECT json_object_agg(l."_locale", l."title") FROM "media_locales" l WHERE l."_parent_id" = m."id") AS titles
    FROM "media" m
    WHERE m."status" = 'approved' AND m."seo_filename" IS NOT NULL
    ORDER BY m."id" DESC`)
  return res.rows.map((r) => {
    const row = r as { slug: string; updated: string | Date; filename: string | null; prefix: string | null; width: number | string | null; height: number | string | null; titles: ByLocale } & Record<string, unknown>
    const url = (f: string | null | undefined) => (f ? mediaFileURL(f, row.prefix) : null)
    const media: MediaLike = {
      url: url(row.filename),
      width: row.width == null ? null : Number(row.width),
      height: row.height == null ? null : Number(row.height),
      sizes: Object.fromEntries(sizes.map((n, i) => [n, { url: url(row[`f${i}`] as string | null), width: row[`w${i}`] == null ? null : Number(row[`w${i}`]) }])),
    }
    const src = responsiveImage(media).src
    const slug = Object.fromEntries(routing.locales.map((l) => [l, row.slug]))
    return { paths: docPaths(slug, row.titles, imagePath), lastModified: new Date(row.updated).toISOString(), images: src ? [src] : [] }
  })
}

/** Photo sitemaps: cached under the media tag, so a photo save refreshes them at once (#192). */
export const getSitemapPhotoDocs = () =>
  unstable_cache(async () => loadSitemapPhotoDocs(await getPayload()), ['seoSitemapPhotoDocs'], { tags: [TAGS.media], revalidate: HOUR })()
