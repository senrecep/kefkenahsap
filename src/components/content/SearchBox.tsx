import { Search } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { buttonClass } from '@/components/ui/button'
import { getPathname } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'

/** Plain GET form to the search page — works without JavaScript. */
export async function SearchBox({ locale, q = '', autoFocus = false }: { locale: Locale; q?: string; autoFocus?: boolean }) {
  const t = await getTranslations('Search')
  return (
    <form role="search" action={getPathname({ locale, href: '/ara' })} method="get" className="flex max-w-xl gap-2">
      <label htmlFor="site-search" className="sr-only">{t('label')}</label>
      <input
        id="site-search"
        name="q"
        type="search"
        defaultValue={q}
        placeholder={t('placeholder')}
        autoFocus={autoFocus}
        minLength={2}
        maxLength={100}
        className="min-h-12 min-w-0 flex-1 rounded-[var(--radius-control)] border border-ink/25 bg-white px-3.5 text-base text-ink placeholder:text-ink-soft/80 focus:border-action focus:outline-2 focus:outline-offset-1 focus:outline-action"
      />
      <button type="submit" className={buttonClass.primary}>
        <Search aria-hidden size={18} strokeWidth={1.75} />
        {t('submit')}
      </button>
    </form>
  )
}
