import { buildAlternates } from '@/lib/seo/alternates'

type Localized = { slug?: string | null; title?: string | null }

/** PLAN §5.1 "dil yayında": a locale is live when its slug and title are both filled. */
export const publishedLocales = (byLocale: Record<string, Localized | null | undefined>) =>
  Object.keys(byLocale).filter((l) => byLocale[l]?.slug?.trim() && byLocale[l]?.title?.trim())

/** Each locale's URL path where the translation is live, else null: the input for localeSeo and the sitemap. */
export function livePaths(byLocale: Record<string, Localized | null | undefined>, toPath: (locale: string, slug: string) => string) {
  const live = publishedLocales(byLocale)
  return Object.fromEntries(Object.keys(byLocale).map((l) => [l, live.includes(l) ? toPath(l, byLocale[l]!.slug!) : null]))
}

/**
 * A fixed route whose text may come from a CMS page: with no page every locale shows the in-repo template (live);
 * with one, a locale lacking its own title shows fallback text, so it is noindex and left out of hreflang.
 */
export function cmsRoutePaths(paths: Record<string, string | null>, titles: Record<string, string | null | undefined> | null) {
  if (!titles) return paths
  return livePaths(Object.fromEntries(Object.keys(paths).map((l) => [l, { slug: paths[l], title: titles[l] }])), (l) => paths[l]!)
}

/**
 * A fixed route (home, gallery, services, contact…) is a shell of UI strings around CMS content, so it counts as
 * translated only in `contentLocales` (locales whose own content is live); elsewhere its path is null → noindex.
 */
export const fixedRoutePaths = (paths: Record<string, string | null>, contentLocales: readonly string[]) =>
  Object.fromEntries(Object.entries(paths).map(([l, p]) => [l, contentLocales.includes(l) ? p : null]))

const OG_LOCALES: Record<string, string> = { tr: 'tr_TR', en: 'en_US', ru: 'ru_RU', de: 'de_DE', ar: 'ar_AR' }
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
