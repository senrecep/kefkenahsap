import { RichText } from '@payloadcms/richtext-lexical/react'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { ProjectCard } from '@/components/projects/ProjectCard'
import { Breadcrumb } from '@/components/site/Breadcrumb'
import { CtaBand } from '@/components/site/CtaBand'
import { Container } from '@/components/ui/Container'
import { Picture } from '@/components/ui/Picture'
import { getPathname, Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { getRegion } from '@/lib/data/regions'
import { metaDescription } from '@/lib/guides/meta'
import { safeDecode } from '@/lib/http/safe-decode'
import { bodyText } from '@/lib/regions/gate'
import { siteUrl } from '@/lib/seo/alternates'
import { pageMetadata } from '@/lib/seo/page-metadata'
import { requireLocale } from '@/i18n/require-locale'

type Params = Promise<{ locale: Locale; slug: string }>

// ISR on first request (see the locale layout).
export const generateStaticParams = () => []

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await requireLocale(params)
  const data = await getRegion(locale, safeDecode(slug))
  if (!data) notFound()
  // `paths` is null for every locale that fails the publish gate: that page is noindex and out of hreflang.
  return pageMetadata({
    locale,
    title: data.region.name,
    description: metaDescription(bodyText(data.region.body)),
    paths: data.paths,
  })
}

export default async function RegionPage({ params }: { params: Params }) {
  const { locale, slug: raw } = await requireLocale(params)
  setRequestLocale(locale)
  const slug = safeDecode(raw)
  const data = await getRegion(locale, slug)
  if (!data) notFound()
  const { region, cards, photos } = data
  const t = await getTranslations('Regions')
  const site = siteUrl().replace(/\/$/, '')
  const pathname = getPathname({ locale, href: { pathname: '/bolgeler/[slug]', params: { slug } } })
  const url = site + pathname
  const text = bodyText(region.body)
  const h2 = 'text-[1.6rem] leading-tight md:text-[2rem]'

  return (
    <>
      <Container as="header" className="pt-6 pb-8 md:pt-10 md:pb-10">
        {/* JSON-LD only for an indexable page (gate passed here). */}
        <Breadcrumb locale={locale} items={[{ name: region.name, path: pathname }]} structured={Boolean(data.paths[locale])} />
        <h1 className="mt-6 max-w-[24ch] text-[2.1rem] leading-[1.08] md:text-[3.2rem]">
          {region.name}
        </h1>
      </Container>

      {/* Hand-written text only (decision #25): an empty body renders nothing, never filler. */}
      {text && (
        <Container>
          <div className="max-w-[68ch] text-[1.0625rem] md:text-[1.125rem] [&_a]:text-action [&_a]:underline [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-[1.4rem] [&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:text-[1.2rem] [&_ol]:list-decimal [&_ol]:ps-6 [&_p]:mt-4 [&_ul]:list-disc [&_ul]:ps-6 [&>*:first-child]:mt-0">
            <RichText data={region.body!} disableContainer />
          </div>
        </Container>
      )}

      {cards.length > 0 && (
        <section aria-labelledby="projects-h" className="mt-16 md:mt-20">
          <Container>
            <h2 id="projects-h" className={h2}>
              {t('projects')}
            </h2>
            <ul className="mt-6 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((p) => (
                <li key={p.id}>
                  <ProjectCard project={p} />
                </li>
              ))}
            </ul>
          </Container>
        </section>
      )}

      {photos.length > 0 && (
        <section aria-labelledby="photos-h" className="mt-16 md:mt-20">
          <Container>
            <h2 id="photos-h" className={h2}>
              {t('photos')}
            </h2>
            <ul className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
              {photos.slice(0, 12).map((m) => {
                const pic = (
                  <Picture
                    media={m}
                    sizes="(min-width: 1280px) 400px, (min-width: 1024px) 33vw, 50vw"
                    maxWidth={1280}
                    className="aspect-[4/3]! rounded-[var(--radius-photo)]"
                  />
                )
                return (
                  <li key={m.id}>
                    {m.seoFilename ? (
                      <Link
                        href={{ pathname: '/galeri/[slug]', params: { slug: m.seoFilename } }}
                        className="block rounded-[var(--radius-photo)]"
                      >
                        {pic}
                      </Link>
                    ) : (
                      pic
                    )}
                  </li>
                )
              })}
            </ul>
          </Container>
        </section>
      )}

      <CtaBand
        locale={locale}
        title={t('ctaTitle')}
        wa={{ kind: 'default', vars: { url } }}
        place="region_cta"
      />
    </>
  )
}
