import { RichText } from '@payloadcms/richtext-lexical/react'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Maybe } from 'tsentials/maybe'

import { Breadcrumb } from '@/components/site/Breadcrumb'
import { ProjectCard } from '@/components/projects/ProjectCard'
import { CtaBand } from '@/components/site/CtaBand'
import { JsonLd } from '@/components/seo/JsonLd'
import { CONTAINER_SIZES, Container } from '@/components/ui/Container'
import { Picture } from '@/components/ui/Picture'
import { WhatsAppButton } from '@/components/ui/WhatsAppButton'
import { buttonClass } from '@/components/ui/button'
import { getPathname, Link } from '@/i18n/navigation'
import { routing, type Locale } from '@/i18n/routing'
import { getProject, getProjectCards } from '@/lib/data/projects'
import { responsiveImage } from '@/lib/media/image'
import { categoryChips, projectFacts } from '@/lib/projects/facts'
import { safeDecode } from '@/lib/http/safe-decode'
import { publicTestimonial } from '@/lib/projects/testimonial'
import { siteUrl } from '@/lib/seo/alternates'
import { creativeWorkJsonLd } from '@/lib/seo/jsonld'
import { pageMetadata } from '@/lib/seo/page-metadata'

type Params = Promise<{ locale: Locale; slug: string }>

const projectPath = (locale: Locale, slug: string) => getPathname({ locale, href: { pathname: '/projeler/[slug]', params: { slug } } })
type LexicalNode = { type?: string; text?: string; children?: LexicalNode[] }
const hasText = (n: LexicalNode | undefined): boolean => Boolean(n && (n.type === 'text' ? n.text?.trim() : n.children?.some(hasText)))

// ISR on first request (see the locale layout).
export const generateStaticParams = () => []

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params
  const data = await getProject(locale, safeDecode(slug))
  // notFound() here sets a real 404 status before the page body streams.
  if (!data) notFound()
  // `slugs` holds only locales whose slug and title are both filled (dil-yayında).
  const paths = Object.fromEntries(routing.locales.map((l) => [l, data.slugs[l] ? projectPath(l, data.slugs[l]) : null]))
  const place = [data.project.district, data.project.city].filter(Boolean).join(', ')
  return pageMetadata({ locale, title: data.project.title, description: place ? `${data.project.title} — ${place}` : undefined, paths, ownOgImage: true })
}

