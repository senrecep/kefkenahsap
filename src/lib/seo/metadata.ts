import type { Metadata } from 'next'

import { localeSeo } from '@/lib/i18n/published'
import type { MediaLike } from '@/lib/media/image'

type Title = string | { absolute: string }

/**
 * Per-page metadata in one shape (PLAN §7 Teknik 2–4): title (the layout adds "| company"), description,
 * canonical + hreflang under the "dil yayında" rule, og:locale and OG/Twitter text. The image is the
 * site-wide card unless the page has its own `opengraph-image` file (category, project, photo): config
 * images would win over that file, so `ownOgImage` leaves them out.
 */
export type OgImage = { url: string; width: number; height: number; alt: string }

/** The admin's default share image when it is populated: a bare id (not readable by the public) cannot be served. */
export const adminOgMedia = (v: unknown) => (v && typeof v === 'object' ? (v as MediaLike) : undefined)

/**
 * The site-wide card: the admin's default share image (cropped to 1200×630 by /og.jpg) when set, else the
 * generated card of the page language (public/og-<locale>.png, made by scripts/og/generate.ts).
 */
export const siteOgImage = (locale: string, defaultOgImage: unknown, alt: string): OgImage => ({
  url: adminOgMedia(defaultOgImage) ? '/og.jpg' : `/og-${locale}.png`,
  width: 1200,
  height: 630,
  alt,
})

/** The <title> as rendered: the layout template appends " | company" unless the title is absolute. */
export const fullTitle = (title: Title, siteName: string) => (typeof title === 'string' ? `${title} | ${siteName}` : title.absolute)

const TITLE_MAX = 60

// Google Discover / rich results need large image previews and unlimited snippets on indexable pages.
const PREVIEW = { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } as const

export function buildMetadata(args: {
  locale: string
  title: Title
  description?: string | null
  paths: Record<string, string | null | undefined>
  siteName: string
  site: string
  noindex?: boolean
  ownOgImage?: boolean
  ogImage: OgImage
}): Metadata {
  const rendered = fullTitle(args.title, args.siteName)
  // Dev aid only: CMS titles are the editor's call, so production never warns.
  if (process.env.NODE_ENV !== 'production' && rendered.length > TITLE_MAX) {
    console.warn(`[seo] title is ${rendered.length} chars (> ${TITLE_MAX}, may be cut in results): "${rendered}"`)
  }
  const seo = localeSeo({ current: args.locale, paths: args.paths, site: args.site })
  const title = typeof args.title === 'string' ? args.title : args.title.absolute
  const text = { title, ...(args.description?.trim() ? { description: args.description.trim() } : {}) }
  const images = args.ownOgImage ? {} : { images: [args.ogImage] }
  const robots = args.noindex ? { index: false, follow: true } : (seo.robots ?? PREVIEW)
  return {
    title: args.title,
    ...(text.description ? { description: text.description } : {}),
    alternates: seo.alternates,
    robots,
    openGraph: { type: 'website', siteName: args.siteName, ...text, ...seo.openGraph, ...images },
    twitter: { card: 'summary_large_image', ...text, ...images },
  }
}
