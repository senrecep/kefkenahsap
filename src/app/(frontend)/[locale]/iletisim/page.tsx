import { Mail, MapPin, Phone } from 'lucide-react'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Container } from '@/components/ui/Container'
import { buttonClass } from '@/components/ui/button'
import { WhatsAppButton } from '@/components/ui/WhatsAppButton'
import { getPathname } from '@/i18n/navigation'
import { routing, type Locale } from '@/i18n/routing'
import { directionsUrl, telLink, waLink } from '@/lib/contact'
import { getNavCategories, getSiteSettings } from '@/lib/data/site'
import { pickUtm } from '@/lib/leads/guard'
import { buildAlternates, siteUrl } from '@/lib/seo/alternates'

import { ContactForm } from './ContactForm'

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Contact' })
  const paths = Object.fromEntries(routing.locales.map((l) => [l, getPathname({ locale: l, href: '/iletisim' })]))
  return { title: t('metaTitle'), description: t('metaDescription'), alternates: buildAlternates({ current: locale, paths, site: siteUrl() }) }
}

export default async function ContactPage({ params, searchParams }: Props) {
  const { locale: l } = await params
  const locale = l as Locale
  setRequestLocale(locale)
  const [t, tDays, settings, categories, query] = await Promise.all([
    getTranslations('Contact'),
    getTranslations('Days'),
    getSiteSettings(locale),
    getNavCategories(locale),
    searchParams,
  ])
  const a = settings.address
  const directions = directionsUrl(a)
  const h2 = 'font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wide text-ink-soft'
  const link = 'text-lg text-ink underline decoration-ink/25 underline-offset-4 hover:decoration-action'
  const utm = pickUtm(query)

  return (
    <Container className="pt-10 pb-6 md:pt-14">
      <h1 className="font-[family-name:var(--font-display)] text-[clamp(2rem,4vw,3rem)] font-semibold tracking-tight text-balance">{t('title')}</h1>
      <p className="mt-3 max-w-[60ch] text-lg text-ink-soft">{t('intro')}</p>

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <section aria-labelledby="reach-us" className="grid content-start gap-8">
          <h2 id="reach-us" className="sr-only">{t('reachUs')}</h2>
          <WhatsAppButton locale={locale} context={{ kind: 'contact' }} place="contact" className="w-full sm:w-auto sm:justify-self-start" />

          {!!settings.phones?.length && (
            <div>
              <p className={h2}>{t('phone')}</p>
              <ul className="mt-2 grid gap-1.5">
                {settings.phones.map((p) => {
                  const tel = telLink({ phones: [p] })
                  return (
                    <li key={p.number} className="flex items-center gap-2.5">
                      <Phone aria-hidden size={18} strokeWidth={1.75} className="text-ink-soft" />
                      {tel ? (
                        <a href={tel.href} data-umami-event="phone_click" data-umami-event-place="contact" className={link}>
                          {p.number}
                        </a>
                      ) : (
                        <span className="text-lg">{p.number}</span>
                      )}
                      {p.label && <span className="text-ink-soft">{p.label}</span>}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {settings.email && (
            <div>
              <p className={h2}>{t('email')}</p>
              <p className="mt-2 flex items-center gap-2.5">
                <Mail aria-hidden size={18} strokeWidth={1.75} className="text-ink-soft" />
                <a href={`mailto:${settings.email}`} className={link}>{settings.email}</a>
              </p>
            </div>
          )}

          {(a?.street || a?.city) && (
            <div>
              <p className={h2}>{t('address')}</p>
              <address className="mt-2 flex gap-2.5 text-lg not-italic">
                <MapPin aria-hidden size={18} strokeWidth={1.75} className="mt-1.5 shrink-0 text-ink-soft" />
                <span>
                  {a.street}
                  {(a.district || a.city) && <><br />{[a.postalCode, a.district, a.city].filter(Boolean).join(' ')}</>}
                </span>
              </address>
              {directions && (
                <a href={directions} target="_blank" rel="noopener" className={`${buttonClass.outline} mt-4`}>
                  <MapPin aria-hidden size={18} strokeWidth={1.75} />
                  {t('directions')}
                </a>
              )}
            </div>
          )}

          {!!settings.hours?.length && (
            <div>
              <p className={h2}>{t('hours')}</p>
              <ul className="mt-2 grid gap-1 text-lg">
                {settings.hours.map((r) => (
                  <li key={r.id ?? `${r.days?.join()}${r.opens}`}>
                    {(r.days ?? []).map((d) => tDays(d)).join(', ')}: <span className="tabular-nums">{r.opens}–{r.closes}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section aria-labelledby="quote-form" className="lg:border-s lg:border-line lg:ps-16">
          <h2 id="quote-form" className="mb-6 font-[family-name:var(--font-display)] text-2xl font-semibold">{t('formTitle')}</h2>
          <ContactForm
            locale={locale}
            siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
            services={categories.map((c) => c.name).filter(Boolean)}
            whatsappHref={waLink(settings, { kind: 'contact' })}
            sourcePage={getPathname({ locale, href: '/iletisim' })}
            {...(utm ? { utm } : {})}
          />
        </section>
      </div>
    </Container>
  )
}
