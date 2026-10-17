// Draft cookie policy used until a published `pages` doc (slug cerez-politikasi/cookies) exists. Lists what the site really sets:
// GA4, the consent cookie and the footer "Çerez tercihleri" link exist only when a GA4 id is set (siteSettings.gaId, else NEXT_PUBLIC_GA_ID: gaIdOf in src/lib/analytics.ts).
// Text lives in messages/<locale>/legal.json (#195).
import { LegalText, on, type Section, type Uses } from './kvkk'

export const cookiesSections = (u: Uses): Section[] => [
  { id: 'necessary', p: ['intro'], list: ['locale', ...on(u.ga, 'consent'), 'cloudflare', 'turnstile', 'admin'] },
  u.ga ? { id: 'analytics', p: ['intro'], list: ['ga'], after: ['optIn', 'withdraw'] } : { id: 'noAnalytics', p: ['text'] },
  ...(u.umami ? [{ id: 'umami', p: ['text'] }] : []),
  ...(u.map ? [{ id: 'map', p: ['text'] }] : []),
  { id: 'links', p: ['text'] },
  { id: 'choice', p: [...on(u.ga, 'footer'), 'browser', 'more'] },
]

export function CookiesDraft({ locale, name, uses }: { locale: string; name: string; uses: Uses }) {
  return <LegalText locale={locale} namespace="CookiesText" sections={cookiesSections(uses)} c={{ name }} />
}
