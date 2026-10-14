import { RichText } from '@payloadcms/richtext-lexical/react'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { ContentPage } from '@/components/content/ContentPage'
import { KvkkDraft } from '@/content/legal/kvkk'
import type { Locale } from '@/i18n/routing'
import { getPage } from '@/lib/data/pages'
import { getSiteSettings } from '@/lib/data/site'
import { pageMetadata, staticPaths } from '@/lib/seo/page-metadata'

const SLUGS = ['kvkk', 'privacy']
type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const [t, page, settings] = await Promise.all([getTranslations({ locale, namespace: 'Legal' }), getPage(locale as Locale, SLUGS), getSiteSettings(locale as Locale)])
  // An admin-written SEO title is complete; otherwise the layout template appends the company name.
  return pageMetadata({
    locale: locale as Locale,
    title: page?.seo?.title ? { absolute: page.seo.title } : (page?.title ?? t('kvkkTitle')),
    description: page?.seo?.description || t('kvkkDescription', { company: settings.companyName }),
    paths: staticPaths('/kvkk'),
  })
}

export default async function Page({ params }: Props) {
  const { locale: l } = await params
  const locale = l as Locale
  setRequestLocale(locale)
  const [t, page, settings] = await Promise.all([getTranslations('Legal'), getPage(locale, SLUGS), getSiteSettings(locale)])
  if (page?.body) return <ContentPage title={page.title}><RichText data={page.body} /></ContentPage>
  return (
    <ContentPage title={t('kvkkTitle')} note={t('draft')}>
      <KvkkDraft
        locale={locale}
        c={{
          name: settings.companyName,
          address: [settings.address?.street, settings.address?.district, settings.address?.city].filter(Boolean).join(', ') || undefined,
          email: settings.email,
        }}
      />
    </ContentPage>
  )
}
