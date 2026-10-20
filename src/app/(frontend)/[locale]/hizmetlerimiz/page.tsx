import type { Metadata } from 'next'
import { ArrowRight } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { JsonLd } from '@/components/seo/JsonLd'
import { Breadcrumb } from '@/components/site/Breadcrumb'
import { CtaBand } from '@/components/site/CtaBand'
import { Container } from '@/components/ui/Container'
import { Picture } from '@/components/ui/Picture'
import { getPathname, Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { getServiceTiles } from '@/lib/data/categories'
import { getFeaturedImages } from '@/lib/data/home'
import { galleryTileCover, galleryTileFills } from '@/lib/gallery/curate'
import { siteUrl } from '@/lib/seo/alternates'
import { pageJsonLd } from '@/lib/seo/jsonld'
import { pageMetadata, staticPaths } from '@/lib/seo/page-metadata'
import { requireLocale } from '@/i18n/require-locale'

type Params = Promise<{ locale: Locale }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await requireLocale(params)
  const t = await getTranslations({ locale, namespace: 'Services' })
  return pageMetadata({ locale, title: t('title'), description: t('description'), paths: await staticPaths('/hizmetlerimiz') })
}

export default async function ServicesPage({ params }: { params: Params }) {
  const { locale } = await requireLocale(params)
  setRequestLocale(locale)
  const [t, tGallery, tiles, curated] = await Promise.all([getTranslations('Services'), getTranslations('Gallery'), getServiceTiles(locale), getFeaturedImages(locale, 24).catch(() => [])])
  const cover = galleryTileCover(curated, tiles)
  const sizes = '(min-width: 1280px) 400px, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw'
  const zoom = 'transition-transform duration-500 ease-[var(--ease-out-expo)] motion-safe:group-hover:scale-[1.03]'
  const site = siteUrl().replace(/\/$/, '')
  const path = getPathname({ locale, href: '/hizmetlerimiz' })
  return (
    <>
      <Container className="pt-10 md:pt-16">
        <JsonLd data={pageJsonLd('CollectionPage', { site, name: t('title'), path, description: t('description'), locale })} />
        <Breadcrumb locale={locale} className="mb-6" items={[{ name: t('title'), path }]} />
        <h1 className="text-[2.1rem] leading-[1.08] md:text-[3.2rem]">{t('title')}</h1>
        <p className="mt-5 max-w-[62ch] text-[1.15rem] text-ink-soft md:text-[1.25rem]">{t('description')}</p>
        <ul className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((c, i) => (
            <li key={c.id}>
              <Link href={{ pathname: '/[category]', params: { category: c.slug } }} className="group block">
                {c.image && (
                  <Picture
                    media={c.image}
                    sizes={sizes}
                    maxWidth={1280}
                    priority={i === 0}
                    className="aspect-[4/3]! rounded-[var(--radius-photo)]"
                    imgClassName={zoom}
                  />
                )}
                <h2 className="mt-4 text-[1.3rem] group-hover:text-action">{c.name}</h2>
                {c.shortDesc && <p className="mt-1.5 line-clamp-3 text-ink-soft">{c.shortDesc}</p>}
              </Link>
            </li>
          ))}
          {/* The last cell: the whole gallery, when it closes a hole (11 services) in the 2- and 3-column grids. */}
          {galleryTileFills(tiles.length) && (
            <li>
              <Link href="/galeri" className="group block">
                {cover && <Picture media={cover.media} alt="" sizes={sizes} maxWidth={1280} className="aspect-[4/3]! rounded-[var(--radius-photo)]" imgClassName={zoom} />}
                <h2 className="mt-4 flex items-center gap-2 text-[1.3rem] group-hover:text-action">
                  {tGallery('title')}
                  <ArrowRight aria-hidden size={20} strokeWidth={1.75} className="shrink-0 text-action rtl:rotate-180" />
                </h2>
                <p className="mt-1.5 line-clamp-3 text-ink-soft">{t('galleryText')}</p>
              </Link>
            </li>
          )}
        </ul>
      </Container>
      <CtaBand locale={locale} place="services_cta" />
    </>
  )
}
