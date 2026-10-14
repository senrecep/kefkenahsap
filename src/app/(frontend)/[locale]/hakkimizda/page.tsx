import { RichText } from '@payloadcms/richtext-lexical/react'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Maybe } from 'tsentials/maybe'

import { ContentPage } from '@/components/content/ContentPage'
import { buttonClass } from '@/components/ui/button'
import { WhatsAppButton } from '@/components/ui/WhatsAppButton'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { sinceYear } from '@/lib/company'
import { CMS_PAGES, getPage, getPageTitles } from '@/lib/data/pages'
import { getSiteSettings } from '@/lib/data/site'
import { cmsPagePaths, pageMetadata } from '@/lib/seo/page-metadata'

const SLUGS = CMS_PAGES['/hakkimizda']
type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const [t, page, settings] = await Promise.all([getTranslations({ locale, namespace: 'About' }), getPage(locale as Locale, SLUGS), getSiteSettings(locale as Locale)])
  // An admin-written SEO title is complete; otherwise the layout template appends the company name.
  return pageMetadata({
    locale: locale as Locale,
    title: page?.seo?.title ? { absolute: page.seo.title } : (page?.title ?? t('title')),
    description: page?.seo?.description || t('metaDescription', { company: settings.companyName, district: settings.address?.district || settings.address?.city || 'none' }),
    paths: await cmsPagePaths('/hakkimizda', await getPageTitles(SLUGS)),
  })
}

export default async function AboutPage({ params }: Props) {
  const { locale: l } = await params
  const locale = l as Locale
  setRequestLocale(locale)
  const [t, page, settings] = await Promise.all([getTranslations('About'), getPage(locale, SLUGS), getSiteSettings(locale)])
  const since = sinceYear({ foundingYear: settings.foundingYear })
  const a = settings.address
  // Only confirmed siteSettings facts; an empty field renders nothing (PRODUCT.md).
  const facts = [
    Maybe.isSome(since) && { k: t('since'), v: String(since.value) },
    settings.founder?.name && { k: t('founder'), v: settings.founder.name },
    (a?.district || a?.city) && { k: t('workshop'), v: [a?.district, a?.city].filter(Boolean).join(', ') },
  ].filter((f): f is { k: string; v: string } => Boolean(f))

  return (
    <ContentPage title={page?.title ?? t('title')}>
      {page?.body ? <RichText data={page.body} /> : <p className="text-xl">{t('lead', { company: settings.companyName })}</p>}
      {!!facts.length && (
        <dl className="mt-10 grid gap-x-10 gap-y-5 border-t border-line pt-6 sm:grid-cols-3">
          {facts.map((f) => (
            <div key={f.k}>
              <dt className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wide text-ink-soft">{f.k}</dt>
              <dd className="mt-1 text-xl">{f.v}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="mt-10 flex flex-wrap gap-3">
        <WhatsAppButton locale={locale} place="about" />
        <Link href="/galeri" className={buttonClass.outline}>{t('seeWork')}</Link>
        <Link href="/iletisim" className={buttonClass.quiet}>{t('contact')}</Link>
      </div>
    </ContentPage>
  )
}
