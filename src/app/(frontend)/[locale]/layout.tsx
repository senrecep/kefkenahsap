import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { Montserrat, Source_Sans_3 } from 'next/font/google'

import { localeDir, routing } from '@/i18n/routing'
import './styles.css'

const montserrat = Montserrat({ subsets: ['latin', 'latin-ext'], weight: ['500', '600', '700'], variable: '--font-montserrat', display: 'swap' })
const sourceSans = Source_Sans_3({ subsets: ['latin', 'latin-ext'], weight: ['400', '600'], variable: '--font-source-sans', display: 'swap' })

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
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
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  )
}
