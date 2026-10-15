import { X } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { getPathname } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'

type Option = { slug?: string | null; name: string }

const chip =
  'inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 font-[family-name:var(--font-display)] text-sm font-semibold whitespace-nowrap transition-colors'
const on = `${chip} border-ink bg-ink text-paper`
const off = `${chip} border-line bg-paper text-ink hover:border-ink/40`
// Tags are the secondary filter: lighter chips, same 44px target. The active one is a toggle back to "no tag".
const tagChip = 'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[0.9rem] whitespace-nowrap transition-colors'
const tagOn = `${tagChip} border-ink bg-mist text-ink`
const tagOff = `${tagChip} border-transparent bg-mist text-ink-soft hover:text-ink`

/**
 * Shareable filter chips (`?kategori=&etiket=`). On the gallery (`active` given) each row carries a visible label: services
 * with one "Tümü", then tags as a quieter row (they appear only once tags exist), where the active tag clears itself.
 * Without `active` (homepage) the services are plain links into the gallery.
 */
export async function GalleryFilters({
  locale,
  categories,
  tags,
  active: activeProp,
  className = '',
}: {
  locale: Locale
  categories: Option[]
  tags: Option[]
  active?: { category?: string; tag?: string }
  className?: string
}) {
  const t = await getTranslations('Gallery')
  const active = activeProp ?? {}
  const base = getPathname({ locale, href: '/galeri' })
  const href = (q: { kategori?: string; etiket?: string }) => {
    const qs = new URLSearchParams(Object.entries(q).filter((e): e is [string, string] => Boolean(e[1]))).toString()
    return qs ? `${base}?${qs}` : base
  }
  const scroller = '-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0'
  const services = (
    <div role="group" {...(activeProp ? { 'aria-labelledby': 'filter-services' } : { 'aria-label': t('serviceFilter') })} className={scroller}>
      {activeProp && (
        <a href={href({ etiket: active.tag })} aria-current={!active.category ? 'page' : undefined} className={!active.category ? on : off}>
          {t('all')}
        </a>
      )}
      {categories.map((o) =>
        o.slug ? (
          <a
            key={o.slug}
            href={href({ kategori: o.slug, etiket: active.tag })}
            aria-current={active.category === o.slug ? 'page' : undefined}
            data-umami-event="filter_use"
            data-umami-event-filter="kategori"
            className={active.category === o.slug ? on : off}
          >
            {o.name}
          </a>
        ) : null,
      )}
    </div>
  )
  if (!activeProp)
    return (
      <nav aria-label={t('filters')} className={className}>
        {services}
      </nav>
    )
  const label = 'pb-2 text-[0.9rem] text-ink-soft md:flex md:min-h-11 md:w-24 md:shrink-0 md:items-center md:pb-0'
  return (
    <nav aria-label={t('filters')} className={`flex flex-col gap-3 ${className}`}>
      <div className="md:flex md:items-start md:gap-3">
        <p id="filter-services" className={label}>
          {t('serviceFilter')}
        </p>
        {services}
      </div>
      {tags.length > 0 && (
        <div className="md:flex md:items-start md:gap-3">
          <p id="filter-tags" className={label}>
            {t('tagFilter')}
          </p>
          <div role="group" aria-labelledby="filter-tags" className={scroller}>
            {tags.map((o) => {
              if (!o.slug) return null
              const current = active.tag === o.slug
              return (
                <a
                  key={o.slug}
                  href={href({ kategori: active.category, etiket: current ? undefined : o.slug })}
                  aria-current={current ? 'page' : undefined}
                  data-umami-event="filter_use"
                  data-umami-event-filter="etiket"
                  className={current ? tagOn : tagOff}
                >
                  {o.name}
                  {current && (
                    <>
                      <X aria-hidden size={15} strokeWidth={2} />
                      <span className="sr-only">{t('clearTag')}</span>
                    </>
                  )}
                </a>
              )
            })}
          </div>
        </div>
      )}
    </nav>
  )
}
