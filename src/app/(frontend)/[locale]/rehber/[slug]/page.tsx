import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import type { Metadata } from 'next'
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server'
import { ChevronDown } from 'lucide-react'
import { notFound } from 'next/navigation'

import { GuideBody } from '@/components/guides/GuideBody'
import { GuideCard } from '@/components/guides/GuideCard'
import WoodSamples from '@/components/guides/WoodSamples'
import { JsonLd } from '@/components/seo/JsonLd'
import { ProjectCard } from '@/components/projects/ProjectCard'
import { buttonClass } from '@/components/ui/button'
import { Breadcrumb } from '@/components/site/Breadcrumb'
import { Container, CONTAINER_SIZES } from '@/components/ui/Container'
import { Picture } from '@/components/ui/Picture'
import { WhatsAppButton } from '@/components/ui/WhatsAppButton'
import { getPathname } from '@/i18n/navigation'
import { localeDir, type Locale } from '@/i18n/routing'
import { getGuide, getGuides } from '@/lib/data/guides'
import { getProjectCards } from '@/lib/data/projects'
import { getSiteSettings } from '@/lib/data/site'
import { metaDescription } from '@/lib/guides/meta'
import { guideProjects, relatedGuides } from '@/lib/guides/related'
import { tableOfContents, type TocItem } from '@/lib/guides/toc'
import { siteUrl } from '@/lib/seo/alternates'
import { hasWoodSamples } from '@/lib/wood/samples'
import { articleJsonLd, faqJsonLd } from '@/lib/seo/jsonld'
import { pageMetadata } from '@/lib/seo/page-metadata'

type Props = { params: Promise<{ locale: Locale; slug: string }> }

// ISR on first request (see the locale layout).
export const generateStaticParams = () => []

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  const found = await getGuide(locale, slug)
  if (!found) return {}
  const { guide, paths } = found
  const m = await pageMetadata({ locale, title: guide.seo?.title || guide.title, description: guide.seo?.description || metaDescription(guide.excerpt), paths })
  return { ...m, openGraph: { ...m.openGraph, type: 'article', modifiedTime: guide.updatedAt } }
}

