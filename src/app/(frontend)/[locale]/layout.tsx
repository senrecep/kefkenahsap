import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { Montserrat, Source_Sans_3 } from 'next/font/google'

import { Footer } from '@/components/site/Footer'
import { Header } from '@/components/site/Header'
import { MobileActionBar } from '@/components/site/MobileActionBar'
import { localeDir, routing, type Locale } from '@/i18n/routing'
import './styles.css'

const montserrat = Montserrat({ subsets: ['latin', 'latin-ext'], weight: ['600', '700'], variable: '--font-montserrat', display: 'swap' })
const sourceSans = Source_Sans_3({ subsets: ['latin', 'latin-ext'], weight: ['400', '600'], variable: '--font-source-sans', display: 'swap' })

// Pages read CMS data per request (cached via unstable_cache tags + Cloudflare edge); no DB needed at build time.
export const dynamic = 'force-dynamic'

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
          <Footer locale={locale as Locale} />
          <MobileActionBar locale={locale as Locale} />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
