import { RichText } from '@payloadcms/richtext-lexical/react'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Maybe } from 'tsentials/maybe'

import { proseClass } from '@/components/content/ContentPage'
import { Container } from '@/components/ui/Container'
import { Picture } from '@/components/ui/Picture'
import { buttonClass } from '@/components/ui/button'
import { WhatsAppButton } from '@/components/ui/WhatsAppButton'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { sinceYear } from '@/lib/company'
import { getWorkPhotos } from '@/lib/data/gallery'
import { CMS_PAGES, getPage, getPageTitles } from '@/lib/data/pages'
import { getSiteSettings } from '@/lib/data/site'
import { cmsPagePaths, pageMetadata } from '@/lib/seo/page-metadata'

const SLUGS = CMS_PAGES['/hakkimizda']
// The jobs that show capacity (PRODUCT.md positioning): bridges and piers, then timber structures.
// Both slugs of the renamed category (#172): whichever the database holds is used.
const WORK_CATEGORIES = ['kopru-ve-iskele', 'sundurma-ve-ahsap-cati', 'ahsap-yapilar'] as const
type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const [t, page, settings] = await Promise.all([getTranslations({ locale, namespace: 'About' }), getPage(locale as Locale, SLUGS), getSiteSettings(locale as Locale)])
  // An admin-written SEO title is complete; otherwise the layout template appends the company name.
  return pageMetadata({
    locale: locale as Locale,
    title: page?.seo?.title ? { absolute: page.seo.title } : (page?.title ?? t('title')),
    description: page?.seo?.description || t('metaDescription', { company: settings.companyName, district: settings.address?.district || settings.address?.city || 'none' }),
    paths: await cmsPagePaths('/hakkimizda', await getPageTitles(SLUGS)),
  })
}

export default async function AboutPage({ params }: Props) {
  const { locale: l } = await params
  const locale = l as Locale
  setRequestLocale(locale)
  const [t, page, settings, photos] = await Promise.all([getTranslations('About'), getPage(locale, SLUGS), getSiteSettings(locale), getWorkPhotos(locale, WORK_CATEGORIES, 3)])
  const since = sinceYear({ foundingYear: settings.foundingYear })
  const a = settings.address
  // Only confirmed siteSettings facts; an empty field renders nothing (PRODUCT.md).
  const facts = [
    Maybe.isSome(since) && { k: t('since'), v: String(since.value) },
    settings.founder?.name && { k: t('founder'), v: settings.founder.name },
    (a?.district || a?.city) && { k: t('workshop'), v: [a?.district, a?.city].filter(Boolean).join(', ') },
  ].filter((f): f is { k: string; v: string } => Boolean(f))

  return (
    <Container className="pt-10 pb-6 md:pt-14">
      <div className={`grid gap-12 ${photos.length ? 'lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16' : ''}`}>
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-[clamp(2rem,4vw,3rem)] font-semibold tracking-tight text-balance">{page?.title ?? t('title')}</h1>
          <div className={`mt-6 ${proseClass}`}>
            {page?.body ? <RichText data={page.body} /> : <p className="text-xl">{t('lead', { company: settings.companyName })}</p>}
          </div>
          {!!facts.length && (
            <dl className="mt-10 grid gap-x-10 gap-y-5 border-t border-line pt-6 sm:grid-cols-3 lg:grid-cols-2">
              {facts.map((f) => (
                <div key={f.k}>
                  <dt className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wide text-ink-soft">{f.k}</dt>
                  <dd className="mt-1 text-xl">{f.v}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="mt-10 flex flex-wrap gap-3">
            <WhatsAppButton locale={locale} place="about" />
            <Link href="/galeri" className={buttonClass.outline}>{t('seeWork')}</Link>
          </div>
        </div>
        {photos.length > 0 && (
          <ul className="grid grid-cols-2 gap-3 self-start">
            {photos.map((p, i) => (
              <li key={p.id} className={i === 0 || photos.length === 2 ? 'col-span-2' : ''}>
                <Link href={{ pathname: '/galeri/[slug]', params: { slug: p.slug } }} className="block rounded-[var(--radius-photo)]">
                  <Picture
                    media={p.media}
                    alt={p.alt}
                    {...(p.altLang ? { altLang: p.altLang } : {})}
                    sizes={i === 0 ? '(min-width: 1280px) 700px, (min-width: 1024px) 55vw, 100vw' : '(min-width: 1280px) 350px, (min-width: 1024px) 28vw, 50vw'}
                    maxWidth={1280}
                    priority={i === 0}
                    className="aspect-[4/3]! rounded-[var(--radius-photo)]"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Container>
  )
}
