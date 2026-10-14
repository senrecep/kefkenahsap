import type { Metadata } from 'next'

import { localeSeo } from '@/lib/i18n/published'

type Title = string | { absolute: string }

/**
 * Per-page metadata in one shape (PLAN §7 Teknik 2–4): title (the layout adds "| company"), description,
 * canonical + hreflang under the "dil yayında" rule, og:locale and OG/Twitter text. The image is the
 * site-wide card unless the page has its own `opengraph-image` file (category, project, photo): config
 * images would win over that file, so `ownOgImage` leaves them out.
 */
export const DEFAULT_OG_IMAGE = { url: '/og.jpg', width: 1200, height: 630 }

/** The <title> as rendered: the layout template appends " | company" unless the title is absolute. */
export const fullTitle = (title: Title, siteName: string) => (typeof title === 'string' ? `${title} | ${siteName}` : title.absolute)

const TITLE_MAX = 60

export function buildMetadata(args: {
  locale: string
  title: Title
  description?: string | null
  paths: Record<string, string | null | undefined>
  siteName: string
  site: string
  noindex?: boolean
  ownOgImage?: boolean
}): Metadata {
  const rendered = fullTitle(args.title, args.siteName)
  // Dev aid only: CMS titles are the editor's call, so production never warns.
  if (process.env.NODE_ENV !== 'production' && rendered.length > TITLE_MAX) {
    console.warn(`[seo] title is ${rendered.length} chars (> ${TITLE_MAX}, may be cut in results): "${rendered}"`)
  }
  const seo = localeSeo({ current: args.locale, paths: args.paths, site: args.site })
  const title = typeof args.title === 'string' ? args.title : args.title.absolute
  const text = { title, ...(args.description?.trim() ? { description: args.description.trim() } : {}) }
  const robots = args.noindex ? { index: false, follow: true } : seo.robots
  return {
    title: args.title,
    ...(text.description ? { description: text.description } : {}),
    alternates: seo.alternates,
    ...(robots ? { robots } : {}),
    openGraph: { type: 'website', siteName: args.siteName, ...text, ...seo.openGraph, ...(args.ownOgImage ? {} : { images: [DEFAULT_OG_IMAGE] }) },
    twitter: { card: 'summary_large_image', ...text },
  }
}
