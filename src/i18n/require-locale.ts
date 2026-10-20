import { hasLocale } from 'next-intl'
import { notFound } from 'next/navigation'

import { routing, type Locale } from './routing'

// Pages and generateMetadata render in parallel with the layout, so each must reject a bogus [locale] (".svn", "foo")
// itself before any data access; a bad locale reaching the DB is a 500, not a 404.
export async function requireLocale<P extends { locale: string }>(params: Promise<P>): Promise<Omit<P, 'locale'> & { locale: Locale }> {
  const p = await params
  if (!hasLocale(routing.locales, p.locale)) notFound()
  return p as Omit<P, 'locale'> & { locale: Locale }
}
