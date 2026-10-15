import { ChevronDown, MessageCircle, Phone } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { Link } from '@/i18n/navigation'
import { routing, type Locale } from '@/i18n/routing'
import { buttonClass } from '@/components/ui/button'
import { telLink, waLink } from '@/lib/contact'
import { getContentLocales } from '@/lib/data/categories'
import { getProjectCards } from '@/lib/data/projects'
import { getNavCategories, getSiteSettings } from '@/lib/data/site'

import { LanguageSwitcher } from './LanguageSwitcher'
import { Logo } from './Logo'
import { MobileMenu } from './MobileMenu'

const linkCls =
  'inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-3 font-[family-name:var(--font-display)] text-[0.95rem] font-semibold text-ink hover:text-action'

export async function Header({ locale }: { locale: Locale }) {
  const [t, tCta, settings, allCategories, projects, contentLocales] = await Promise.all([
    getTranslations('Nav'),
    getTranslations('Cta'),
    getSiteSettings(locale),
    getNavCategories(locale),
    getProjectCards(locale),
    getContentLocales(),
  ])
  // Only languages with their own content (plus the current one): no crawlable links to noindex shells.
  const locales = routing.locales.filter((l) => l === locale || contentLocales.includes(l))
  const categories = allCategories.filter((c) => c.slug)
  const tel = telLink(settings)
  const wa = waLink(settings)
  // "Projeler" stays hidden until a project is published (the route itself keeps working).
  const links = [
    ...(projects.length ? [{ href: '/projeler', label: t('projects') } as const] : []),
    { href: '/galeri', label: t('gallery') } as const,
    { href: '/rehber', label: t('guides') } as const,
    { href: '/referanslar', label: t('references') } as const,
    { href: '/iletisim', label: t('contact') } as const,
  ]

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper [--header-h:4.5rem]">
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
                    <Link href={{ pathname: '/[category]', params: { category: c.slug! } }} className="block rounded-md px-3 py-2.5 text-[0.95rem] text-ink hover:bg-mist">
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
              <bdi dir="ltr" className="hidden whitespace-nowrap xl:inline">{tel.label}</bdi>
              <span className="sr-only xl:hidden">{`${tCta('callUs')}: ${tel.label}`}</span>
            </a>
          )}
          <LanguageSwitcher locale={locale} locales={locales} label={t('language')} className="hidden sm:block" />
          <MobileMenu label={t('menu')} closeLabel={t('close')}>
            <ul className="grid gap-1">
              <li>
                <details className="group">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between rounded-md px-3 font-[family-name:var(--font-display)] text-lg font-semibold text-ink hover:bg-mist [&::-webkit-details-marker]:hidden">
                    {t('services')}
                    <ChevronDown aria-hidden size={22} strokeWidth={1.75} className="text-ink-soft transition-transform group-open:rotate-180" />
                  </summary>
                  <ul className="mb-2 grid gap-0.5 ps-3">
                    <li>
                      <Link href="/hizmetlerimiz" className="flex min-h-11 items-center rounded-md px-3 text-[1.05rem] font-semibold text-ink hover:bg-mist">
                        {t('allServices')}
                      </Link>
                    </li>
                    {categories.map((c) => (
                      <li key={c.id}>
                        <Link href={{ pathname: '/[category]', params: { category: c.slug! } }} className="flex min-h-11 items-center rounded-md px-3 text-[1.05rem] text-ink hover:bg-mist">
                          {c.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="flex min-h-12 items-center rounded-md px-3 font-[family-name:var(--font-display)] text-lg font-semibold text-ink hover:bg-mist">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <LanguageSwitcher locale={locale} locales={locales} label={t('language')} variant="list" className="mt-6" />
            {/* Pinned to the panel's bottom edge: the two actions stay one tap away however long the list gets. */}
            <div className="sticky bottom-0 -mx-4 mt-auto flex gap-3 border-t border-line bg-paper px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              {wa && (
                <a href={wa} target="_blank" rel="noopener" data-umami-event="whatsapp_click" data-umami-event-place="mobile-menu" className={`${buttonClass.whatsapp} flex-1`}>
                  <MessageCircle aria-hidden size={20} strokeWidth={1.75} />
                  {tCta('whatsappShort')}
                </a>
              )}
              <Link href="/iletisim" className={`${buttonClass.outline} flex-1`}>
                {tCta('quote')}
              </Link>
            </div>
          </MobileMenu>
        </div>
      </div>
    </header>
  )
}
