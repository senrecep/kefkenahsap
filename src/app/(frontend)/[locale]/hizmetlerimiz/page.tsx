import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Container } from '@/components/ui/Container'
import { Picture } from '@/components/ui/Picture'
import { getPathname, Link } from '@/i18n/navigation'
import { routing, type Locale } from '@/i18n/routing'
import { getServiceTiles } from '@/lib/data/categories'
import { buildAlternates, siteUrl } from '@/lib/seo/alternates'

type Params = Promise<{ locale: Locale }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Services' })
  const paths = Object.fromEntries(routing.locales.map((l) => [l, getPathname({ locale: l, href: '/hizmetlerimiz' })]))
  return { title: t('title'), description: t('description'), alternates: buildAlternates({ current: locale, paths, site: siteUrl() }) }
}

export default async function ServicesPage({ params }: { params: Params }) {
  const { locale } = await params
  setRequestLocale(locale)
  const [t, tiles] = await Promise.all([getTranslations('Services'), getServiceTiles(locale)])
  return (
    <Container className="pt-10 md:pt-16">
      <h1 className="text-[2.1rem] leading-[1.08] md:text-[3.2rem]">{t('title')}</h1>
      <p className="mt-5 max-w-[62ch] text-[1.15rem] text-ink-soft md:text-[1.25rem]">{t('description')}</p>
      <ul className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((c, i) => (
          <li key={c.id}>
            <Link href={{ pathname: '/[category]', params: { category: c.slug } }} className="group block">
              {c.image && (
                <Picture
                  media={c.image}
                  sizes="(min-width: 1280px) 400px, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  maxWidth={1280}
                  priority={i < 3}
                  className="aspect-[4/3]! rounded-[var(--radius-photo)]"
                  imgClassName="transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:scale-[1.03]"
                />
              )}
              <h2 className="mt-4 text-[1.3rem] group-hover:text-action">{c.name}</h2>
              {c.shortDesc && <p className="mt-1.5 line-clamp-3 text-ink-soft">{c.shortDesc}</p>}
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  )
}
