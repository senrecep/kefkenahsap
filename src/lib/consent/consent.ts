export type Consent = 'granted' | 'denied'
export const CONSENT_COOKIE = 'kh_consent'
const SIX_MONTHS = 60 * 60 * 24 * 180

/** The visitor's analytics choice from `document.cookie`; null = not asked yet. */
export function readConsent(cookies: string): Consent | null {
  for (const part of cookies.split(';')) {
    const [k, v] = part.trim().split('=')
    if (k === CONSENT_COOKIE && (v === 'granted' || v === 'denied')) return v
  }
  return null
}

export const consentCookie = (value: Consent, secure: boolean) =>
  `${CONSENT_COOKIE}=${value}; Max-Age=${SIX_MONTHS}; Path=/; SameSite=Lax${secure ? '; Secure' : ''}`
