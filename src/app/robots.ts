import type { MetadataRoute } from 'next'

import { getPathname } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { siteUrl } from '@/lib/seo/alternates'
import { robotsFor } from '@/lib/seo/robots'

export const dynamic = 'force-dynamic'

export default function robots(): MetadataRoute.Robots {
  return robotsFor({
    siteEnv: process.env.SITE_ENV,
    site: siteUrl(),
    searchPaths: routing.locales.map((locale) => getPathname({ locale, href: '/ara' })),
  })
}
