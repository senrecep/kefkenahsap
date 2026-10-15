import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { PopularCategories } from '@/components/content/PopularCategories'
import { SearchBox } from '@/components/content/SearchBox'
import { ProjectCard } from '@/components/projects/ProjectCard'
import { Container } from '@/components/ui/Container'
import { Picture } from '@/components/ui/Picture'
import { WhatsAppButton } from '@/components/ui/WhatsAppButton'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { getPayload } from '@/lib/data/payload'
import { card } from '@/lib/data/projects'
import { getNavCategories } from '@/lib/data/site'
import { searchSite } from '@/lib/search/search'
import { resultSections } from '@/lib/search/sections'
import { pageMetadata, staticPaths } from '@/lib/seo/page-metadata'

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string | string[] }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Search' })
  // Search result pages are never indexed (PLAN §5.1); robots.ts also disallows /*/ara.
  return pageMetadata({ locale: locale as Locale, title: t('title'), paths: await staticPaths('/ara'), noindex: true })
}

const h2 = 'font-[family-name:var(--font-display)] text-xl font-semibold'

export default async function SearchPage({ params, searchParams }: Props) {
  const { locale: l } = await params
  const locale = l as Locale
  setRequestLocale(locale)
  const raw = (await searchParams).q
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 100) ?? ''
  const t = await getTranslations('Search')
  const result = q ? await searchSite(await getPayload(), q, locale, { limit: 24 }) : null
  const res = result?.ok ? resultSections(result.value) : null
  const code = result && !result.ok ? result.errors[0]?.code : undefined

  return (
    <Container className="pt-10 pb-6 md:pt-14">
      <h1 className="font-[family-name:var(--font-display)] text-[clamp(2rem,4vw,3rem)] font-semibold tracking-tight text-balance">
        {q && res ? t('titleFor', { q }) : t('title')}
      </h1>
      <div className="mt-6">
        <SearchBox locale={locale} q={q} autoFocus={!q} />
      </div>
      <div role="status" className="mt-4 text-ink-soft empty:hidden">
        {code === 'Search.QueryTooShort' && t('tooShort')}
        {code && code !== 'Search.QueryTooShort' && t('failed')}
        {res && res.total > 0 && t('count', { count: res.total })}
      </div>

      {res && res.total === 0 && <NoResults locale={locale} q={q} />}

      {res?.sections.map((s) => (
        <section key={s.key} className="mt-12" aria-labelledby={`r-${s.key}`}>
          <h2 id={`r-${s.key}`} className={h2}>
            {t(s.key === 'media' ? 'images' : s.key)} <span className="font-normal text-ink-soft tabular-nums">({s.items.length})</span>
          </h2>
          {s.key === 'projects' && (
            <ul className="mt-5 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {s.items.map((p) => (
                <li key={p.id}>
                  <ProjectCard project={card(p)} />
                </li>
              ))}
            </ul>
          )}
          {s.key === 'guides' && (
            <ul className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {s.items.map((g) => (
                <li key={g.id} className="border-t border-line pt-4">
                  <Link href={{ pathname: '/rehber/[slug]', params: { slug: g.slug! } }} className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink hover:text-action">
                    {g.title}
                  </Link>
                  {g.excerpt && <p className="mt-1 line-clamp-2 text-ink-soft">{g.excerpt}</p>}
                </li>
              ))}
            </ul>
          )}
          {s.key === 'categories' && (
            <ul className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {s.items.map((c) => (
                <li key={c.id} className="border-t border-line pt-4">
                  <Link href={{ pathname: '/[category]', params: { category: c.slug! } }} className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink hover:text-action">
                    {c.name}
                  </Link>
                  {c.shortDesc && <p className="mt-1 line-clamp-2 text-ink-soft">{c.shortDesc}</p>}
                </li>
              ))}
            </ul>
          )}
          {s.key === 'media' && (
            <ul className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {s.items.map((m) => (
                <li key={m.id}>
                  <Link href={{ pathname: '/galeri/[slug]', params: { slug: m.seoFilename ?? String(m.id) } }} className="group block">
                    <Picture media={m} sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw" maxWidth={960} className="aspect-[4/3]! rounded-[var(--radius-photo)]" imgClassName="transition-opacity group-hover:opacity-90" />
                    {m.title && <span className="mt-2 line-clamp-2 block text-[0.98rem] text-ink">{m.title}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </Container>
  )
}

async function NoResults({ locale, q }: { locale: Locale; q: string }) {
  const [t, categories] = await Promise.all([getTranslations('Search'), getNavCategories(locale)])
  return (
    <div className="mt-10 max-w-2xl">
      <p className="text-lg">{t('empty', { q })}</p>
      <div className="mt-5">
        <WhatsAppButton locale={locale} place="search-empty" />
      </div>
      <h2 className={`${h2} mt-10`}>{t('browse')}</h2>
      <PopularCategories categories={categories} />
    </div>
  )
}
