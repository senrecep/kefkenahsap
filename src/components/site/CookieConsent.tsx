'use client'

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'

import { buttonClass } from '@/components/ui/button'
import { consentCookie, gaCookieDeletions, readConsent, type Consent } from '@/lib/consent/consent'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

/** Fired by the footer "Çerez tercihleri" button to reopen the banner. */
export const OPEN_CONSENT_EVENT = 'kh:consent-open'

function loadGa(gaId: string, locale: string) {
  if (document.getElementById('ga4')) return
  // Before config, so the first page_view already carries the site language (GA4 custom dimension).
  window.gtag!('set', { page_locale: locale })
  const s = document.createElement('script')
  s.id = 'ga4'
  s.async = true
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`
  document.head.appendChild(s)
  window.gtag!('js', new Date())
  // No page_location override: it would freeze every later client-side page_view on this first URL. gtag.js leaves the
  // URL fragment out of `dl` by itself (#236 review: checked on the calculator, whose #c=… holds a customer name, for
  // the first page_view and the ones after its history updates).
  window.gtag!('config', gaId)
}

/**
 * Cookie banner + Google Consent Mode v2. Defaults (all denied) are set inline by <Analytics>;
 * GA4 itself loads only after "Kabul et". Rejecting never requests googletagmanager.com.
 */
const CHANGE_EVENT = 'kh:consent-change'
const subscribe = (cb: () => void) => {
  window.addEventListener(CHANGE_EVENT, cb)
  return () => window.removeEventListener(CHANGE_EVENT, cb)
}

type Props = { gaId: string; locale: string; text: ReactNode; labels: { label: string; reject: string; accept: string } }

// Copy is translated on the server (<Analytics>), so no i18n runtime ships to the client.
export function CookieConsent({ gaId, locale, text, labels }: Props) {
  // 'ssr' on the server and during hydration, so the banner never flashes for visitors who already chose.
  const stored = useSyncExternalStore(subscribe, () => readConsent(document.cookie), () => 'ssr' as const)
  const [reopened, setReopened] = useState(false)

  useEffect(() => {
    const reopen = () => setReopened(true)
    window.addEventListener(OPEN_CONSENT_EVENT, reopen)
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, reopen)
  }, [])

  useEffect(() => {
    if (stored !== 'granted') return
    window.gtag?.('consent', 'update', { analytics_storage: 'granted' })
    loadGa(gaId, locale)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- locale changes are handled by the effect below
  }, [stored, gaId])

  // Later page_views (history navigation, language switch) carry the current language too.
  useEffect(() => {
    window.gtag?.('set', { page_locale: locale })
  }, [locale])

  function choose(value: Consent) {
    const withdrawn = value === 'denied' && stored === 'granted'
    document.cookie = consentCookie(value, location.protocol === 'https:')
    if (withdrawn) {
      // Withdrawal must stop GA now: opt out, drop its cookies, reload so the loaded gtag.js is gone too.
      ;(window as unknown as Record<string, boolean>)[`ga-disable-${gaId}`] = true
      for (const c of gaCookieDeletions(document.cookie, location.hostname)) document.cookie = c
      location.reload()
      return
    }
    window.gtag?.('consent', 'update', { analytics_storage: value })
    setReopened(false)
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }

  const open = reopened || stored === null
  if (!open) return null
  return (
    <section
      aria-label={labels.label}
      className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-xl rounded-[var(--radius-control)] border border-line bg-paper p-4 shadow-[var(--shadow-float)] lg:inset-x-auto lg:end-6 lg:bottom-6 lg:w-[28rem]"
    >
      <p className="text-[0.98rem] leading-relaxed text-ink">
        {text}
      </p>
      {/* Equal prominence: same size and style for both choices. */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button type="button" onClick={() => choose('denied')} className={buttonClass.outline}>
          {labels.reject}
        </button>
        <button type="button" onClick={() => choose('granted')} className={buttonClass.outline}>
          {labels.accept}
        </button>
      </div>
    </section>
  )
}
