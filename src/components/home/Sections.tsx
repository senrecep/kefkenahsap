import { ArrowRight, MapPin, MessageCircle, Phone, Plus } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'

import { GalleryFilters } from '@/components/gallery/GalleryFilters'
import { GalleryGrid } from '@/components/gallery/GalleryGrid'
import { LocationMap } from '@/components/site/LocationMap'
import { buttonClass } from '@/components/ui/button'
import { JsonLd } from '@/components/seo/JsonLd'
import { Container } from '@/components/ui/Container'
import { Picture } from '@/components/ui/Picture'
import { WhatsAppButton } from '@/components/ui/WhatsAppButton'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { telLink } from '@/lib/contact'
import { getServiceTiles } from '@/lib/data/categories'
import { galleryTileCover, galleryTileFills } from '@/lib/gallery/curate'
import { getFeaturedImages, getFeaturedProjects, getReferences, getWoodGuide } from '@/lib/data/home'
import { getNavCategories, getSiteSettings } from '@/lib/data/site'
import { faqJsonLd } from '@/lib/seo/jsonld'

type Heading = { heading?: string | null }

function Section({ title, children, aside, className = '' }: { title: string; children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <Container as="section" className={`py-16 md:py-24 ${className}`}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 md:mb-10">
        <h2 className="text-[clamp(1.75rem,3vw,2.5rem)]">{title}</h2>
        {aside}
      </div>
      {children}
    </Container>
  )
}

const more = 'inline-flex min-h-11 items-center gap-2 font-[family-name:var(--font-display)] font-semibold text-action hover:text-action-deep'

export async function FeaturedGallery({ locale, heading, limit }: Heading & { locale: Locale; limit?: number | null }) {
  const [t, items, categories] = await Promise.all([
    getTranslations('Home'),
    getFeaturedImages(locale, Math.min(Math.max(limit || 12, 1), 24)),
    getNavCategories(locale),
  ])
  if (!items.length) return null
  return (
    <Section
      title={heading || t('galleryTitle')}
      aside={
        <Link href="/galeri" className={more}>
          {t('galleryAll')}
          <ArrowRight aria-hidden size={18} strokeWidth={1.75} className="rtl:rotate-180" />
        </Link>
      }
    >
      <GalleryFilters locale={locale} categories={categories} tags={[]} className="mb-8" />
      <GalleryGrid initial={items} total={items.length} trim />
    </Section>
  )
}

export async function Services({ locale, heading }: Heading & { locale: Locale }) {
  const [t, tGallery, tServices, listed, curated] = await Promise.all([
    getTranslations('Home'),
    getTranslations('Gallery'),
    getTranslations('Services'),
    getServiceTiles(locale),
    getFeaturedImages(locale, 24),
  ])
  if (!listed.length) return null
  const cover = galleryTileCover(curated, listed)
  const sizes = '(min-width: 1280px) 400px, (min-width: 1024px) 31vw, 48vw'
  const pic = '!aspect-[4/3] rounded-[var(--radius-photo)]'
  const zoom = 'transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:scale-[1.03]'
  const name = 'mt-3 text-[1.05rem] group-hover:text-action sm:mt-4 sm:text-xl'
  const text = 'mt-1 line-clamp-2 text-[0.92rem] text-ink-soft sm:mt-1.5 sm:text-base'
  const empty = <span className="block aspect-[4/3] rounded-[var(--radius-photo)] bg-mist" />
  return (
    <Section title={heading || t('servicesTitle')}>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-7 sm:gap-x-5 sm:gap-y-9 lg:grid-cols-3">
        {listed.map((c) => (
          <li key={c.id}>
            <Link href={{ pathname: '/[category]', params: { category: c.slug } }} className="group block">
              {c.image ? <Picture media={c.image} alt="" sizes={sizes} maxWidth={1280} className={pic} imgClassName={zoom} /> : empty}
              <h3 className={name}>{c.name}</h3>
              {c.shortDesc && <p className={text}>{c.shortDesc}</p>}
            </Link>
          </li>
        ))}
        {/* The last cell: the whole gallery, when it closes a hole (11 services) in the 2- and 3-column grids. */}
        {galleryTileFills(listed.length) && (
          <li>
            <Link href="/galeri" className="group block">
              {cover ? <Picture media={cover.media} alt="" sizes={sizes} maxWidth={1280} className={pic} imgClassName={zoom} /> : empty}
              <h3 className={`${name} flex items-center gap-2`}>
                {tGallery('title')}
                <ArrowRight aria-hidden size={18} strokeWidth={1.75} className="shrink-0 text-action rtl:rotate-180" />
              </h3>
              <p className={text}>{tServices('galleryText')}</p>
            </Link>
          </li>
        )}
      </ul>
    </Section>
  )
}

