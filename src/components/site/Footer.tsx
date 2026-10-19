import { getTranslations } from 'next-intl/server'
import { Maybe } from 'tsentials/maybe'

import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { gaIdOf } from '@/lib/analytics'
import { sinceYear } from '@/lib/company'
import { telLink, waLink } from '@/lib/contact'
import { getRegions } from '@/lib/data/regions'
import { getNavCategories, getSiteSettings } from '@/lib/data/site'

import { CookiePreferencesButton } from './CookiePreferencesButton'
import { GoogleReviewLink } from './GoogleReviewLink'

export async function Footer({ locale }: { locale: Locale }) {
  const [t, tNav, tDays, tConsent, tRegions, tCalc, settings, categories, regions] = await Promise.all([
    getTranslations('Footer'),
    getTranslations('Nav'),
    getTranslations('Days'),
    getTranslations('Consent'),
    getTranslations('Regions'),
    getTranslations('Calculator'),
    getSiteSettings(locale),
    getNavCategories(locale).then((cs) => cs.filter((c) => c.slug)),
    // Only regions that pass the publish gate are linked; the rest stay unlisted (noindex).
    getRegions(locale).then((rs) => rs.filter((r) => r.indexable)),
  ])
  const tel = telLink(settings)
  const wa = waLink(settings)
  const a = settings.address
  const since = sinceYear({ foundingYear: settings.foundingYear })
  const h = 'mb-3 font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wide text-paper/70'
  return (
    <footer className="mt-24 [main:has(>[data-end-band]:last-child)~&]:mt-0 bg-ink pb-28 text-paper lg:pb-10">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-2 md:px-6 lg:grid-cols-4">
        <div>
          <p className="font-[family-name:var(--font-display)] text-lg font-semibold">{settings.companyName}</p>
          {Maybe.isSome(since) && <p className="mt-1 text-paper/75">{t('since', { year: since.value })}</p>}
          {settings.founder?.name && <p className="mt-4 text-paper/85">{t('founder', { name: settings.founder.name })}</p>}
          <Link href="/hakkimizda" className="mt-4 inline-block text-paper/90 hover:underline">{tNav('about')}</Link>
          <Link href="/malzeme-hesaplayici" className="mt-2 block w-fit text-paper/90 hover:underline">{tCalc('title')}</Link>
        </div>
        <div>
          <p className={h}>{t('contact')}</p>
          <address className="grid gap-2 not-italic text-paper/90">
            {a?.street && (
              // Each line is a Turkish address; bdi keeps "34287 Arnavutköy İstanbul" in order inside RTL pages.
              <span>
                <bdi dir="ltr">{a.street}</bdi>
                {a.district || a.city ? <><br /><bdi dir="ltr">{[a.postalCode, a.district, a.city].filter(Boolean).join(' ')}</bdi></> : null}
              </span>
            )}
            {settings.phones?.map((p) => (
              <a key={p.number} href={telLink({ phones: [p] })?.href} className="hover:underline">
                {p.label ? `${p.label}: ` : ''}
                <bdi dir="ltr" className="whitespace-nowrap">{p.number}</bdi>
              </a>
            ))}
            {settings.email && (
              <a href={`mailto:${settings.email}`} className="hover:underline">
                {settings.email}
              </a>
            )}
            {wa && (
              <a href={wa} target="_blank" rel="noopener" data-umami-event="whatsapp_click" data-umami-event-place="footer" className="hover:underline">
                WhatsApp
              </a>
            )}
          </address>
          {!!settings.hours?.length && (
            <>
              <p className={`${h} mt-6`}>{t('hours')}</p>
              <ul className="grid gap-1 text-paper/90">
                {settings.hours.map((r) => (
                  <li key={r.id ?? `${r.days?.join()}${r.opens}`}>
                    {(r.days ?? []).map((d) => tDays(d)).join(', ')}: <bdi dir="ltr">{r.opens}–{r.closes}</bdi>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div>
          <p className={h}>{t('services')}</p>
          <ul className="grid gap-1.5">
            {categories.map((c) => (
              <li key={c.id}>
                <Link href={{ pathname: '/[category]', params: { category: c.slug! } }} className="text-paper/90 hover:underline">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
          {regions.length > 0 && (
            <>
              <p className={`${h} mt-6`}>{tRegions('title')}</p>
              <ul className="grid gap-1.5">
                {regions.map((r) => (
                  <li key={r.id}>
                    <Link href={{ pathname: '/bolgeler/[slug]', params: { slug: r.slug } }} className="text-paper/90 hover:underline">
                      {r.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div>
          <p className={h}>{t('legal')}</p>
          <ul className="grid gap-1.5">
            <li><Link href="/kvkk" className="text-paper/90 hover:underline">{t('privacy')}</Link></li>
            <li><Link href="/cerez-politikasi" className="text-paper/90 hover:underline">{t('cookies')}</Link></li>
            {gaIdOf(settings) && (
              <li><CookiePreferencesButton label={tConsent('preferences')} className="text-start text-paper/90 hover:underline" /></li>
            )}
          </ul>
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
            {settings.social?.instagram && <a href={settings.social.instagram} rel="noopener me" target="_blank" className="text-paper/90 hover:underline">Instagram</a>}
            {settings.social?.facebook && <a href={settings.social.facebook} rel="noopener me" target="_blank" className="text-paper/90 hover:underline">Facebook</a>}
            <GoogleReviewLink href={settings.social?.googleReview} place="footer" className="inline-flex items-center gap-1.5 text-paper/90 hover:underline">
              {t('googleReview')}
            </GoogleReviewLink>
          </div>
          {tel && <a href={tel.href} className="mt-6 inline-block font-[family-name:var(--font-display)] text-xl font-semibold"><bdi dir="ltr" className="whitespace-nowrap">{tel.label}</bdi></a>}
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <p className="border-t border-paper/15 pt-6 text-sm text-paper/60">
          © {settings.companyName}. {t('rights')}
        </p>
      </div>
    </footer>
  )
}
