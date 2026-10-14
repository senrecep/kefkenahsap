import type { Metadata } from 'next'

import { getPathname } from '@/i18n/navigation'
import { routing, type Locale } from '@/i18n/routing'
import { getSiteSettings } from '@/lib/data/site'
import { cmsRoutePaths } from '@/lib/i18n/published'

import { siteUrl } from './alternates'
import { buildMetadata } from './metadata'

type Args = Omit<Parameters<typeof buildMetadata>[0], 'siteName' | 'site' | 'locale'> & { locale: Locale }

/** `generateMetadata` helper for every public page: see buildMetadata. */
export async function pageMetadata(args: Args): Promise<Metadata> {
  const settings = await getSiteSettings(args.locale)
  return buildMetadata({ ...args, siteName: settings.companyName, site: siteUrl() })
}

type StaticHref = Parameters<typeof getPathname>[0]['href'] & string

/** Paths of a fixed route that exists in every locale (gallery, about, legal…). */
export const staticPaths = (href: StaticHref) => Object.fromEntries(routing.locales.map((l) => [l, getPathname({ locale: l, href })]))

/** Fixed route whose text may come from a CMS page (about, legal): see cmsRoutePaths. */
export const cmsPagePaths = (href: StaticHref, titles: Record<string, string | null | undefined> | null) => cmsRoutePaths(staticPaths(href), titles)
