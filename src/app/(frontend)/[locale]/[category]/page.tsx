import { RichText } from '@payloadcms/richtext-lexical/react'
import { ArrowRight, Phone } from 'lucide-react'
import type { Metadata } from 'next'
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Maybe } from 'tsentials/maybe'

import { ProjectCard } from '@/components/projects/ProjectCard'
import { CtaBand } from '@/components/site/CtaBand'
import { Breadcrumb } from '@/components/site/Breadcrumb'
import { JsonLd } from '@/components/seo/JsonLd'
import { CONTAINER_SIZES, Container } from '@/components/ui/Container'
import { Picture } from '@/components/ui/Picture'
import { WhatsAppButton } from '@/components/ui/WhatsAppButton'
import { buttonClass } from '@/components/ui/button'
import { getPathname, Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { galleryLimit, hasRichText, pageFromQuery, priceGuide } from '@/lib/category/category'
import { areaLine } from '@/lib/company'
import { telLink } from '@/lib/contact'
import { getCategory, getCategoryGuides } from '@/lib/data/categories'
import { getSiteSettings } from '@/lib/data/site'
import { getProjectCards } from '@/lib/data/projects'
import { safeDecode } from '@/lib/http/safe-decode'
import { livePaths } from '@/lib/i18n/published'
import { responsiveImage } from '@/lib/media/image'
import { siteUrl } from '@/lib/seo/alternates'
import { faqJsonLd, serviceJsonLd } from '@/lib/seo/jsonld'
import { pageMetadata } from '@/lib/seo/page-metadata'

type Params = Promise<{ locale: Locale; category: string }>
type Search = Promise<{ sayfa?: string | string[] }>

const categoryPath = (locale: Locale, slug: string) => getPathname({ locale, href: { pathname: '/[category]', params: { category: slug } } })

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: Search }): Promise<Metadata> {
  const [{ locale, category: slug }, { sayfa }] = await Promise.all([params, searchParams])
  const data = await getCategory(locale, safeDecode(slug), galleryLimit(1) + 1)
  // notFound() here sets a real 404 status before the page body streams.
  if (!data) notFound()
  const { category, locales } = data
  return pageMetadata({
    locale,
    title: category.seo?.title || category.name,
    description: category.seo?.description || category.shortDesc,
    paths: livePaths(locales, (l, s) => categoryPath(l as Locale, s)),
    // "?sayfa=N" repeats page 1's photos; index only the first.
    noindex: pageFromQuery(sayfa) > 1,
    ownOgImage: true,
  })
}