export async function FeaturedProjects({ locale, heading }: Heading & { locale: Locale }) {
  const [t, projects] = await Promise.all([getTranslations('Home'), getFeaturedProjects(locale)])
  if (!projects.length) return null
  return (
    <Section title={heading || t('projectsTitle')}>
      <ul className="grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <li key={p.id}>
            <Link href={{ pathname: '/projeler/[slug]', params: { slug: p.slug! } }} className="group block">
              {p.cover && typeof p.cover === 'object' && (
                <Picture media={p.cover} sizes="(min-width: 1024px) 31vw, (min-width: 640px) 48vw, 100vw" maxWidth={1280} className="!aspect-[4/3] rounded-[var(--radius-photo)]" />
              )}
              <h3 className="mt-4 text-xl group-hover:text-action">{p.title}</h3>
              {(p.city || p.year) && <p className="mt-1 text-ink-soft">{[p.city, p.year].filter(Boolean).join(' · ')}</p>}
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  )
}

const STEP_KEYS = ['survey', 'quote', 'build', 'install', 'care'] as const

export async function Process({ heading, steps }: Heading & { steps?: { title: string; text?: string | null }[] | null }) {
  const t = await getTranslations('Home')
  const list = steps?.length ? steps : STEP_KEYS.map((k) => ({ title: t(`steps.${k}.title`), text: t(`steps.${k}.text`) }))
  return (
    <Section title={heading || t('processTitle')}>
      <ol className="grid border-t border-line md:grid-cols-5 md:border-t-0">
        {list.map((s, i) => (
          <li key={s.title} className="grid grid-cols-[2.5rem_1fr] gap-x-3 border-b border-line py-5 md:block md:border-b-0 md:border-t md:py-0 md:pt-5 md:pe-6">
            <span aria-hidden className="font-[family-name:var(--font-display)] text-sm font-semibold text-ink-soft tabular-nums">{String(i + 1).padStart(2, '0')}</span>
            <div>
              <h3 className="text-lg md:mt-3">{s.title}</h3>
              {s.text && <p className="mt-1.5 text-[0.98rem] text-ink-soft">{s.text}</p>}
            </div>
          </li>
        ))}
      </ol>
    </Section>
  )
}

export async function References({ locale, heading }: Heading & { locale: Locale }) {
  const [t, refs] = await Promise.all([getTranslations('Home'), getReferences(locale)])
  if (!refs.length) return null
  return (
    <Section title={heading || t('referencesTitle')}>
      <ul className="grid border-t border-line sm:grid-cols-2 lg:grid-cols-3">
        {refs.map((r) => (
          <li key={r.id} className="border-b border-line py-4 pe-4">
            <p className="font-[family-name:var(--font-display)] font-semibold">{r.name}</p>
            {r.location && <p className="text-[0.95rem] text-ink-soft">{r.location}</p>}
          </li>
        ))}
      </ul>
    </Section>
  )
}

const WOODS = ['iroko', 'teak', 'pine', 'thermo'] as const
const COLS = ['origin', 'durability', 'care', 'use'] as const

