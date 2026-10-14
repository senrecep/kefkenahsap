import { buildAlternates } from '@/lib/seo/alternates'

type Localized = { slug?: string | null; title?: string | null }

/** PLAN §5.1 "dil yayında": a locale is live when its slug and title are both filled. */
export const publishedLocales = (byLocale: Record<string, Localized | null | undefined>) =>
  Object.keys(byLocale).filter((l) => byLocale[l]?.slug?.trim() && byLocale[l]?.title?.trim())

const OG_LOCALES: Record<string, string> = { tr: 'tr_TR', en: 'en_US' }
export const ogLocale = (locale: string) => OG_LOCALES[locale] ?? locale

/**
 * One decision for canonical, hreflang, robots and og:locale. `paths` holds each locale's URL path,
 * null/undefined where that translation is not live. An untranslated current locale is noindex only:
 * no cross-locale canonical, and it never appears in any page's hreflang.
 */
export function localeSeo(args: { current: string; paths: Record<string, string | null | undefined>; site: string }) {
  const alternates = buildAlternates(args)
  const live = Object.keys(args.paths).filter((l) => args.paths[l])
  return {
    alternates,
    robots: alternates.canonical ? undefined : { index: false, follow: true },
    openGraph: {
      locale: ogLocale(args.current),
      alternateLocale: live.filter((l) => l !== args.current).map(ogLocale),
      ...(alternates.canonical ? { url: alternates.canonical } : {}),
    },
  }
}
