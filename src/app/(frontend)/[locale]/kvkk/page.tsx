import { RichText } from '@payloadcms/richtext-lexical/react'
import type { Metadata } from 'next'
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server'

import { ContentPage } from '@/components/content/ContentPage'
import { KvkkDraft, legalUses } from '@/content/legal/kvkk'
import type { Locale } from '@/i18n/routing'
import { CMS_PAGES, getPage, getPageTitles } from '@/lib/data/pages'
import { KVKK_TEXT_DATE } from '@/lib/leads/validate'
import { getSiteSettings } from '@/lib/data/site'
import { cmsPagePaths, pageMetadata } from '@/lib/seo/page-metadata'

const SLUGS = CMS_PAGES['/kvkk']
type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const [t, page, settings] = await Promise.all([getTranslations({ locale, namespace: 'Legal' }), getPage(locale as Locale, SLUGS), getSiteSettings(locale as Locale)])
  // An admin-written SEO title is complete; otherwise the layout template appends the company name.
  return pageMetadata({
    locale: locale as Locale,
    title: page?.seo?.title ? { absolute: page.seo.title } : (page?.title ?? t('kvkkTitle')),
    description: page?.seo?.description || t('kvkkDescription', { company: settings.companyName }),
    paths: await cmsPagePaths('/kvkk', await getPageTitles(SLUGS)),
  })
}

export default async function Page({ params }: Props) {
  const { locale: l } = await params
  const locale = l as Locale
  setRequestLocale(locale)
  const [t, format, page, settings] = await Promise.all([getTranslations('Legal'), getFormatter(), getPage(locale, SLUGS), getSiteSettings(locale)])
  if (page?.body)
    return (
      <ContentPage title={page.title} note={t('updated', { date: format.dateTime(new Date(page.updatedAt), { dateStyle: 'long' }) })}>
        <RichText data={page.body} />
      </ContentPage>
    )
  // In-repo template: dated by KVKK_TEXT_DATE, the same version the contact form's consent stores.
  return (
    <ContentPage title={t('kvkkTitle')} note={t('updated', { date: format.dateTime(new Date(KVKK_TEXT_DATE), { dateStyle: 'long' }) })}>
      <KvkkDraft
        locale={locale}
        c={{
          name: settings.companyName,
          person: settings.founder?.name,
          address: [settings.address?.street, settings.address?.district, settings.address?.city].filter(Boolean).join(', ') || undefined,
          email: settings.email,
        }}
        uses={legalUses(settings)}
      />
    </ContentPage>
  )
}
