import { getPathname } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'

import { buildAlternates, siteUrl } from './alternates'

type StaticHref = Parameters<typeof getPathname>[0]['href'] & string

/** hreflang/canonical for a fixed route that exists in every locale (about, legal, contact…). */
export const staticAlternates = (current: string, href: StaticHref) =>
  buildAlternates({
    current,
    paths: Object.fromEntries(routing.locales.map((l) => [l, getPathname({ locale: l, href })])),
    site: siteUrl(),
  })
