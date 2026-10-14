import type { Metadata } from 'next'
import { hasLocale } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import localFont from 'next/font/local'

import { Analytics } from '@/components/site/Analytics'
import { Footer } from '@/components/site/Footer'
import { Header } from '@/components/site/Header'
import { JsonLd } from '@/components/seo/JsonLd'
import { MobileActionBar } from '@/components/site/MobileActionBar'
import { localeDir, routing, type Locale } from '@/i18n/routing'
import { getSiteSettings } from '@/lib/data/site'
import { ogLocale } from '@/lib/i18n/published'
import { siteUrl } from '@/lib/seo/alternates'
import { businessJsonLd, websiteJsonLd } from '@/lib/seo/jsonld'
import { DEFAULT_OG_IMAGE } from '@/lib/seo/metadata'
import './styles.css'

// Self-hosted (OFL, Latin subset, Montserrat 600 / Source Sans 3 400–600; src/app/fonts/README.md): no Google Fonts at build.
const montserrat = localFont({ src: '../../fonts/Montserrat.woff2', weight: '600', variable: '--font-montserrat', display: 'swap' })
const sourceSans = localFont({ src: '../../fonts/SourceSans3.woff2', weight: '400 600', variable: '--font-source-sans', display: 'swap' })
// Cyrillic subsets (ru): unicode-range makes the browser fetch them only for pages with Cyrillic text, so no preload;
// no fallback font, else the stack would draw Latin text in it before reaching the Latin face.
const montserratCyr = localFont({ src: '../../fonts/Montserrat-cyrillic.woff2', weight: '600', variable: '--font-montserrat-cyr', display: 'swap', preload: false, adjustFontFallback: false, declarations: [{ prop: 'unicode-range', value: 'U+0400-045F, U+0490-0491, U+2116' }] })
const sourceSansCyr = localFont({ src: '../../fonts/SourceSans3-cyrillic.woff2', weight: '400 600', variable: '--font-source-sans-cyr', display: 'swap', preload: false, adjustFontFallback: false, declarations: [{ prop: 'unicode-range', value: 'U+0400-045F, U+0490-0491, U+2116' }] })

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
  // The business facts are the ones the footer shows on every page.
  const settings = await getSiteSettings(locale)
  const site = siteUrl().replace(/\/$/, '')
  const home = `${site}/${locale}`
  return (
    <html lang={locale} dir={localeDir(locale)} className={`${montserrat.variable} ${sourceSans.variable} ${montserratCyr.variable} ${sourceSansCyr.variable}`}>
      <body className="min-h-dvh antialiased">
        {/* No site-wide NextIntlClientProvider: client components get server-translated props, which keeps
            next-intl's message formatter out of every page's JS (budget, #52). */}
        <Header locale={locale as Locale} />
        <main id="main">{children}</main>
        {/* Right after the content so keyboard users reach the cookie choice before the footer. */}
        <Analytics locale={locale} />
        <Footer locale={locale as Locale} />
        <MobileActionBar locale={locale as Locale} />
        <JsonLd
          data={[
            businessJsonLd(settings, { site, url: home, logo: `${site}/brand/logo.png`, image: `${site}${DEFAULT_OG_IMAGE.url}` }),
            websiteJsonLd({ name: settings.companyName, site, url: home, locale }),
          ]}
        />
      </body>
    </html>
  )
}
