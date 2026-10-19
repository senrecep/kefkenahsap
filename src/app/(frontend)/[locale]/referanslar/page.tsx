import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { CtaBand } from '@/components/site/CtaBand'
import { GoogleReviewLink } from '@/components/site/GoogleReviewLink'
import { JsonLd } from '@/components/seo/JsonLd'
import { buttonClass } from '@/components/ui/button'
import { Container } from '@/components/ui/Container'
import { Picture } from '@/components/ui/Picture'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { getProjectCards, getReferences } from '@/lib/data/projects'
import { getSiteSettings } from '@/lib/data/site'
import { itemListJsonLd } from '@/lib/seo/jsonld'
import { pageMetadata, staticPaths } from '@/lib/seo/page-metadata'

type Params = Promise<{ locale: Locale }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'References' })
  return pageMetadata({ locale, title: t('title'), description: t('description'), paths: await staticPaths('/referanslar') })
}

export default async function ReferencesPage({ params }: { params: Params }) {
  const { locale } = await params
  setRequestLocale(locale)
  const [t, refs, cards, settings] = await Promise.all([getTranslations('References'), getReferences(locale), getProjectCards(locale), getSiteSettings(locale)])
  const review = settings.social?.googleReview
  // A reference's photo is its first linked project's cover (approved only, via the card). Photo references lead in
  // their own grid; the rest follow as a compact typographic grid, so a row never mixes a photo with empty cells.
  const covers = new Map(cards.map((c) => [c.id, c.cover]))
  const rows = refs.map((r) => ({ ...r, cover: r.projects[0] && covers.get(r.projects[0].id) }))
  const pictured = rows.filter((r) => r.cover)
  const plain = rows.filter((r) => !r.cover)
  return (
    <>
      <Container className="pt-10 md:pt-16">
        <JsonLd data={itemListJsonLd(refs.map((r) => ({ name: r.name })))} />
        <h1 className="text-[2.1rem] leading-[1.08] md:text-[3.2rem]">{t('title')}</h1>
        <p className="mt-5 max-w-[62ch] text-[1.15rem] text-ink-soft md:text-[1.25rem]">{t('description')}</p>
        {refs.length > 0 ? (
          <>
            {pictured.length > 0 && (
              <ul className="mt-12 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                {pictured.map((r) => (
                  <li key={r.id}>
                    <Link href={{ pathname: '/projeler/[slug]', params: { slug: r.projects[0]!.slug } }} tabIndex={-1} aria-hidden className="mb-4 block">
                      <Picture
                        media={r.cover!}
                        sizes="(min-width: 1280px) 400px, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        maxWidth={960}
                        className="aspect-[3/2]! rounded-[var(--radius-photo)]"
                      />
                    </Link>
                    <Reference r={r} />
                  </li>
                ))}
              </ul>
            )}
            {plain.length > 0 && (
              <ul className="mt-12 grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
                {plain.map((r) => (
                  <li key={r.id} className="border-t border-line py-5">
                    <Reference r={r} />
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="mt-10 text-ink-soft">{t('empty')}</p>
        )}
        {review && (
          <section aria-labelledby="review-h" className="mt-16 flex flex-col gap-5 border-t border-line pt-10 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 id="review-h" className="text-[1.5rem] md:text-[1.85rem]">{t('reviewTitle')}</h2>
              <p className="mt-2 max-w-[56ch] text-ink-soft">{t('reviewText')}</p>
            </div>
            <GoogleReviewLink href={review} place="references" className={`${buttonClass.outline} shrink-0 self-start md:self-auto`}>
              {t('reviewButton')}
            </GoogleReviewLink>
          </section>
        )}
      </Container>
      <CtaBand locale={locale} place="references_cta" />
    </>
  )
}

function Reference({ r }: { r: { name: string; location?: string | null; projects: { id: number; title: string; slug: string }[] } }) {
  return (
    <>
      <h2 className="font-[family-name:var(--font-display)] text-[1.2rem] leading-snug font-semibold text-balance">{r.name}</h2>
      {r.location && <p className="mt-1 text-ink-soft">{r.location}</p>}
      {r.projects.length > 0 && (
        <ul className="mt-3 grid gap-1">
          {r.projects.map((p) => (
            <li key={p.id}>
              <Link href={{ pathname: '/projeler/[slug]', params: { slug: p.slug } }} className="font-semibold text-action underline underline-offset-2 hover:text-action-deep">
                {p.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
