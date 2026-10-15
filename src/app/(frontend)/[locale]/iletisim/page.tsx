import { Mail, MapPin, Phone } from 'lucide-react'
import type { Metadata } from 'next'
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server'

import { LocationMap } from '@/components/site/LocationMap'
import { Container } from '@/components/ui/Container'
import { buttonClass } from '@/components/ui/button'
import { WhatsAppButton } from '@/components/ui/WhatsAppButton'
import { getPathname, Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { directionsUrl, telLink, waLink } from '@/lib/contact'
import { getNavCategories, getSiteSettings } from '@/lib/data/site'
import { pickUtm } from '@/lib/leads/guard'
import { MAX_PHOTOS } from '@/lib/leads/validate'
import { pageMetadata, staticPaths } from '@/lib/seo/page-metadata'

import { ContactForm, type ContactCopy } from './ContactForm'

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Contact' })
  // metaTitle already names the company, so it bypasses the layout's "| company" template.
  return pageMetadata({ locale: locale as Locale, title: { absolute: t('metaTitle') }, description: t('metaDescription'), paths: await staticPaths('/iletisim') })
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
  const messages = (await getMessages({ locale })).Contact as Record<string, unknown> & { errors: Record<string, string> }
  const plainKeys = Object.keys(messages).filter((k) => typeof messages[k] === 'string' && k !== 'photosSelected' && k !== 'consent')
  const copy: ContactCopy = {
    text: Object.fromEntries([...plainKeys, ...Object.keys(messages.errors).map((k) => `errors.${k}`)].map((k) => [k, t(k)])),
    photosSelected: Array.from({ length: MAX_PHOTOS }, (_, i) => t('photosSelected', { count: i + 1 })),
    consent: t.rich('consent', {
      link: (chunks) => (
        <Link href="/kvkk" target="_blank" className="font-semibold text-action underline underline-offset-2 hover:text-action-deep">
          {chunks}
        </Link>
      ),
    }),
  }

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
                          <bdi dir="ltr">{p.number}</bdi>
                        </a>
                      ) : (
                        <span className="text-lg"><bdi dir="ltr">{p.number}</bdi></span>
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
                {/* Each line in its own bdi, like the phone numbers: the postcode stays first inside RTL pages. */}
                <span>
                  {a.street && <bdi dir="ltr">{a.street}</bdi>}
                  {(a.district || a.city) && <><br /><bdi dir="ltr">{[a.postalCode, a.district, a.city].filter(Boolean).join(' ')}</bdi></>}
                </span>
              </address>
              {/* With a Google Maps link set, LocationMap's "Google Haritalar'da aç" replaces the address search. */}
              {directions && !a.mapUrl && (
                <a href={directions} target="_blank" rel="noopener" className={`${buttonClass.outline} mt-4`}>
                  <MapPin aria-hidden size={18} strokeWidth={1.75} />
                  {t('directions')}
                </a>
              )}
              <LocationMap address={a} className="mt-4" />
            </div>
          )}

          {!!settings.hours?.length && (
            <div>
              <p className={h2}>{t('hours')}</p>
              <ul className="mt-2 grid gap-1 text-lg">
                {settings.hours.map((r) => (
                  <li key={r.id ?? `${r.days?.join()}${r.opens}`}>
                    {(r.days ?? []).map((d) => tDays(d)).join(', ')}: <bdi dir="ltr" className="tabular-nums">{r.opens}–{r.closes}</bdi>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section aria-labelledby="quote-form" className="lg:border-s lg:border-line lg:ps-16">
          <h2 id="quote-form" className="mb-6 font-[family-name:var(--font-display)] text-2xl font-semibold">{t('formTitle')}</h2>
          <ContactForm
            copy={copy}
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