export default async function GuidePage({ params }: Props) {
  const { locale, slug } = await params
  setRequestLocale(locale)
  const found = await getGuide(locale, slug)
  if (!found) notFound()
  const { guide, categories, cover } = found
  const [t, tCta, format, settings, published, projectCards] = await Promise.all([
    getTranslations('Guides'),
    getTranslations('Cta'),
    getFormatter(),
    getSiteSettings(locale),
    getGuides(locale),
    getProjectCards(locale),
  ])
  const body = guide.body as SerializedEditorState | null | undefined
  const toc = tableOfContents(body)
  const categoryIds = categories.map((c) => c.id)
  // "Bu konudaki işlerimiz": published projects in this guide's services, in the guide's category order (#156).
  const projects = guideProjects(projectCards, categories)
  const moreGuides = relatedGuides(published, guide.id, categoryIds)
  // Byline only when the owner opted in for this guide (and a founder name is set).
  const founder = guide.showAuthor && settings.founder?.name ? settings.founder : null
  const faq = guide.faq ?? []
  const site = siteUrl().replace(/\/$/, '')
  const url = `${site}${getPathname({ locale, href: { pathname: '/rehber/[slug]', params: { slug } } })}`
  const updated = (
    <>
      {t('updated')}: <time dateTime={guide.updatedAt}>{format.dateTime(new Date(guide.updatedAt), { dateStyle: 'long' })}</time>
    </>
  )

  return (
    <>
      {/* Only what the page shows: title, excerpt, the "updated" date, the byline when shown, and the FAQ list. */}
      <JsonLd
        data={[
          articleJsonLd({ site, headline: guide.title, url, description: guide.excerpt, author: founder?.name, dateModified: guide.updatedAt }),
          faqJsonLd(faq),
        ]}
      />
      <Container as="article" className="pt-6 pb-16 md:pt-10">
        <Breadcrumb
          locale={locale}
          items={[
            { name: t('title'), path: getPathname({ locale, href: '/rehber' }) },
            { name: guide.title, path: getPathname({ locale, href: { pathname: '/rehber/[slug]', params: { slug } } }) },
          ]}
        />
        <header className="mt-6 max-w-[46rem]">
          <h1 className="text-[clamp(1.9rem,4vw,2.9rem)]">{guide.title}</h1>
          <p className="mt-4 text-[0.95rem] text-ink-soft">
            {founder && <>{founder.name} · </>}
            {updated}
          </p>
          {guide.excerpt && <p className="mt-6 text-[1.1875rem] leading-relaxed md:text-[1.3125rem]">{guide.excerpt}</p>}
        </header>

        {cover && (
          <Picture media={cover} sizes={CONTAINER_SIZES} maxWidth={2560} priority className="mt-8 aspect-video! rounded-[var(--radius-photo)] md:mt-10" />
        )}

        <div className="mt-10 grid gap-8 border-t border-line pt-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-16 lg:pt-10">
          {toc.items.length > 1 && (
            <>
              {/* Phone and tablet: closed, so the first section is one swipe away. Desktop: always open, sticky. No JS. */}
              <details className="group/toc rounded-[var(--radius-control)] border border-line lg:hidden">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 font-[family-name:var(--font-display)] text-[0.95rem] font-semibold [&::-webkit-details-marker]:hidden">
                  <span>
                    {t('toc')} <span className="font-normal text-ink-soft">· {t('tocCount', { count: toc.items.length })}</span>
                  </span>
                  <ChevronDown aria-hidden size={20} strokeWidth={1.75} className="shrink-0 text-ink-soft transition-transform duration-150 group-open/toc:rotate-180" />
                </summary>
                <nav aria-label={t('toc')} className="border-t border-line px-4 pt-2 pb-3">
                  <TocList items={toc.items} className="text-[0.95rem]" linkClassName="block py-2.5 text-ink-soft hover:text-ink" />
                </nav>
              </details>
              <nav aria-labelledby="toc-title" className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
                <h2 id="toc-title" className="font-[family-name:var(--font-display)] text-[0.95rem] font-semibold">
                  {t('toc')}
                </h2>
                <TocList
                  items={toc.items}
                  className="mt-3 space-y-1 border-s border-line text-[0.95rem]"
                  linkClassName="-ms-px block border-s-2 border-transparent py-1.5 ps-4 text-ink-soft hover:border-action hover:text-ink"
                />
              </nav>
            </>
          )}

          <div className="min-w-0 lg:col-start-2">
            {body && <GuideBody data={body} idOf={toc.idOf} tableLabel={t('table')} rtl={localeDir(locale) === 'rtl'} publishedHrefs={new Set(published.map((g) => g.href))} woodSamples={hasWoodSamples(body) && <WoodSamples locale={locale} />} />}

            {faq.length > 0 && (
              <section aria-labelledby="faq" className="mt-16 max-w-[68ch]">
                <h2 id="faq" className="text-[clamp(1.4rem,2.4vw,1.75rem)]">
                  {t('faq')}
                </h2>
                <dl className="mt-4 divide-y divide-line border-y border-line">
                  {faq.map((item) => (
                    <div key={item.id ?? item.q} className="py-5">
                      <dt className="font-[family-name:var(--font-display)] font-semibold">{item.q}</dt>
                      <dd className="mt-2 text-ink-soft">{item.a}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {founder && (
              <aside aria-label={t('author')} className="mt-12 max-w-[68ch] rounded-[var(--radius-control)] bg-mist p-6">
                <p className="font-[family-name:var(--font-display)] text-lg font-semibold">{founder.name}</p>
                <p className="text-[0.95rem] text-ink-soft">{t('authorRole', { company: settings.companyName })}</p>
                {founder.bio && <p className="mt-3">{founder.bio}</p>}
                <p className="mt-3 text-[0.95rem] text-ink-soft">{updated}</p>
              </aside>
            )}

            {projects.length > 0 && (
              <section aria-labelledby="guide-projects" className="mt-16">
                <h2 id="guide-projects" className="text-[clamp(1.4rem,2.4vw,1.75rem)]">
                  {t('projects')}
                </h2>
                <ul className={projects.length === 1 ? 'mt-6' : 'mt-6 grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3'}>
                  {projects.map((p) => (
                    <li key={p.id}>
                      <ProjectCard project={p} wide={projects.length === 1} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {categories.length > 0 && (
              <section aria-labelledby="related" className="mt-12 max-w-[68ch]">
                <h2 id="related" className="text-xl">
                  {t('related')}
                </h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {categories.map((c) => (
                    <li key={c.href}>
                      <a href={c.href} className={buttonClass.outline}>
                        {c.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {moreGuides.length > 0 && (
              <section aria-labelledby="related-guides" className="mt-16 border-t border-line pt-10">
                <h2 id="related-guides" className="text-[clamp(1.4rem,2.4vw,1.75rem)]">
                  {t('relatedGuides')}
                </h2>
                <ul className="mt-6 grid gap-x-6 gap-y-5 sm:grid-cols-2 sm:gap-y-10 xl:grid-cols-3">
                  {moreGuides.map((g) => (
                    <li key={g.id}>
                      <GuideCard guide={g} heading="h3" excerpt={false} compact sizes="(min-width: 1280px) 290px, (min-width: 640px) calc(50vw - 2.5rem), 8rem" />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </Container>

      <section aria-labelledby="guide-cta" className="border-t border-line bg-mist">
        <Container className="flex flex-col gap-6 py-12 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <h2 id="guide-cta" className="text-2xl">
              {t('ctaTitle')}
            </h2>
            <p className="mt-2 text-ink-soft">{t('ctaText')}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <WhatsAppButton locale={locale} place="guide" context={{ kind: 'default', vars: { url } }} />
            <a href={getPathname({ locale, href: '/iletisim' })} className={buttonClass.outline}>
              {tCta('quote')}
            </a>
          </div>
        </Container>
      </section>
    </>
  )
}

/** The TOC links: the same list in the phone disclosure and the desktop sidebar, styled per place. */
function TocList({ items, className, linkClassName }: { items: TocItem[]; className: string; linkClassName: string }) {
  return (
    <ol className={className}>
      {items.map((item) => (
        <li key={item.id}>
          <a href={`#${item.id}`} className={linkClassName}>
            {item.text}
          </a>
        </li>
      ))}
    </ol>
  )
}
