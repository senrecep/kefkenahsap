import { getLocale } from 'next-intl/server'
import NextLink from 'next/link'
import { createElement, type ComponentProps } from 'react'

import { localizedPathname } from '@/lib/i18n/pathname'

import { routing, type Locale } from './routing'

// Not next-intl's createNavigation: importing it on the server also ships its client Link, which needs a
// NextIntlClientProvider and pulls the message formatter (~13 KB gz) into every page (JS budget, #52).
type Pathname = keyof typeof routing.pathnames
export type Href = Parameters<typeof localizedPathname<Pathname>>[1]['href']

export const getPathname = ({ locale, href }: { locale: Locale; href: Href }) => localizedPathname(routing, { locale, href })

/** Server-only localized link: resolves the pathname here and renders a plain next/link. */
export async function Link({ href, locale, ...rest }: Omit<ComponentProps<typeof NextLink>, 'href' | 'locale'> & { href: Href; locale?: Locale }) {
  return createElement(NextLink, { ...rest, href: getPathname({ href, locale: locale ?? ((await getLocale()) as Locale) }) })
}
