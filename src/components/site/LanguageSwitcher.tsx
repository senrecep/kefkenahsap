'use client'

import { useLocale, useTranslations } from 'next-intl'

import { routing } from '@/i18n/routing'

const LABEL: Record<string, string> = { tr: 'TR', en: 'EN', ar: 'AR', ru: 'RU', de: 'DE' }

/** Follows the page's own <link rel="alternate" hreflang> (set by each page's metadata), so CMS slugs switch correctly. */
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const locale = useLocale()
  const t = useTranslations('Nav')
  // Real links (crawlable, work without JS); on click, prefer the page's own alternate URL.
  const onClick = (e: React.MouseEvent<HTMLAnchorElement>, target: string) => {
    const alt = document.querySelector<HTMLLinkElement>(`link[rel="alternate"][hreflang="${target}"]`)
    if (alt?.href) {
      e.preventDefault()
      window.location.assign(alt.href)
    }
  }
  return (
    <nav aria-label={t('language')} className={`flex items-center gap-1 ${className}`}>
      {routing.locales.map((l) => (
        <a
          key={l}
          href={`/${l}`}
          hrefLang={l}
          lang={l}
          onClick={(e) => (l === locale ? e.preventDefault() : onClick(e, l))}
          aria-current={l === locale ? 'true' : undefined}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-control)] px-2 font-[family-name:var(--font-display)] text-sm font-semibold text-ink-soft hover:text-ink aria-[current=true]:text-ink aria-[current=true]:underline aria-[current=true]:underline-offset-8"
        >
          {LABEL[l] ?? l.toUpperCase()}
        </a>
      ))}
    </nav>
  )
}
