import type { Metadata } from 'next'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import localFont from 'next/font/local'

import { Analytics } from '@/components/site/Analytics'
import { Footer } from '@/components/site/Footer'
import { Header } from '@/components/site/Header'
import { MobileActionBar } from '@/components/site/MobileActionBar'
import { localeDir, routing, type Locale } from '@/i18n/routing'
import { getSiteSettings } from '@/lib/data/site'
import { ogLocale } from '@/lib/i18n/published'
import { siteUrl } from '@/lib/seo/alternates'
import { DEFAULT_OG_IMAGE } from '@/lib/seo/metadata'
import './styles.css'

// Self-hosted (OFL, subset to Latin + Turkish, weights 600–700 / 400–600): builds never depend on Google Fonts.
const montserrat = localFont({ src: '../../fonts/Montserrat.woff2', weight: '600 700', variable: '--font-montserrat', display: 'swap' })
const sourceSans = localFont({ src: '../../fonts/SourceSans3.woff2', weight: '400 600', variable: '--font-source-sans', display: 'swap' })

// Pages read CMS data per request (cached via unstable_cache tags + Cloudflare edge); no DB needed at build time.
export const dynamic = 'force-dynamic'

// Site-wide defaults; pages set their own text and alternates through `pageMetadata` (src/lib/seo).
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const settings = await getSiteSettings(locale)
  return {
    metadataBase: new URL(siteUrl()),
    title: { template: `%s | ${settings.companyName}`, default: settings.companyName },
    ...(settings.defaultDescription ? { description: settings.defaultDescription } : {}),
    openGraph: { type: 'website', siteName: settings.companyName, locale: ogLocale(locale), images: [DEFAULT_OG_IMAGE] },
    twitter: { card: 'summary_large_image' },
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)
  return (
    <html lang={locale} dir={localeDir(locale)} className={`${montserrat.variable} ${sourceSans.variable}`}>
      <body className="min-h-dvh antialiased">
        <NextIntlClientProvider>
          <Header locale={locale as Locale} />
          <main id="main">{children}</main>
          {/* Right after the content so keyboard users reach the cookie choice before the footer. */}
          <Analytics locale={locale} />
          <Footer locale={locale as Locale} />
          <MobileActionBar locale={locale as Locale} />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
