import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { JsonLd } from '@/components/seo/JsonLd'
import { Breadcrumb } from '@/components/site/Breadcrumb'
import { GuideCard } from '@/components/guides/GuideCard'
import { Container } from '@/components/ui/Container'
import { WhatsAppButton } from '@/components/ui/WhatsAppButton'
import { getPathname } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { getGuides } from '@/lib/data/guides'
import { siteUrl } from '@/lib/seo/alternates'
import { pageJsonLd } from '@/lib/seo/jsonld'
import { pageMetadata, staticPaths } from '@/lib/seo/page-metadata'
import { requireLocale } from '@/i18n/require-locale'

type Props = { params: Promise<{ locale: Locale }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await requireLocale(params)
  const t = await getTranslations({ locale, namespace: 'Guides' })
  const empty = (await getGuides(locale)).length === 0
  // An empty index is a thin page: keep it out of the index until the first guide is published.
  return pageMetadata({ locale, title: t('title'), description: t('metaDescription'), paths: await staticPaths('/rehber'), noindex: empty })
}

export default async function GuidesIndex({ params }: Props) {
  const { locale } = await requireLocale(params)
  setRequestLocale(locale)
  const [t, guides] = await Promise.all([getTranslations('Guides'), getGuides(locale)])

  const site = siteUrl().replace(/\/$/, '')
  const path = getPathname({ locale, href: '/rehber' })
  return (
    <Container className="pt-8 pb-20 md:pt-12">
      <JsonLd data={pageJsonLd('CollectionPage', { site, name: t('title'), path, description: t('intro'), locale })} />
      <Breadcrumb locale={locale} className="mb-6" items={[{ name: t('title'), path }]} />
      <header className="max-w-[46rem]">
        <h1 className="text-[clamp(2rem,4vw,3rem)]">{t('title')}</h1>
        <p className="mt-4 text-lg text-ink-soft">{t('intro')}</p>
      </header>

      {guides.length === 0 ? (
        <div className="mt-10 max-w-[46rem] border-t border-line pt-8">
          <p>{t('empty')}</p>
          <WhatsAppButton locale={locale} place="guides-empty" className="mt-6" />
        </div>
      ) : (
        // Every guide has the same "updated" day after a seed, so the index shows no dates (the guide page does).
        <ol className="mt-10 grid gap-x-8 gap-y-12 border-t border-line pt-10 md:grid-cols-2 md:gap-y-14">
          {guides.map((g, i) => (
            <li key={g.id}>
              <GuideCard guide={g} sizes="(min-width: 1280px) 600px, (min-width: 768px) calc(50vw - 2.75rem), calc(100vw - 2rem)" priority={i < 2} />
            </li>
          ))}
        </ol>
      )}
    </Container>
  )
}
