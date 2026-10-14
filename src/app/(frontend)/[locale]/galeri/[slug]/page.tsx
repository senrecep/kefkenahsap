import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { GalleryGrid } from '@/components/gallery/GalleryGrid'
import { JsonLd } from '@/components/seo/JsonLd'
import { Container } from '@/components/ui/Container'
import { Picture } from '@/components/ui/Picture'
import { WhatsAppButton } from '@/components/ui/WhatsAppButton'
import { getPathname } from '@/i18n/navigation'
import { routing, type Locale } from '@/i18n/routing'
import { getGalleryPage, getImage } from '@/lib/data/gallery'
import { getSiteSettings } from '@/lib/data/site'
import { responsiveImage } from '@/lib/media/image'
import { siteUrl } from '@/lib/seo/alternates'
import { breadcrumbJsonLd, imageObjectJsonLd } from '@/lib/seo/jsonld'
import { pageMetadata } from '@/lib/seo/page-metadata'

type Props = { params: Promise<{ locale: Locale; slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  const image = await getImage(locale, slug)
  if (!image) return {}
  // A locale without its own title shows Turkish fallback text: noindex, and left out of hreflang.
  const paths = Object.fromEntries(
    routing.locales.map((l) => [l, image.titledLocales.includes(l) ? getPathname({ locale: l, href: { pathname: '/galeri/[slug]', params: { slug } } }) : null]),
  )
  return pageMetadata({ locale, title: image.item.title, description: image.item.caption ?? image.item.alt, paths, ownOgImage: true })
}

export default async function ImagePage({ params }: Props) {
  const { locale, slug } = await params
  setRequestLocale(locale)
  const image = await getImage(locale, slug)
  if (!image) notFound()
  const { item, project, categoryId } = image
  const [t, related, settings] = await Promise.all([
    getTranslations('Gallery'),
    categoryId ? getGalleryPage(locale, { categoryId, limit: 9 }) : null,
    getSiteSettings(locale),
  ])
  const others = (related?.items ?? []).filter((r) => r.id !== item.id).slice(0, 8)
  const site = siteUrl().replace(/\/$/, '')
  const url = `${site}${item.href}`
  const photo = responsiveImage(item.media)

  return (
    <>
      <JsonLd
        data={[
          imageObjectJsonLd({ site, contentUrl: photo.src, url, name: item.title, caption: item.caption }),
          breadcrumbJsonLd([
            { name: settings.companyName, url: `${site}${getPathname({ locale, href: '/' })}` },
            { name: t('title'), url: `${site}${getPathname({ locale, href: '/galeri' })}` },
            { name: item.title, url },
          ]),
        ]}
      />
      <Container className="pt-6 pb-12 md:pt-10">
        <a href={getPathname({ locale, href: '/galeri' })} className="text-[0.95rem] text-action underline">
          {t('back')}
        </a>
        <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <figure className="me-auto w-full max-w-[min(100%,calc(80svh*var(--ratio)))]" style={{ ['--ratio' as string]: item.width && item.height ? item.width / item.height : 1.333 }}>
            <Picture media={item.media} alt={item.alt} sizes="(min-width: 1280px) 880px, (min-width: 1024px) 66vw, (min-width: 768px) calc(100vw - 3rem), calc(100vw - 2rem)" priority className="rounded-[var(--radius-photo)]" />
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
