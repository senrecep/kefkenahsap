import { unstable_cache } from 'next/cache'

import { getPathname } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { galleryWhere } from '@/lib/gallery/query'
import { livePaths } from '@/lib/i18n/published'
import { responsiveImage, type MediaLike } from '@/lib/media/image'
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

/** Sitemap documents: services, published projects and guides, and approved photos — only their live locales. */
export const getSitemapDocs = () =>
  unstable_cache(
    async (): Promise<SitemapDoc[]> => {
      const payload = await getPayload()
      const [services, projects, guides, media] = await Promise.all([
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
        payload.find({
          collection: 'media',
          locale: 'all',
          pagination: false,
          depth: 0,
          overrideAccess: false,
          where: galleryWhere({}),
          sort: '-id',
          select: { title: true, seoFilename: true, updatedAt: true, url: true, width: true, height: true, sizes: true, filename: true, prefix: true, _objectKey: true },
        }),
      ])
      return [
        ...services.map((s) => ({ paths: s.paths, lastModified: s.updatedAt })),
        ...projects.docs.map((d) => {
          const p = d as unknown as { title: ByLocale; slug: ByLocale; updatedAt: string }
          return { paths: docPaths(p.slug, p.title, projectPath), lastModified: p.updatedAt }
        }),
        ...guides.docs.map((d) => {
          const g = d as unknown as { title: ByLocale; slug: ByLocale; updatedAt: string }
          return { paths: docPaths(g.slug, g.title, guidePath), lastModified: g.updatedAt }
        }),
        ...media.docs.map((d) => {
          const m = d as unknown as MediaLike & { title: ByLocale; seoFilename: string; updatedAt: string }
          const slug = Object.fromEntries(routing.locales.map((l) => [l, m.seoFilename]))
          const src = responsiveImage(m).src
          return { paths: docPaths(slug, m.title, imagePath), lastModified: m.updatedAt, images: src ? [src] : [] }
        }),
      ]
    },
    ['seoSitemapDocs'],
    { tags: [TAGS.categories, TAGS.projects, TAGS.guides, TAGS.media], revalidate: HOUR },
  )()
