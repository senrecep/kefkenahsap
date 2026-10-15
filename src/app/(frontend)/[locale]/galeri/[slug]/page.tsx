import { ArrowLeft, ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { GalleryGrid } from '@/components/gallery/GalleryGrid'
import { JsonLd } from '@/components/seo/JsonLd'
import { Breadcrumb } from '@/components/site/Breadcrumb'
import { Container } from '@/components/ui/Container'
import { Picture } from '@/components/ui/Picture'
import { WhatsAppButton } from '@/components/ui/WhatsAppButton'
import { getPathname } from '@/i18n/navigation'
import { routing, type Locale } from '@/i18n/routing'
import { getCategorySequence, getGalleryPage, getImage } from '@/lib/data/gallery'
import { neighbours } from '@/lib/gallery/neighbours'
import { responsiveImage } from '@/lib/media/image'
import { siteUrl } from '@/lib/seo/alternates'
import { imageObjectJsonLd } from '@/lib/seo/jsonld'
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
  const { item, project, categoryId, tags } = image
  const [t, related, sequence] = await Promise.all([
    getTranslations('Gallery'),
    categoryId ? getGalleryPage(locale, { categoryId, limit: 9 }) : null,
    categoryId ? getCategorySequence(locale, categoryId) : [],
  ])
  const { prev, next } = neighbours(sequence, slug)
  const step = 'group flex min-h-12 min-w-0 flex-col justify-center gap-0.5 py-3'
  const others = (related?.items ?? []).filter((r) => r.id !== item.id).slice(0, 8)
  const site = siteUrl().replace(/\/$/, '')
  const url = `${site}${item.href}`
  const photo = responsiveImage(item.media)

  return (
    <>
      <JsonLd
        data={[
          imageObjectJsonLd({ site, contentUrl: photo.src, url, name: item.title, caption: item.caption }),
        ]}
      />
      <Container className="pt-6 pb-12 md:pt-10">
        <Breadcrumb
          locale={locale}
          items={[
            { name: t('title'), path: getPathname({ locale, href: '/galeri' }) },
            { name: item.title, path: item.href },
          ]}
        />
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <figure className="me-auto w-full max-w-[min(100%,calc(80svh*var(--ratio)))]" style={{ ['--ratio' as string]: item.width && item.height ? item.width / item.height : 1.333 }}>
            <Picture media={item.media} alt={item.alt} altLang={item.altLang} sizes="(min-width: 1280px) 880px, (min-width: 1024px) 66vw, (min-width: 768px) calc(100vw - 3rem), calc(100vw - 2rem)" priority className="rounded-[var(--radius-photo)]" />
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
              {tags.length > 0 && (
                <div className="grid gap-2.5 py-3">
                  <dt className="text-ink-soft">{t('tags')}</dt>
                  <dd>
                    <ul className="flex flex-wrap gap-2">
                      {tags.map((x) => (
                        <li key={x.href}>
                          <a href={x.href} className="inline-flex min-h-11 items-center rounded-full border border-line bg-paper px-4 font-[family-name:var(--font-display)] text-[0.875rem] font-semibold hover:border-ink/40">
                            {x.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              )}
            </dl>
            <WhatsAppButton locale={locale} place="image-page" context={{ kind: 'image', vars: { url } }} label={t('askAbout')} className="mt-6 w-full" />
            {(prev || next) && (
              // Within the category, in the order its page shows; titles are the photos' own.
              <nav aria-label={item.category?.name ?? t('category')} className="mt-6 grid grid-cols-2 gap-4 border-t border-line text-[0.95rem]">
                {prev ? (
                  <a href={prev.href} rel="prev" className={step}>
                    <span className="inline-flex items-center gap-1.5 font-[family-name:var(--font-display)] font-semibold text-action group-hover:text-action-deep">
                      <ArrowLeft aria-hidden size={18} strokeWidth={1.75} className="rtl:rotate-180" />
                      {t('prev')}
                    </span>
                    <span className="line-clamp-1 w-full text-ink-soft">{prev.title}</span>
                  </a>
                ) : (
                  <span />
                )}
                {next && (
                  <a href={next.href} rel="next" className={`${step} items-end text-end`}>
                    <span className="inline-flex items-center gap-1.5 font-[family-name:var(--font-display)] font-semibold text-action group-hover:text-action-deep">
                      {t('next')}
                      <ArrowRight aria-hidden size={18} strokeWidth={1.75} className="rtl:rotate-180" />
                    </span>
                    <span className="line-clamp-1 w-full text-ink-soft">{next.title}</span>
                  </a>
                )}
              </nav>
            )}
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
