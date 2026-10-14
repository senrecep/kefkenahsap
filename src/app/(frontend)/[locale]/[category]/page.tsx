import { RichText } from '@payloadcms/richtext-lexical/react'
import type { Metadata } from 'next'
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Maybe } from 'tsentials/maybe'

import { ProjectCard } from '@/components/projects/ProjectCard'
import { Container } from '@/components/ui/Container'
import { Picture } from '@/components/ui/Picture'
import { WhatsAppButton } from '@/components/ui/WhatsAppButton'
import { buttonClass } from '@/components/ui/button'
import { getPathname, Link } from '@/i18n/navigation'
import { routing, type Locale } from '@/i18n/routing'
import { galleryLimit, hasRichText, pageFromQuery, priceGuide } from '@/lib/category/category'
import { getCategory } from '@/lib/data/categories'
import { getProjectCards } from '@/lib/data/projects'
import { getSiteSettings } from '@/lib/data/site'
import { safeDecode } from '@/lib/http/safe-decode'
import { buildAlternates, siteUrl } from '@/lib/seo/alternates'

type Params = Promise<{ locale: Locale; category: string }>
type Search = Promise<{ sayfa?: string | string[] }>

const categoryPath = (locale: Locale, slug: string) => getPathname({ locale, href: { pathname: '/[category]', params: { category: slug } } })

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, category: slug } = await params
  const data = await getCategory(locale, safeDecode(slug), galleryLimit(1))
  // notFound() here sets a real 404 status before the page body streams.
  if (!data) notFound()
  const { category, slugs } = data
  const paths = Object.fromEntries(routing.locales.map((l) => [l, slugs[l] ? categoryPath(l, slugs[l]) : null]))
  return {
    title: category.seo?.title || category.name,
    description: category.seo?.description || category.shortDesc || undefined,
    alternates: buildAlternates({ current: locale, paths, site: siteUrl() }),
  }
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

  const [t, tCta, format, settings, projects] = await Promise.all([
    getTranslations('Category'),
    getTranslations('Cta'),
    getFormatter(),
    getSiteSettings(locale),
    getProjectCards(locale).then((cards) => cards.filter((c) => c.categories.some((x) => x.id === category.id)).slice(0, 6)),
  ])
  const price = priceGuide(category.priceGuide, locale)
  const faq = (category.faq ?? []).filter((f) => f.q && f.a)
  const areas = (settings.areaServed ?? []).map((a) => a.name).filter(Boolean)
  const url = siteUrl() + categoryPath(locale, slug)
  const wa = { kind: 'category' as const, vars: { category: category.name, url } }
  const h2 = 'text-[1.6rem] leading-tight md:text-[2rem]'

  return (
    <>
      <Container as="header" className="pt-10 pb-8 md:pt-16 md:pb-12">
        <h1 className="max-w-[22ch] text-[2.1rem] leading-[1.08] md:text-[3.2rem]">{category.name}</h1>
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
          <Picture media={hero} sizes="(min-width: 1280px) 1232px, 100vw" priority className="aspect-[4/3]! rounded-[var(--radius-photo)] md:aspect-[21/9]!" />
        </Container>
      )}

      {photos.length > 0 && (
        <Container as="section" aria-labelledby="gallery-h" className="scroll-mt-24">
          <h2 id="gallery-h" className="sr-only">
            {t('gallery')}
          </h2>
          <ul className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3 lg:grid-cols-4">
            {photos.map((m, i) => {
              const pic = (
                <Picture
                  media={m}
                  sizes="(min-width: 1280px) 304px, (min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                  maxWidth={960}
                  priority={i < 2}
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

      {hasRichText(category.body) && (
        <Container as="section" className="mt-16 md:mt-20">
          <div className="max-w-[68ch] text-[1.0625rem] md:text-[1.125rem] [&_a]:text-action [&_a]:underline [&_h2]:mt-12 [&_h2]:mb-4 [&_h2]:text-[1.5rem] [&_h3]:mt-8 [&_h3]:mb-3 [&_h3]:text-[1.2rem] [&_li]:mt-1.5 [&_ol]:list-decimal [&_ol]:ps-6 [&_p]:mt-4 [&_ul]:list-disc [&_ul]:ps-6 [&>*:first-child]:mt-0">
            <RichText data={category.body!} disableContainer />
          </div>
        </Container>
      )}

      {Maybe.isSome(price) && (
        <Container as="section" aria-labelledby="price-h" className="mt-16 md:mt-20">
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
        </Container>
      )}

      {faq.length > 0 && (
        <Container as="section" aria-labelledby="faq-h" className="mt-16 md:mt-20">
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

      <section aria-labelledby="cta-h" className="mt-16 border-y border-line bg-mist md:mt-20">
        <Container className="flex flex-col gap-6 py-12 md:flex-row md:items-center md:justify-between md:py-14">
          <div>
            <h2 id="cta-h" className="text-[1.5rem] md:text-[1.85rem]">
              {t('ctaTitle', { category: category.name })}
            </h2>
            <p className="mt-2 max-w-[56ch] text-ink-soft">{t('ctaText')}</p>
            {areas.length > 0 && <p className="mt-3 max-w-[56ch] text-[0.95rem] text-ink-soft">{t('areas', { areas: areas.join(', ') })}</p>}
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <WhatsAppButton locale={locale} context={wa} place="category_cta" />
            <Link href="/iletisim" className={buttonClass.outline}>
              {tCta('quote')}
            </Link>
          </div>
        </Container>
      </section>
    </>
  )
}
