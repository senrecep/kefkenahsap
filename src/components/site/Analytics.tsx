import Script from 'next/script'

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
      {umamiSrc && umamiId && <Script src={umamiSrc} data-website-id={umamiId} data-domains="kefkenahsap.com,www.kefkenahsap.com" strategy="afterInteractive" />}
      {gaId && (
        <>
          {/* Inline so it runs during parsing, before any client code can call gtag. */}
          <script id="consent-defaults" dangerouslySetInnerHTML={{ __html: consentDefaults }} />
          <CookieConsent gaId={gaId} locale={locale} />
        </>
      )}
    </>
  )
}
