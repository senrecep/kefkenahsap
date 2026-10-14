import { RichText } from '@payloadcms/richtext-lexical/react'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { ContentPage } from '@/components/content/ContentPage'
import { CookiesDraft } from '@/content/legal/cookies'
import type { Locale } from '@/i18n/routing'
import { getPage } from '@/lib/data/pages'
import { getSiteSettings } from '@/lib/data/site'
import { staticAlternates } from '@/lib/seo/static-alternates'

const SLUGS = ['cerez-politikasi', 'cookies']
type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const [t, page, settings] = await Promise.all([getTranslations({ locale, namespace: 'Legal' }), getPage(locale as Locale, SLUGS), getSiteSettings(locale as Locale)])
  return {
    title: page?.seo?.title || `${page?.title ?? t('cookiesTitle')} | ${settings.companyName}`,
    description: page?.seo?.description || t('cookiesDescription', { company: settings.companyName }),
    alternates: staticAlternates(locale, '/cerez-politikasi'),
  }
}

export default async function Page({ params }: Props) {
  const { locale: l } = await params
  const locale = l as Locale
  setRequestLocale(locale)
  const [t, page, settings] = await Promise.all([getTranslations('Legal'), getPage(locale, SLUGS), getSiteSettings(locale)])
  if (page?.body) return <ContentPage title={page.title}><RichText data={page.body} /></ContentPage>
  return (
    <ContentPage title={t('cookiesTitle')} note={t('draft')}>
      <CookiesDraft locale={locale} name={settings.companyName} />
    </ContentPage>
  )
}