export async function WoodTypes({ locale, heading }: Heading & { locale: Locale }) {
  const [t, guide] = await Promise.all([getTranslations('Home'), getWoodGuide(locale).catch(() => null)])
  // Each species name opens the "Ahşap türleri" guide once it is published in this locale.
  const name = (w: (typeof WOODS)[number]) =>
    guide ? (
      <a href={guide.href} className="underline decoration-ink/25 underline-offset-4 hover:text-action hover:decoration-current">
        {t(`woods.${w}.name`)}
      </a>
    ) : (
      t(`woods.${w}.name`)
    )
  return (
    <Section title={heading || t('woodTitle')}>
      <p className="-mt-4 mb-8 max-w-[65ch] text-ink-soft">{t('woodIntro')}</p>
      {/* Below 640px each wood is a disclosure: name and use at a glance, the rest on tap (the table needs the width). */}
      <ul className="border-t border-ink/25 sm:hidden">
        {WOODS.map((w) => (
          <li key={w} className="border-b border-line">
            <details className="group">
              <summary className="flex min-h-14 cursor-pointer list-none items-start justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden">
                <span>
                  <span className="block font-[family-name:var(--font-display)] text-lg font-semibold">{t(`woods.${w}.name`)}</span>
                  <span className="mt-0.5 block text-[0.98rem] text-ink-soft">{t(`woods.${w}.use`)}</span>
                </span>
                <Plus aria-hidden size={20} strokeWidth={1.75} className="mt-1 shrink-0 text-action transition-transform group-open:rotate-45" />
              </summary>
              <dl className="grid gap-2.5 pb-5 text-[0.98rem]">
                {COLS.filter((c) => c !== 'use').map((c) => (
                  <div key={c}>
                    <dt className="font-[family-name:var(--font-display)] text-sm font-semibold">{t(`woodCols.${c}`)}</dt>
                    <dd className="text-ink-soft">{t(`woods.${w}.${c}`)}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </li>
        ))}
      </ul>
      <div className="-mx-4 hidden overflow-x-auto px-4 sm:block md:mx-0 md:px-0">
        <table className="w-full min-w-[44rem] border-collapse text-start text-[0.98rem]">
          <thead>
            <tr className="border-b border-ink/25">
              <th scope="col" className="py-3 pe-4 text-start font-[family-name:var(--font-display)] font-semibold">{t('woodCols.type')}</th>
              {COLS.map((c) => (
                <th key={c} scope="col" className="py-3 pe-4 text-start font-[family-name:var(--font-display)] font-semibold">{t(`woodCols.${c}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WOODS.map((w) => (
              <tr key={w} className="border-b border-line align-top">
                <th scope="row" className="py-4 pe-4 text-start font-[family-name:var(--font-display)] font-semibold">{name(w)}</th>
                {COLS.map((c) => (
                  <td key={c} className="py-4 pe-4 text-ink-soft">{t(`woods.${w}.${c}`)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {guide && (
        <a href={guide.href} className={`${more} mt-6`}>
          {guide.title}
          <ArrowRight aria-hidden size={18} strokeWidth={1.75} className="rtl:rotate-180" />
        </a>
      )}
    </Section>
  )
}

export async function Faq({ heading, items }: Heading & { items?: { q: string; a: string }[] | null }) {
  if (!items?.length) return null
  const t = await getTranslations('Home')
  return (
    <Section title={heading || t('faqTitle')}>
      <div className="max-w-3xl border-t border-line">
        {items.map((f) => (
          <details key={f.q} className="group border-b border-line">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 font-[family-name:var(--font-display)] font-semibold">
              {f.q}
              <Plus aria-hidden size={20} strokeWidth={1.75} className="shrink-0 text-action transition-transform group-open:rotate-45" />
            </summary>
            <p className="pb-5 text-ink-soft">{f.a}</p>
          </details>
        ))}
      </div>
      <JsonLd data={faqJsonLd(items)} />
    </Section>
  )
}

export async function Contact({ locale, heading }: Heading & { locale: Locale }) {
  const [t, tCta, settings] = await Promise.all([getTranslations('Home'), getTranslations('Cta'), getSiteSettings(locale)])
  const tel = telLink(settings)
  const a = settings.address
  const address = [a?.street, [a?.postalCode, a?.district, a?.city].filter(Boolean).join(' ')].filter(Boolean)
  // dt/dd sit directly in the row div (a valid <dl> group); the icon lives in <dt>, hung in the start padding.
  const row = 'relative border-b border-line py-4 ps-8'
  return (
    <Section title={heading || t('contactTitle')} className="pb-8 md:pb-12">
      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <p className="max-w-[48ch] text-lg">{t('contactText')}</p>
          {/* The homepage's closing pair (same as CtaBand elsewhere), so the page does not end twice. */}
          <div className="mt-6 flex flex-wrap gap-3">
            <WhatsAppButton locale={locale} place="home-contact" context={{ kind: 'contact' }} />
            <Link href="/iletisim" className={buttonClass.outline}>
              {tCta('quote')}
            </Link>
          </div>
        </div>
        <dl className="border-t border-line">
          {tel && (
            <div className={row}>
              <dt className="text-[0.95rem] text-ink-soft">
                <Phone aria-hidden size={20} strokeWidth={1.75} className="absolute start-0 top-[1.125rem] text-action" />
                {t('phone')}
              </dt>
              <dd>
                {settings.phones?.map((p) => (
                  <a key={p.number} href={telLink({ phones: [p] })?.href} data-umami-event="phone_click" data-umami-event-place="home-contact" className="block font-[family-name:var(--font-display)] font-semibold hover:text-action">
                    <bdi dir="ltr">{p.number}</bdi>
                    {p.whatsapp && <MessageCircle aria-label="WhatsApp" size={16} strokeWidth={1.75} className="ms-2 inline align-[-2px] text-action" />}
                  </a>
                ))}
              </dd>
            </div>
          )}
          {address.length > 0 && (
            <div className={row}>
              <dt className="text-[0.95rem] text-ink-soft">
                <MapPin aria-hidden size={20} strokeWidth={1.75} className="absolute start-0 top-[1.125rem] text-action" />
                {t('address')}
              </dt>
              <dd>
                <address className="not-italic">{address.join(', ')}</address>
                <LocationMap address={a} className="mt-3" />
              </dd>
            </div>
          )}
        </dl>
      </div>
    </Section>
  )
}
