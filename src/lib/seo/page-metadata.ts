import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { getPathname } from '@/i18n/navigation'
import { routing, type Locale } from '@/i18n/routing'
import { getSiteSettings } from '@/lib/data/site'
import { getContentLocales } from '@/lib/data/categories'
import { cmsRoutePaths, fixedRoutePaths } from '@/lib/i18n/published'

import { siteUrl } from './alternates'
import { buildMetadata, siteOgImage } from './metadata'

type Args = Omit<Parameters<typeof buildMetadata>[0], 'siteName' | 'site' | 'locale' | 'ogImage'> & { locale: Locale }

/** The site-wide share card of `locale` (see siteOgImage); its alt is the text the generated card shows. */
export async function siteOgImageFor(locale: Locale, defaultOgImage: unknown) {
  const t = await getTranslations({ locale, namespace: 'Site' })
  return siteOgImage(locale, defaultOgImage, `${t('name')} — ${t('tagline')}`)
}

/** `generateMetadata` helper for every public page: see buildMetadata. */
export async function pageMetadata(args: Args): Promise<Metadata> {
  const settings = await getSiteSettings(args.locale)
  const ogImage = await siteOgImageFor(args.locale, settings.defaultOgImage)
  return buildMetadata({ ...args, ogImage, siteName: settings.companyName, site: siteUrl() })
}

type StaticHref = Parameters<typeof getPathname>[0]['href'] & string

/** Paths of a fixed route (gallery, about, legal…): null in a locale without its own content (see fixedRoutePaths). */
export const staticPaths = async (href: StaticHref) =>
  fixedRoutePaths(Object.fromEntries(routing.locales.map((l) => [l, getPathname({ locale: l, href })])), await getContentLocales())

/** Fixed route whose text may come from a CMS page (about, legal): see cmsRoutePaths. */
export const cmsPagePaths = async (href: StaticHref, titles: Record<string, string | null | undefined> | null) =>
  cmsRoutePaths(await staticPaths(href), titles)
