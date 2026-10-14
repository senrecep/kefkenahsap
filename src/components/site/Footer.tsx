import { getTranslations } from 'next-intl/server'
import { Maybe } from 'tsentials/maybe'

import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { sinceYear } from '@/lib/company'
import { telLink, waLink } from '@/lib/contact'
import { getNavCategories, getSiteSettings } from '@/lib/data/site'

import { CookiePreferencesButton } from './CookiePreferencesButton'

export async function Footer({ locale }: { locale: Locale }) {
  const [t, tNav, tDays, tConsent, settings, categories] = await Promise.all([
    getTranslations('Footer'),
    getTranslations('Nav'),
    getTranslations('Days'),
    getTranslations('Consent'),
    getSiteSettings(locale),
    getNavCategories(locale).then((cs) => cs.filter((c) => c.slug)),
  ])
  const tel = telLink(settings)
  const wa = waLink(settings)
  const a = settings.address
  const since = sinceYear({ foundingYear: settings.foundingYear })
  const h = 'mb-3 font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-wide text-paper/70'
  return (
    <footer className="mt-24 bg-ink pb-28 text-paper lg:pb-10">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-2 md:px-6 lg:grid-cols-4">
        <div>
          <p className="font-[family-name:var(--font-display)] text-lg font-semibold">{settings.companyName}</p>
          {Maybe.isSome(since) && <p className="mt-1 text-paper/75">{t('since', { year: since.value })}</p>}
          {settings.founder?.name && <p className="mt-4 text-paper/85">{settings.founder.name}</p>}
        </div>
        <div>
          <p className={h}>{t('contact')}</p>
          <address className="grid gap-2 not-italic text-paper/90">
            {a?.street && (
              <span>
                {a.street}
                {a.district || a.city ? <><br />{[a.postalCode, a.district, a.city].filter(Boolean).join(' ')}</> : null}
              </span>
            )}
            {settings.phones?.map((p) => (
              <a key={p.number} href={telLink({ phones: [p] })?.href} className="hover:underline">
                {p.label ? `${p.label}: ` : ''}
                {p.number}
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
                    {(r.days ?? []).map((d) => tDays(d)).join(', ')}: {r.opens}–{r.closes}
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
        </div>
        <div>
          <p className={h}>{t('legal')}</p>
          <ul className="grid gap-1.5">
            <li><Link href="/hakkimizda" className="text-paper/90 hover:underline">{tNav('about')}</Link></li>
            <li><Link href="/kvkk" className="text-paper/90 hover:underline">{t('privacy')}</Link></li>
            <li><Link href="/cerez-politikasi" className="text-paper/90 hover:underline">{t('cookies')}</Link></li>
            {process.env.NEXT_PUBLIC_GA_ID && (
              <li><CookiePreferencesButton label={tConsent('preferences')} className="text-start text-paper/90 hover:underline" /></li>
            )}
          </ul>
          <div className="mt-6 flex gap-3">
            {settings.social?.instagram && <a href={settings.social.instagram} rel="noopener me" target="_blank" className="text-paper/90 hover:underline">Instagram</a>}
            {settings.social?.facebook && <a href={settings.social.facebook} rel="noopener me" target="_blank" className="text-paper/90 hover:underline">Facebook</a>}
          </div>
          {tel && <a href={tel.href} className="mt-6 inline-block font-[family-name:var(--font-display)] text-xl font-semibold">{tel.label}</a>}
        </div>
      </div>
      <p className="mx-auto max-w-7xl border-t border-paper/15 px-4 pt-6 text-sm text-paper/60 md:px-6">
        © {settings.companyName}. {t('rights')}
      </p>
    </footer>
  )
}