export default async function ProjectPage({ params }: { params: Params }) {
  const { locale, slug: raw } = await params
  setRequestLocale(locale)
  const slug = safeDecode(raw)
  const data = await getProject(locale, slug)
  if (!data) notFound()
  const { project, gallery, cover } = data
  const [t, tCta, tList, cards] = await Promise.all([getTranslations('Project'), getTranslations('Cta'), getTranslations('Projects'), getProjectCards(locale)])

  const facts = projectFacts(project as Parameters<typeof projectFacts>[0], locale, { m2: t('units.m2'), m: t('units.m'), piece: t('units.piece') })
  const chips = categoryChips(project.categories)
  const testimonial = publicTestimonial(project.testimonial)
  const catIds = new Set(cards.find((c) => c.id === project.id)?.categories.map((c) => c.id))
  const similar = cards.filter((c) => c.id !== project.id && c.categories.some((x) => catIds.has(x.id))).slice(0, 3)
  const hero = cover ?? gallery[0]
  const photos = gallery.filter((m) => m.id !== hero?.id)
  const wa = { kind: 'project' as const, vars: { project: project.title, url: siteUrl().replace(/\/$/, '') + projectPath(locale, slug) } }
  const h2 = 'text-[1.6rem] leading-tight md:text-[2rem]'
  const wood = facts.find((f) => f.key === 'wood')?.value
  // Only what the page shows: title, the künye facts and the photos on the page.
  const work = creativeWorkJsonLd({
    site: siteUrl().replace(/\/$/, ''),
    name: project.title,
    url: wa.vars.url,
    year: project.year,
    about: chips.map((c) => c.name),
    place: [project.district, project.city],
    materials: Array.isArray(wood) ? wood : [],
    images: [hero, ...photos].filter((m) => m !== undefined).map((m) => ({ url: responsiveImage(m).src })),
  })

  return (
    <>
      <JsonLd data={work} />
      <Container as="header" className="pt-10 pb-8 md:pt-16 md:pb-10">
        <Breadcrumb
          locale={locale}
          className="mb-6"
          items={[
            { name: tList('title'), path: getPathname({ locale, href: '/projeler' }) },
            { name: project.title, path: projectPath(locale, slug) },
          ]}
        />
        <h1 className="max-w-[24ch] text-[2.1rem] leading-[1.08] md:text-[3.2rem]">{project.title}</h1>
        {chips.length > 0 && (
          <ul aria-label={t('categories')} className="mt-5 flex flex-wrap gap-2">
            {chips.map((c) => (
              <li key={c.slug}>
                <Link
                  href={{ pathname: '/[category]', params: { category: c.slug } }}
                  className="inline-flex min-h-11 items-center rounded-full border border-line bg-paper px-4 font-[family-name:var(--font-display)] text-[0.95rem] font-semibold text-ink transition-colors duration-150 hover:border-ink/40"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Container>
      {hero && (
        <Container>
          <Picture media={hero} sizes={CONTAINER_SIZES} priority className="aspect-[16/9]! rounded-[var(--radius-photo)]" />
        </Container>
      )}

      {/* The künye column exists only when there is a künye; otherwise the story keeps the full measure. */}
      <Container className={`mt-10 grid gap-10 md:mt-14 lg:gap-16 ${facts.length > 0 ? 'lg:grid-cols-[minmax(0,1fr)_22rem]' : ''}`}>
        {facts.length > 0 && (
          <section aria-labelledby="facts-h" className="rounded-[var(--radius-photo)] border border-line p-6 lg:order-last lg:self-start">
            <h2 id="facts-h" className="text-[1.2rem]">
              {t('facts')}
            </h2>
            <dl className="mt-4 grid gap-4">
              {facts.map((f) => (
                <div key={f.key} className="grid gap-1 border-t border-line pt-4 first:border-t-0 first:pt-0">
                  <dt className="text-[0.95rem] text-ink-soft">{t(f.key)}</dt>
                  <dd className="font-[family-name:var(--font-display)] font-semibold">
                    {Array.isArray(f.value) ? (
                      <ul className="flex flex-wrap gap-2">
                        {f.value.map((v) => (
                          <li key={v} className="rounded-full border border-line bg-mist px-3 py-1 text-[0.92rem]">
                            {v}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      f.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}
        <div>
          {hasText(project.story?.root as LexicalNode | undefined) && (
            <div className="max-w-[68ch] text-[1.0625rem] md:text-[1.125rem] [&_a]:text-action [&_a]:underline [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-[1.4rem] [&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:text-[1.2rem] [&_ol]:list-decimal [&_ol]:ps-6 [&_p]:mt-4 [&_ul]:list-disc [&_ul]:ps-6 [&>*:first-child]:mt-0">
              <RichText data={project.story!} disableContainer />
            </div>
          )}
          <div className="mt-8 flex flex-wrap gap-3">
            <WhatsAppButton locale={locale} context={wa} place="project_intro" />
            <Link href="/iletisim" className={buttonClass.outline}>
              {tCta('quote')}
            </Link>
          </div>
        </div>
      </Container>

      {photos.length > 0 && (
        <Container as="section" aria-labelledby="photos-h" className="mt-16 md:mt-20">
          <h2 id="photos-h" className={h2}>
            {t('gallery')}
          </h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {photos.map((m) => {
              const pic = <Picture media={m} sizes="(min-width: 1280px) 610px, (min-width: 640px) 50vw, calc(100vw - 2rem)" maxWidth={1280} className="aspect-[3/2]! rounded-[var(--radius-photo)]" />
              return (
                <li key={m.id}>
                  {m.seoFilename ? (
                    <Link href={{ pathname: '/galeri/[slug]', params: { slug: m.seoFilename } }} className="block rounded-[var(--radius-photo)]">
                      {pic}
                    </Link>
                  ) : (
                    pic
                  )}
                </li>
              )
            })}
          </ul>
        </Container>
      )}

      {Maybe.isSome(testimonial) && (
        <Container as="section" className="mt-16 md:mt-20">
          <figure className="max-w-3xl border-t border-line pt-8">
            <blockquote className="font-[family-name:var(--font-display)] text-[1.35rem] leading-snug font-semibold md:text-[1.6rem]">
              <p>{testimonial.value.quote}</p>
            </blockquote>
            {testimonial.value.author && <figcaption className="mt-4 text-ink-soft">{testimonial.value.author}</figcaption>}
          </figure>
        </Container>
      )}

      {similar.length > 0 && (
        <Container as="section" aria-labelledby="similar-h" className="mt-16 md:mt-20">
          <h2 id="similar-h" className={h2}>
            {t('similar')}
          </h2>
          <ul className="mt-6 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((p) => (
              <li key={p.id}>
                <ProjectCard project={p} />
              </li>
            ))}
          </ul>
        </Container>
      )}

      <CtaBand locale={locale} title={t('ctaTitle')} text={t('ctaText')} wa={wa} place="project_cta" />
    </>
  )
}
