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

/** Cookie strings that expire Google Analytics cookies (`_ga`, `_ga_<id>`) on withdrawal; GA sets them on the apex domain. */
export function gaCookieDeletions(cookies: string, hostname: string): string[] {
  const apex = hostname.includes('.') ? hostname.split('.').slice(-2).join('.') : null
  return cookies
    .split(';')
    .map((p) => p.trim().split('=')[0]!)
    .filter((n) => n === '_ga' || n.startsWith('_ga_'))
    .flatMap((n) => [`${n}=; Max-Age=0; Path=/`, ...(apex ? [`${n}=; Max-Age=0; Path=/; Domain=${apex}`] : [])])
}