export default async function CategoryPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { locale, category: rawSlug } = await params
  setRequestLocale(locale)
  const slug = safeDecode(rawSlug)
  const page = pageFromQuery((await searchParams).sayfa)
  const limit = galleryLimit(page)
  // One extra photo, so the grid stays full when the header photo comes from the gallery.
  const data = await getCategory(locale, slug, limit + 1)
  if (!data) notFound()
  const { category } = data
  // Header photo: the approved cover, else the first gallery photo (which then leaves the grid).
  const hero = typeof category.cover === 'object' && category.cover?.status === 'approved' ? category.cover : data.photos[0]
  const rest = data.photos.filter((m) => m.id !== hero?.id)
  const photos = rest.slice(0, limit)
  const hasMore = data.hasMore || rest.length > limit

  const [t, tCta, tNav, format, settings, projects, guides] = await Promise.all([
    getTranslations('Category'),
    getTranslations('Cta'),
    getTranslations('Nav'),
    getFormatter(),
    getSiteSettings(locale),
    getProjectCards(locale).then((cards) => cards.filter((c) => c.categories.some((x) => x.id === category.id)).slice(0, 6)),
    getCategoryGuides(locale, category.id),
  ])
  const price = priceGuide(category.priceGuide, locale)
  const faq = (category.faq ?? []).filter((f) => f.q && f.a)
  const body = hasRichText(category.body) ? category.body! : null
  // The aside needs a reading column beside it; with guides only, they take the full row at every width.
  const readable = Boolean(body || Maybe.isSome(price) || faq.length)
  const hasMain = readable || guides.length > 0
  const tel = telLink(settings)
  const areaText = areaLine(settings.areaServed, locale, (country) => t('nationwide', { country }))
  const url = siteUrl() + categoryPath(locale, slug)
  const wa = { kind: 'category' as const, vars: { category: category.name, url } }
  const h2 = 'text-[1.6rem] leading-tight md:text-[2rem]'
  const site = siteUrl().replace(/\/$/, '')
  const areas = (settings.areaServed ?? []).map((a) => a.name).filter(Boolean)
  // Same strings the page renders: name, intro, header photo, the areas line and the FAQ list.
  const structured = [
    serviceJsonLd({ site, name: category.name, url, description: category.shortDesc, image: hero && responsiveImage(hero).src, areaServed: areas }),
    faqJsonLd(faq),
  ]

  return (
    <>
      <JsonLd data={structured} />
      <Container as="header" className="pt-6 pb-8 md:pt-10 md:pb-12">
        <Breadcrumb
          locale={locale}
          items={[
            { name: tNav('services'), path: getPathname({ locale, href: '/hizmetlerimiz' }) },
            { name: category.name, path: categoryPath(locale, slug) },
          ]}
        />
        <h1 className="mt-6 max-w-[22ch] text-[2.1rem] leading-[1.08] md:text-[3.2rem]">{category.name}</h1>
        {category.shortDesc && <p className="mt-5 max-w-[62ch] text-[1.15rem] text-ink-soft md:text-[1.25rem]">{category.shortDesc}</p>}
        <div className="mt-7 flex flex-wrap gap-3">
          <WhatsAppButton locale={locale} context={wa} place="category_intro" />
          <Link href="/iletisim" className={buttonClass.outline}>
            {tCta('quote')}
          </Link>
        </div>
      </Container>

      {hero && (
        <Container className="mb-3 md:mb-4">
          <Picture media={hero} sizes={CONTAINER_SIZES} priority className="aspect-[4/3]! rounded-[var(--radius-photo)] md:aspect-[21/9]!" />
        </Container>
      )}

      {photos.length > 0 && (
        <Container as="section" aria-labelledby="gallery-h" className="scroll-mt-24">
          <h2 id="gallery-h" className="sr-only">
            {t('gallery')}
          </h2>
          <ul className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3 lg:grid-cols-4">
            {photos.map((m) => {
              const pic = (
                <Picture
                  media={m}
                  sizes="(min-width: 1280px) 304px, (min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                  maxWidth={960}
                  className="aspect-[4/3]! rounded-[var(--radius-photo)]"
                  imgClassName="transition-transform duration-500 ease-[var(--ease-out-expo)] motion-safe:group-hover:scale-[1.03]"
                />
              )
              return (
                <li key={m.id}>
                  {m.seoFilename ? (
                    <Link href={{ pathname: '/galeri/[slug]', params: { slug: m.seoFilename } }} className="group block rounded-[var(--radius-photo)]">
                      {pic}
                    </Link>
                  ) : (
                    pic
                  )}
                </li>
              )
            })}
          </ul>
          {hasMore && (
            <div className="mt-8 flex justify-center">
              <Link
                href={{ pathname: '/[category]', params: { category: slug }, query: { sayfa: String(page + 1) } }}
                scroll={false}
                className={buttonClass.outline}
              >
                {t('more')}
              </Link>
            </div>
          )}
        </Container>
      )}

      {hasMain && (
        // lg: the reading column plus a sticky aside (WhatsApp, phone, service area, guides), so the right half is not blank.
        <Container className={`mt-16 grid gap-x-16 md:mt-20 ${readable ? 'lg:grid-cols-[minmax(0,1fr)_20rem]' : ''}`}>
          <div className="grid min-w-0 content-start gap-16 md:gap-20">
            {body && (
              <section className="max-w-[68ch] text-[1.0625rem] md:text-[1.125rem] [&_a]:text-action [&_a]:underline [&_h2]:mt-12 [&_h2]:mb-4 [&_h2]:text-[1.5rem] [&_h3]:mt-8 [&_h3]:mb-3 [&_h3]:text-[1.2rem] [&_li]:mt-1.5 [&_ol]:list-decimal [&_ol]:ps-6 [&_p]:mt-4 [&_ul]:list-disc [&_ul]:ps-6 [&>*:first-child]:mt-0">
                <RichText data={body} disableContainer />
              </section>
            )}

            {Maybe.isSome(price) && (
              <section aria-labelledby="price-h">
                <div className="max-w-2xl rounded-[var(--radius-photo)] border border-line p-6 md:p-8">
                  <h2 id="price-h" className="text-[1.25rem]">
                    {t('price')}
                  </h2>
                  <p className="mt-3 font-[family-name:var(--font-display)] text-[1.75rem] font-semibold tabular-nums">
                    {price.value.range}
                    {price.value.unit && <span className="ms-2 text-[1rem] font-normal text-ink-soft">{t(`perUnit.${price.value.unit}`)}</span>}
                  </p>
                  {price.value.note && <p className="mt-3 max-w-[60ch] text-ink-soft">{price.value.note}</p>}
                  {price.value.updatedAt && (
                    <p className="mt-4 text-[0.95rem] text-ink-soft">
                      {t('updated')} <time dateTime={price.value.updatedAt}>{format.dateTime(new Date(price.value.updatedAt), { dateStyle: 'long' })}</time>
                    </p>
                  )}
                </div>
              </section>
            )}

            {faq.length > 0 && (
              <section aria-labelledby="faq-h">
                <h2 id="faq-h" className={h2}>
                  {t('faq')}
                </h2>
                <div className="mt-6 max-w-3xl border-t border-line">
                  {faq.map((f) => (
                    <details key={f.id ?? f.q} className="group border-b border-line">
                      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 font-[family-name:var(--font-display)] text-[1.05rem] font-semibold [&::-webkit-details-marker]:hidden">
                        {f.q}
                        <span aria-hidden className="text-[1.4rem] font-normal text-ink-soft transition-transform duration-200 group-open:rotate-45">
                          +
                        </span>
                      </summary>
                      <p className="max-w-[65ch] pb-5 text-ink-soft">{f.a}</p>
                    </details>
                  ))}
                </div>
              </section>
            )}

            {/* Below lg the guides get their own row; from lg they live in the aside (when there is one). */}
            {guides.length > 0 && (
              <section aria-labelledby="guides-h" className={readable ? 'lg:hidden' : ''}>
                <h2 id="guides-h" className={h2}>
                  {t('guides')}
                </h2>
                <ul className="mt-6 max-w-3xl border-t border-line">
                  {guides.map((g) => (
                    <li key={g.id} className="border-b border-line">
                      <a href={g.href} className="group flex items-start justify-between gap-4 py-5">
                        <span>
                          <span className="block font-[family-name:var(--font-display)] text-[1.05rem] font-semibold group-hover:text-action">{g.title}</span>
                          {g.excerpt && <span className="mt-1.5 line-clamp-2 max-w-[60ch] text-ink-soft">{g.excerpt}</span>}
                        </span>
                        <ArrowRight aria-hidden size={20} strokeWidth={1.75} className="mt-1 shrink-0 text-action rtl:rotate-180" />
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {readable && (
            <aside aria-labelledby="aside-h" className="hidden lg:block">
              <div className="sticky top-[6.5rem] border-t border-ink/25 pt-6">
                {/* A <p>, not a heading: the closing band carries the same line as its h2. */}
                <p id="aside-h" className="font-[family-name:var(--font-display)] text-[1.25rem] leading-snug font-semibold text-balance">
                  {t('ctaTitle', { category: category.name })}
                </p>
                <p className="mt-2 text-[0.98rem] text-ink-soft">{t('ctaText')}</p>
                <div className="mt-5 grid gap-3">
                  <WhatsAppButton locale={locale} context={wa} place="category_aside" className="w-full" />
                  {tel && (
                    <a href={tel.href} data-umami-event="phone_click" data-umami-event-place="category_aside" className={`${buttonClass.outline} w-full`}>
                      <Phone aria-hidden size={18} strokeWidth={1.75} />
                      <bdi dir="ltr">{tel.label}</bdi>
                    </a>
                  )}
                </div>
                {areaText && <p className="mt-4 text-[0.95rem] text-ink-soft">{t('areas', { areas: areaText })}</p>}
                {guides.length > 0 && (
                  <nav aria-labelledby="aside-guides-h" className="mt-8">
                    <h3 id="aside-guides-h" className="font-[family-name:var(--font-display)] text-sm font-semibold tracking-[0.025em] text-ink-soft uppercase">
                      {t('guides')}
                    </h3>
                    <ul className="mt-2 border-t border-line">
                      {guides.map((g) => (
                        <li key={g.id} className="border-b border-line">
                          <a href={g.href} className="flex min-h-12 items-center py-3 font-[family-name:var(--font-display)] text-[0.98rem] font-semibold hover:text-action">
                            {g.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </nav>
                )}
              </div>
            </aside>
          )}
        </Container>
      )}

      {projects.length > 0 && (
        <Container as="section" aria-labelledby="projects-h" className="mt-16 md:mt-20">
          <h2 id="projects-h" className={h2}>
            {t('projects')}
          </h2>
          <ul className="mt-6 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <li key={p.id}>
                <ProjectCard project={p} />
              </li>
            ))}
          </ul>
        </Container>
      )}

      <CtaBand locale={locale} title={t('ctaTitle', { category: category.name })} wa={wa} place="category_cta" />
    </>
  )
}
