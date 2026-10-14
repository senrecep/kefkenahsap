import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import type { Metadata } from 'next'
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { GuideBody } from '@/components/guides/GuideBody'
import { buttonClass } from '@/components/ui/button'
import { Container } from '@/components/ui/Container'
import { WhatsAppButton } from '@/components/ui/WhatsAppButton'
import { getPathname } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { getGuide, getGuides } from '@/lib/data/guides'
import { getSiteSettings } from '@/lib/data/site'
import { metaDescription } from '@/lib/guides/meta'
import { tableOfContents } from '@/lib/guides/toc'
import { siteUrl } from '@/lib/seo/alternates'
import { pageMetadata } from '@/lib/seo/page-metadata'

type Props = { params: Promise<{ locale: Locale; slug: string }> }

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
  const { guide, categories } = found
  const [t, tCta, format, settings, published] = await Promise.all([getTranslations('Guides'), getTranslations('Cta'), getFormatter(), getSiteSettings(locale), getGuides(locale)])
  const body = guide.body as SerializedEditorState | null | undefined
  const toc = tableOfContents(body)
  // Byline only when the owner opted in for this guide (and a founder name is set).
  const founder = guide.showAuthor && settings.founder?.name ? settings.founder : null
  const faq = guide.faq ?? []
  const url = `${siteUrl().replace(/\/$/, '')}${getPathname({ locale, href: { pathname: '/rehber/[slug]', params: { slug } } })}`
  const updated = (
    <>
      {t('updated')}: <time dateTime={guide.updatedAt}>{format.dateTime(new Date(guide.updatedAt), { dateStyle: 'long' })}</time>
    </>
  )

  return (
    <>
      {/* #48: Article + Person (siteSettings.founder) + FAQPage JSON-LD for this page goes here, built from `guide`, `faq` and `founder`. */}
      <Container as="article" className="pt-6 pb-16 md:pt-10">
        <a href={getPathname({ locale, href: '/rehber' })} className="text-[0.95rem] text-action underline">
          {t('back')}
        </a>
        <header className="mt-6 max-w-[46rem]">
          <h1 className="text-[clamp(1.9rem,4vw,2.9rem)]">{guide.title}</h1>
          <p className="mt-4 text-[0.95rem] text-ink-soft">
            {founder && <>{founder.name} · </>}
            {updated}
          </p>
          {guide.excerpt && <p className="mt-6 text-[1.1875rem] leading-relaxed md:text-[1.3125rem]">{guide.excerpt}</p>}
        </header>

        <div className="mt-10 grid gap-10 border-t border-line pt-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-16">
          {toc.items.length > 1 && (
            <nav aria-labelledby="toc-title" className="lg:sticky lg:top-24 lg:self-start">
              <h2 id="toc-title" className="font-[family-name:var(--font-display)] text-[0.95rem] font-semibold">
                {t('toc')}
              </h2>
              <ol className="mt-3 space-y-1 border-s border-line text-[0.95rem]">
                {toc.items.map((item) => (
                  <li key={item.id}>
                    <a href={`#${item.id}`} className="-ms-px block border-s-2 border-transparent py-1.5 ps-4 text-ink-soft hover:border-action hover:text-ink">
                      {item.text}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          <div className="min-w-0 lg:col-start-2">
            {body && <GuideBody data={body} idOf={toc.idOf} tableLabel={t('table')} publishedHrefs={new Set(published.map((g) => g.href))} />}

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
