import { getTranslations } from 'next-intl/server'

import { Link } from '@/i18n/navigation'

import { CookieConsent } from './CookieConsent'

// Consent Mode v2 defaults: everything denied until the visitor accepts (GA4 is not even loaded before that).
const consentDefaults = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'});`

/** Umami (cookieless, always on when configured) + GA4 behind the cookie banner (when configured). */
export function Analytics({ locale }: { locale: string }) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID
  const umamiSrc = process.env.NEXT_PUBLIC_UMAMI_SRC
  const umamiId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID
  return (
    <>
      {umamiSrc && umamiId && <script defer src={umamiSrc} data-website-id={umamiId} data-domains="kefkenahsap.com,www.kefkenahsap.com" />}
      {gaId && (
        <>
          {/* Inline so it runs during parsing, before any client code can call gtag. */}
          <script id="consent-defaults" dangerouslySetInnerHTML={{ __html: consentDefaults }} />
          <ConsentBanner gaId={gaId} locale={locale} />
        </>
      )}
    </>
  )
}

/** Banner copy is translated here only when GA is configured (the banner exists only then). */
async function ConsentBanner({ gaId, locale }: { gaId: string; locale: string }) {
  const t = await getTranslations({ locale, namespace: 'Consent' })
  const text = t.rich('text', {
    link: (chunks) => (
      <Link href="/cerez-politikasi" className="font-semibold text-action underline underline-offset-2 hover:text-action-deep">
        {chunks}
      </Link>
    ),
  })
  return <CookieConsent gaId={gaId} locale={locale} text={text} labels={{ label: t('label'), reject: t('reject'), accept: t('accept') }} />
}
