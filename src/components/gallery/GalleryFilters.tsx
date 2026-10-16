import { X } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { getPathname } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'

import { FilterMore, FilterRail } from './FilterControls'

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
 * Shareable filter chips (`?kategori=&etiket=`). On the gallery (`active` given) the photos lead, so the controls stay
 * short: one service rail, one rail of the most common product types, and a "more filters" disclosure holding the
 * other types and the other tag axes (open while one of those is the active filter). The active tag clears itself.
 * Without `active` (homepage) the services are plain links into the gallery.
 */
export async function GalleryFilters({
  locale,
  categories,
  types = [],
  moreTypes = [],
  tags,
  active: activeProp,
  className = '',
}: {
  locale: Locale
  categories: Option[]
  types?: Option[]
  moreTypes?: Option[]
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
  const serviceChips = (
    <>
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
    </>
  )
  if (!activeProp)
    return (
      <nav aria-label={t('filters')} className={className}>
        <div role="group" aria-label={t('serviceFilter')} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
          {serviceChips}
        </div>
      </nav>
    )

  // Row labels name each group; on phones they are read out only, so the photos start two rows down.
  const label = 'shrink-0 text-[0.9rem] text-ink-soft max-md:sr-only md:w-24'
  // One tag at a time (`?etiket=`): picking a chip replaces any other tag choice.
  const tagLinks = (options: Option[], event: string) =>
    options.map((o) => {
      if (!o.slug) return null
      const current = active.tag === o.slug
      return (
        <a
          key={o.slug}
          href={href({ kategori: active.category, etiket: current ? undefined : o.slug })}
          aria-current={current ? 'page' : undefined}
          data-umami-event="filter_use"
          data-umami-event-filter={event}
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
    })
  const section = (id: string, title: string, options: Option[], event: string) =>
    options.length > 0 && (
      <div className="md:flex md:items-start md:gap-3">
        <p id={id} className="pb-2 text-[0.9rem] text-ink-soft md:flex md:min-h-11 md:w-24 md:shrink-0 md:items-center md:pb-0">
          {title}
        </p>
        <div role="group" aria-labelledby={id} className="flex flex-wrap gap-2">
          {tagLinks(options, event)}
        </div>
      </div>
    )

  const typeRow = types.length > 0 && (
    <>
      <p id="filter-types" className={label}>
        {t('typeFilter')}
      </p>
      <FilterRail role="group" aria-labelledby="filter-types" className="-ms-1.5 -me-4 flex-1 md:me-0 md:flex-initial" railClassName="ps-1.5">
        {tagLinks(types, 'tur')}
      </FilterRail>
    </>
  )
  const clear = (active.category || active.tag) && (
    <a href={base} className="inline-flex min-h-11 shrink-0 items-center gap-1 px-1.5 text-[0.9rem] text-ink-soft underline-offset-4 hover:text-ink hover:underline max-md:order-first">
      <X aria-hidden size={15} strokeWidth={2} />
      {t('clearAll')}
    </a>
  )
  // Phones keep the disclosure closed, so an active tag from it shows in the row as its own clearing chip.
  const hiddenActive = tags.find((o) => o.slug === active.tag)
  const activeChip = hiddenActive && (
    <a href={href({ kategori: active.category })} aria-current="page" className={`${tagOn} max-md:order-first md:hidden`}>
      {hiddenActive.name}
      <X aria-hidden size={15} strokeWidth={2} />
      <span className="sr-only">{t('clearTag')}</span>
    </a>
  )
  const row = 'flex items-center gap-2 md:gap-3'
  return (
    <nav aria-label={t('filters')} className={`flex flex-col gap-3 ${className}`}>
      <div className="md:flex md:items-center md:gap-3">
        <p id="filter-services" className={label}>
          {t('serviceFilter')}
        </p>
        <FilterRail role="group" aria-labelledby="filter-services" className="-mx-4 md:-ms-1.5 md:me-0 md:flex-1" railClassName="ps-4 md:ps-1.5">
          {serviceChips}
        </FilterRail>
      </div>
      {moreTypes.length > 0 || tags.length > 0 ? (
        <FilterMore
          id="filter-more"
          label={t('moreFilters')}
          mobileLabel={t('filterButton')}
          defaultOpen={Boolean(hiddenActive)}
          rowClassName={row}
          lead={typeRow}
          after={
            <>
              {clear}
              {activeChip}
            </>
          }
        >
          {section('filter-more-types', t('moreTypes'), moreTypes, 'tur')}
          {section('filter-tags', t('tagFilter'), tags, 'etiket')}
        </FilterMore>
      ) : (
        (typeRow || clear) && (
          <div className={row}>
            {typeRow}
            {clear}
          </div>
        )
      )}
    </nav>
  )
}
