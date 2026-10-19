import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { GalleryFilters } from '@/components/gallery/GalleryFilters'
import { GalleryGrid } from '@/components/gallery/GalleryGrid'
import { JsonLd } from '@/components/seo/JsonLd'
import { Breadcrumb } from '@/components/site/Breadcrumb'
import { CtaBand } from '@/components/site/CtaBand'
import { Container } from '@/components/ui/Container'
import { getPathname } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { getGalleryPage, getGalleryTagRows, getUnfilteredGallery, resolveGalleryFilter } from '@/lib/data/gallery'
import { PAGE_SIZE, parseGalleryQuery } from '@/lib/gallery/query'
import { siteUrl } from '@/lib/seo/alternates'
import { pageJsonLd } from '@/lib/seo/jsonld'
import { pageMetadata, staticPaths } from '@/lib/seo/page-metadata'

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ locale }, query] = await Promise.all([params, searchParams])
  const parsed = parseGalleryQuery(query)
  const t = await getTranslations({ locale, namespace: 'Gallery' })
  return pageMetadata({
    locale,
    title: t('title'),
    description: t('metaDescription'),
    paths: await staticPaths('/galeri'),
    // No-JS "?sayfa=N" pages repeat page 1's photos; index only the first.
    noindex: parsed.ok && parsed.value.page > 1,
  })
}

export async function GalleryPage({ params, searchParams }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const parsed = parseGalleryQuery(await searchParams)
  if (!parsed.ok) notFound()
  const q = parsed.value

  const [t, { categories, tags, category, tag, unknown }] = await Promise.all([getTranslations('Gallery'), resolveGalleryFilter(locale, q)])
  const [rows, page] = await Promise.all([
    getGalleryTagRows(tags, q.tag, category?.id),
    unknown
      ? { items: [], total: 0, nextCursor: null }
      : !category && !tag
        ? getUnfilteredGallery(locale, q.page)
        : getGalleryPage(locale, { categoryId: category?.id, tagId: tag?.id, limit: PAGE_SIZE * q.page }),
  ])

  const filter = { ...(q.category ? { kategori: q.category } : {}), ...(q.tag ? { etiket: q.tag } : {}) }
  const base = getPathname({ locale, href: '/galeri' })
  const feedUrl = `${getPathname({ locale, href: { pathname: '/galeri/[slug]', params: { slug: 'feed' } } })}?${new URLSearchParams(filter)}`
  const moreHref = `${base}?${new URLSearchParams({ ...filter, sayfa: String(q.page + 1) })}`

  return (
    <>
      <Container className="pt-8 md:pt-12">
        <JsonLd data={pageJsonLd('CollectionPage', { site: siteUrl().replace(/\/$/, ''), name: t('title'), url: siteUrl().replace(/\/$/, '') + base, description: t('intro'), locale })} />
        <Breadcrumb locale={locale} className="mb-6" items={[{ name: t('title'), path: base }]} />
        <h1 className="text-[clamp(2rem,4vw,3rem)]">{category ? `${t('title')}: ${category.name}` : t('title')}</h1>
        <p className="mt-3 max-w-[60ch] text-ink-soft">{t('intro')}</p>
        <GalleryFilters locale={locale} categories={categories} types={rows.types} moreTypes={rows.moreTypes} tags={rows.others} tagCategories={rows.tagCategories} active={{ category: q.category, tag: q.tag }} className="mt-6 mb-6 md:mb-8" />
        {page.items.length ? (
          <GalleryGrid key={JSON.stringify(filter)} initial={page.items} total={page.total} nextCursor={page.nextCursor} feedUrl={feedUrl} moreHref={moreHref} priority />
        ) : (
          <div className="rounded-[var(--radius-photo)] border border-line px-6 py-12 text-center">
            <p>{t('empty')}</p>
            <a href={base} className="mt-3 inline-block text-action underline">{t('clear')}</a>
          </div>
        )}
      </Container>
      <CtaBand locale={locale} place="gallery_cta" />
    </>
  )
}
