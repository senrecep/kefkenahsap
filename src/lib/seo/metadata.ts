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
