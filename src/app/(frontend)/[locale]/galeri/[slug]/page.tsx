import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { GalleryGrid } from '@/components/gallery/GalleryGrid'
import { Container } from '@/components/ui/Container'
import { Picture } from '@/components/ui/Picture'
import { WhatsAppButton } from '@/components/ui/WhatsAppButton'
import { getPathname } from '@/i18n/navigation'
import { routing, type Locale } from '@/i18n/routing'
import { getGalleryPage, getImage } from '@/lib/data/gallery'
import { buildAlternates, siteUrl } from '@/lib/seo/alternates'

type Props = { params: Promise<{ locale: Locale; slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  const image = await getImage(locale, slug)
  if (!image) return {}
  const paths = Object.fromEntries(
    routing.locales.map((l) => [l, image.titledLocales.includes(l) ? getPathname({ locale: l, href: { pathname: '/galeri/[slug]', params: { slug } } }) : null]),
  )
  const { item } = image
  return {
    title: item.title,
    description: item.caption ?? item.alt,
    alternates: buildAlternates({ current: locale, paths, site: siteUrl() }),
    openGraph: { images: [{ url: item.media.sizes?.w1280?.url ?? item.media.url ?? '', alt: item.alt }] },
  }
}

export default async function ImagePage({ params }: Props) {
  const { locale, slug } = await params
  setRequestLocale(locale)
  const image = await getImage(locale, slug)
  if (!image) notFound()
  const { item, project, categoryId } = image
  const [t, related] = await Promise.all([
    getTranslations('Gallery'),
    categoryId ? getGalleryPage(locale, { categoryId, limit: 9 }) : null,
  ])
  const others = (related?.items ?? []).filter((r) => r.id !== item.id).slice(0, 8)
  const url = `${siteUrl().replace(/\/$/, '')}${item.href}`

  return (
    <>
      <Container className="pt-6 pb-12 md:pt-10">
        <a href={getPathname({ locale, href: '/galeri' })} className="text-[0.95rem] text-action underline">
          {t('back')}
        </a>
        <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <figure className="mx-auto w-full max-w-[min(100%,calc(80svh*var(--ratio)))]" style={{ ['--ratio' as string]: item.width && item.height ? item.width / item.height : 1.333 }}>
            <Picture media={item.media} alt={item.alt} sizes="(min-width: 1280px) 880px, (min-width: 1024px) 66vw, 100vw" priority className="rounded-[var(--radius-photo)]" />
          </figure>
          <div>
            <h1 className="text-[clamp(1.6rem,3vw,2.25rem)]">{item.title}</h1>
            {item.caption && <p className="mt-3 text-ink-soft">{item.caption}</p>}
            <dl className="mt-6 divide-y divide-line border-y border-line text-[0.95rem]">
              {item.category && (
                <div className="flex justify-between gap-4 py-3">
                  <dt className="text-ink-soft">{t('category')}</dt>
                  <dd><a href={item.category.href} className="text-action underline">{item.category.name}</a></dd>
                </div>
              )}
              {project && (
                <div className="flex justify-between gap-4 py-3">
                  <dt className="text-ink-soft">{t('project')}</dt>
                  <dd><a href={project.href} className="text-action underline">{project.title}</a></dd>
                </div>
              )}
            </dl>
            <WhatsAppButton locale={locale} place="image-page" context={{ kind: 'image', vars: { url } }} label={t('askAbout')} className="mt-6 w-full" />
          </div>
        </div>
      </Container>
      {others.length > 0 && (
        <Container as="section" className="border-t border-line pt-10 pb-20">
          <h2 className="mb-6 text-2xl">{t('related')}</h2>
          <GalleryGrid initial={others} total={others.length} />
        </Container>
      )}
    </>
  )
}
