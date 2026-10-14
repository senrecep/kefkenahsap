'use client'

import { OPEN_CONSENT_EVENT } from './CookieConsent'

/** Footer link-styled button that reopens the cookie banner. */
export function CookiePreferencesButton({ label, className }: { label: string; className?: string }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))} className={className}>
      {label}
    </button>
  )
}
