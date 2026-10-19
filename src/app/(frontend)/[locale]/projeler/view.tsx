import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Maybe } from 'tsentials/maybe'

import { ProjectCard } from '@/components/projects/ProjectCard'
import { Breadcrumb } from '@/components/site/Breadcrumb'
import { CtaBand } from '@/components/site/CtaBand'
import { JsonLd } from '@/components/seo/JsonLd'
import { Container } from '@/components/ui/Container'
import { buttonClass } from '@/components/ui/button'
import { getPathname, Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { byCategoryOrder } from '@/lib/category/category'
import { getProjectCards } from '@/lib/data/projects'
import { categoryFilter } from '@/lib/projects/facts'
import { siteUrl } from '@/lib/seo/alternates'
import { itemListJsonLd, pageJsonLd } from '@/lib/seo/jsonld'
import { pageMetadata, staticPaths } from '@/lib/seo/page-metadata'

type Params = Promise<{ locale: Locale }>
type Search = Promise<{ kategori?: string | string[] }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Projects' })
  return pageMetadata({ locale, title: t('title'), description: t('description'), paths: await staticPaths('/projeler') })
}

export async function ProjectsPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { locale } = await params
  setRequestLocale(locale)
  // #148: outdoor work first (first category's admin order), newest first within a category.
  const [t, cards, { kategori }] = await Promise.all([getTranslations('Projects'), getProjectCards(locale).then((c) => [...c].sort(byCategoryOrder)), searchParams])
  // Filter chips list only categories that have at least one project, so a chip never leads to an empty page.
  const used = [...new Map(cards.flatMap((c) => c.categories).filter((c) => c.slug).map((c) => [c.id, c])).values()]
  const active = categoryFilter(kategori, used)
  const shown = Maybe.isSome(active) ? cards.filter((c) => c.categories.some((x) => x.id === active.value.id)) : cards
  const chip = 'inline-flex min-h-11 items-center rounded-full border px-4 text-[0.95rem] font-semibold font-[family-name:var(--font-display)]'

  const site = siteUrl().replace(/\/$/, '')
  const path = getPathname({ locale, href: '/projeler' })
  const list = itemListJsonLd(shown.map((p) => ({ name: p.title, url: site + getPathname({ locale, href: { pathname: '/projeler/[slug]', params: { slug: p.slug } } }) })))

  return (
    <>
      <Container className="pt-10 md:pt-16">
        <JsonLd data={[pageJsonLd('CollectionPage', { site, name: t('title'), url: site + path, description: t('description'), locale }), list]} />
        <Breadcrumb locale={locale} className="mb-6" items={[{ name: t('title'), path }]} />
        <h1 className="text-[2.1rem] leading-[1.08] md:text-[3.2rem]">{t('title')}</h1>
        <p className="mt-5 max-w-[62ch] text-[1.15rem] text-ink-soft md:text-[1.25rem]">{t('description')}</p>

        {used.length > 1 && (
          <nav aria-label={t('filter')} className="mt-8">
            <ul className="flex flex-wrap gap-2">
              {[{ id: 0, slug: undefined, name: t('all') }, ...used].map((c) => {
                const on = c.slug ? Maybe.isSome(active) && active.value.id === c.id : Maybe.isNone(active)
                return (
                  <li key={c.id}>
                    <Link
                      href={c.slug ? { pathname: '/projeler', query: { kategori: c.slug } } : '/projeler'}
                      aria-current={on ? 'page' : undefined}
                      className={`${chip} ${on ? 'border-ink bg-ink text-paper' : 'border-line bg-paper text-ink hover:border-ink/40'}`}
                    >
                      {c.name}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
        )}

        <h2 id="list-h" className="sr-only">
          {t('list')}
        </h2>
        {shown.length > 0 ? (
          <ul aria-labelledby="list-h" className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((p, i) => (
              <li key={p.id}>
                <ProjectCard project={p} priority={i === 0} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-10 max-w-xl rounded-[var(--radius-photo)] border border-line p-8">
            <p className="text-[1.1rem]">{cards.length ? t('emptyFiltered') : t('empty')}</p>
            <Link href="/galeri" className={`${buttonClass.outline} mt-5`}>
              {t('toGallery')}
            </Link>
          </div>
        )}
      </Container>
      <CtaBand locale={locale} place="projects_cta" />
    </>
  )
}
