import { getTranslations } from 'next-intl/server'

import { getPathname } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'

type Option = { slug?: string | null; name: string }

const chip =
  'inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 font-[family-name:var(--font-display)] text-sm font-semibold whitespace-nowrap transition-colors'
const on = `${chip} border-ink bg-ink text-paper`
const off = `${chip} border-line bg-paper text-ink hover:border-ink/40`

/** Shareable filter chips (`?kategori=&etiket=`); tags appear only once tags exist. */
export async function GalleryFilters({
  locale,
  categories,
  tags,
  active,
  className = '',
}: {
  locale: Locale
  categories: Option[]
  tags: Option[]
  active: { category?: string; tag?: string }
  className?: string
}) {
  const t = await getTranslations('Gallery')
  const base = getPathname({ locale, href: '/galeri' })
  const href = (q: { kategori?: string; etiket?: string }) => {
    const qs = new URLSearchParams(Object.entries(q).filter((e): e is [string, string] => Boolean(e[1]))).toString()
    return qs ? `${base}?${qs}` : base
  }
  const row = (label: string, options: Option[], key: 'kategori' | 'etiket', current?: string) => (
    <div role="group" aria-label={label} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
      <a href={href({ kategori: key === 'kategori' ? undefined : active.category, etiket: key === 'etiket' ? undefined : active.tag })} aria-current={!current ? 'page' : undefined} className={!current ? on : off}>
        {t('all')}
      </a>
      {options.map((o) =>
        o.slug ? (
          <a
            key={o.slug}
            href={href({ kategori: active.category, etiket: active.tag, [key]: o.slug })}
            aria-current={current === o.slug ? 'page' : undefined}
            data-umami-event="filter_use"
            data-umami-event-filter={key}
            className={current === o.slug ? on : off}
          >
            {o.name}
          </a>
        ) : null,
      )}
    </div>
  )
  return (
    <nav aria-label={t('filters')} className={`flex flex-col gap-3 ${className}`}>
      {row(t('categories'), categories, 'kategori', active.category)}
      {tags.length > 0 && row(t('tags'), tags, 'etiket', active.tag)}
    </nav>
  )
}
