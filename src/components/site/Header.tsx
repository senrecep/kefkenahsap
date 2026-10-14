import { Phone } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { telLink } from '@/lib/contact'
import { getNavCategories, getSiteSettings } from '@/lib/data/site'

import { LanguageSwitcher } from './LanguageSwitcher'
import { Logo } from './Logo'
import { MobileMenu } from './MobileMenu'

const linkCls =
  'inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-3 font-[family-name:var(--font-display)] text-[0.95rem] font-semibold text-ink hover:text-action'

export async function Header({ locale }: { locale: Locale }) {
  const [t, settings, categories] = await Promise.all([getTranslations('Nav'), getSiteSettings(locale), getNavCategories(locale)])
  const tel = telLink(settings)
  const links = [
    { href: '/projeler', label: t('projects') },
    { href: '/galeri', label: t('gallery') },
    { href: '/rehber', label: t('guides') },
    { href: '/referanslar', label: t('references') },
    { href: '/iletisim', label: t('contact') },
  ] as const

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/95 backdrop-blur-sm [--header-h:4.5rem]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-3 focus:z-50 focus:bg-paper focus:px-4 focus:py-2">
        {t('skip')}
      </a>
      <div className="mx-auto flex h-[var(--header-h)] max-w-7xl items-center gap-4 px-4 md:px-6">
        <Logo />
        <nav aria-label={t('menu')} className="ms-auto hidden items-center gap-1 lg:flex">
          {/* Services: hover/focus panel, works without JS */}
          <div className="group relative">
            <Link href="/hizmetlerimiz" className={linkCls}>
              {t('services')}
            </Link>
            <div className="invisible absolute start-0 top-full w-[34rem] translate-y-1 rounded-[var(--radius-photo)] border border-line bg-paper p-3 opacity-0 shadow-[var(--shadow-float)] transition duration-150 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
              <ul className="grid grid-cols-2 gap-1">
                {categories.map((c) => (
                  <li key={c.id}>
                    <Link href={{ pathname: '/[category]', params: { category: c.slug ?? '' } }} className="block rounded-md px-3 py-2.5 text-[0.95rem] text-ink hover:bg-mist">
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={linkCls}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-1 lg:ms-2">
          {tel && (
            <a href={tel.href} data-umami-event="phone_click" data-umami-event-place="header" className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] px-2 font-[family-name:var(--font-display)] text-sm font-semibold text-ink hover:text-action">
              <Phone aria-hidden size={18} strokeWidth={1.75} />
              <span className="hidden xl:inline">{tel.label}</span>
              <span className="sr-only xl:hidden">{t('contact')}</span>
            </a>
          )}
          <LanguageSwitcher className="hidden sm:flex" />
          <MobileMenu label={t('menu')} closeLabel={t('close')}>
            <p className="mb-2 font-[family-name:var(--font-display)] text-sm font-semibold text-ink-soft">{t('services')}</p>
            <ul className="mb-6 grid gap-1">
              {categories.map((c) => (
                <li key={c.id}>
                  <Link href={{ pathname: '/[category]', params: { category: c.slug ?? '' } }} className="flex min-h-12 items-center rounded-md px-3 text-lg text-ink hover:bg-mist">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
            <ul className="grid gap-1 border-t border-line pt-4">
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="flex min-h-12 items-center rounded-md px-3 font-[family-name:var(--font-display)] text-lg font-semibold text-ink hover:bg-mist">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <LanguageSwitcher className="mt-6" />
          </MobileMenu>
        </div>
      </div>
    </header>
  )
}
