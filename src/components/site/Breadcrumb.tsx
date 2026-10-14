import { getTranslations } from 'next-intl/server'

import { JsonLd } from '@/components/seo/JsonLd'
import { getPathname } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { siteUrl } from '@/lib/seo/alternates'
import { breadcrumbJsonLd } from '@/lib/seo/jsonld'

/** Visible trail (home first, then `items`, the last being the current page). The BreadcrumbList is built from the same items, so they cannot drift (PLAN §7). */
export async function Breadcrumb({ locale, items, structured = true }: { locale: Locale; items: { name: string; path: string }[]; structured?: boolean }) {
  const tNav = await getTranslations('Nav')
  const site = siteUrl().replace(/\/$/, '')
  const trail = [{ name: tNav('home'), path: getPathname({ locale, href: '/' }) }, ...items]
  return (
    <>
      {structured && <JsonLd data={breadcrumbJsonLd(trail.map((i) => ({ name: i.name, url: site + i.path })))} />}
      <nav aria-label={tNav('breadcrumb')} className="text-[0.95rem] text-ink-soft">
        <ol className="flex flex-wrap gap-x-2">
          {trail.map((i, n) =>
            n < trail.length - 1 ? (
              <li key={i.path}>
                <a href={i.path} className="text-action underline">
                  {i.name}
                </a>
                <span aria-hidden className="ms-2">
                  /
                </span>
              </li>
            ) : (
              <li key={i.path} aria-current="page">
                {i.name}
              </li>
            ),
          )}
        </ol>
      </nav>
    </>
  )
}
