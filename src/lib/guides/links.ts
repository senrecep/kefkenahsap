import { routing } from '@/i18n/routing'

// "/<locale>/<that locale's guide segment>/<slug>" for every locale, from the routing table (ru /stati, de /ratgeber, …).
const segments = routing.pathnames['/rehber']
const GUIDE_LINK = new RegExp(`^/(?:${routing.locales.map((l) => `${l}${segments[l]}`).join('|')})/[^/?#]+$`)

/** A link to a guide page (any locale), as written in a guide body. */
export const isGuideLink = (url: string) => GUIDE_LINK.test(url)
