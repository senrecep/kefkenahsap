// Draft privacy notice (KVKK aydınlatma metni) used until a published `pages` doc (slug kvkk/privacy) exists.
// Facts only from siteSettings and the actual form/infra (PLAN §10). Text lives in messages/<locale>/legal.json (#195).
import { getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'

import { Link } from '@/i18n/navigation'
import { gaIdOf } from '@/lib/analytics'
import { isMapEmbedUrl } from '@/lib/http/safe-href'

type Controller = { name: string; address?: string; email?: string | null }
/** What this deployment really loads: GA4 (siteSettings, else env), Umami (env), the click-to-load Google map (siteSettings). */
export type Uses = { ga: boolean; umami: boolean; map: boolean }
/** One answer for the KVKK notice and the cookie policy (#156): measurement is named in both, or in neither. */
export const legalUses = (settings: { gaId?: string | null; address?: { mapEmbedUrl?: string | null } | null }): Uses => ({
  ga: Boolean(gaIdOf(settings)),
  umami: Boolean(process.env.NEXT_PUBLIC_UMAMI_SRC && process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID),
  map: isMapEmbedUrl(settings.address?.mapEmbedUrl),
})

/** A section: `<id>.title`, then the `<id>.<key>` paragraphs in `p`, the list items in `list`, then `after`. */
export type Section = { id: string; p?: string[]; list?: string[]; after?: string[]; controller?: true }
export const on = (flag: boolean, ...keys: string[]) => (flag ? keys : [])

/** KVKK md. 10 notice. Items for GA, Umami and the map appear only when the site really uses them (#156). */
export const kvkkSections = (u: Uses): Section[] => [
  { id: 'controller', controller: true, after: ['contact'] },
  { id: 'data', list: ['form', 'meta', 'ip', 'visit', 'errors', ...on(u.umami, 'umami'), ...on(u.ga, 'ga'), 'cookies'], after: ['special'] },
  { id: 'method', p: ['text'] },
  { id: 'purposes', list: ['quote', 'security', 'records', ...on(u.ga, 'ga'), 'abroad'] },
  { id: 'recipients', p: ['intro'], list: ['cloudflare', 'resend', 'gmail', ...on(u.ga, 'ga'), ...on(u.map, 'map'), 'authorities'], after: ['hosting', 'ai'] },
  { id: 'abroad', p: ['text', 'basis'] },
  { id: 'retention', list: ['leads', 'backups', 'mail', ...on(u.ga, 'ga')] },
  { id: 'security', p: ['text'] },
  { id: 'rights', p: ['intro'], list: ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8'] },
  { id: 'apply', p: ['intro'], list: ['post', 'esign', 'email'], after: ['content', 'answer', 'complaint'] },
  { id: 'links', p: ['text'] },
  { id: 'changes', p: ['text'] },
]

// The e-mail is its own anchor: Cloudflare Email Obfuscation rewrites a bare address inside a text node, and its
// decoder leaves split text nodes that break hydration (#147). A mailto link survives untouched.
function ControllerLine({ c }: { c: Controller }) {
  return (
    <p>
      <strong>{c.name}</strong>
      {c.address && <> — {c.address}</>}
      {c.email && (
        <>
          {c.address ? ' · ' : ' — '}
          <a href={`mailto:${c.email}`}>{c.email}</a>
        </>
      )}
    </p>
  )
}

/** Renders `sections` from one messages namespace; shared by the KVKK notice and the cookie policy. */
export async function LegalText({ locale, namespace, sections, c }: { locale: string; namespace: 'KvkkText' | 'CookiesText'; sections: Section[]; c: Controller }) {
  const t = await getTranslations({ locale, namespace })
  const tags = {
    name: c.name,
    b: (chunks: ReactNode) => <strong>{chunks}</strong>,
    kvkk: (chunks: ReactNode) => <Link href="/kvkk">{chunks}</Link>,
    cookies: (chunks: ReactNode) => <Link href="/cerez-politikasi">{chunks}</Link>,
    mail: (chunks: ReactNode) => (c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : chunks),
  }
  const paragraphs = (id: string, keys: string[] = []) => keys.map((k) => <p key={k}>{t.rich(`${id}.${k}`, tags)}</p>)
  return (
    <>
      <p>{t.rich('intro', tags)}</p>
      {sections.map((s) => (
        <section key={s.id}>
          <h2>{t(`${s.id}.title`)}</h2>
          {s.controller && <ControllerLine c={c} />}
          {paragraphs(s.id, s.p)}
          {s.list && (
            <ul>
              {s.list.map((k) => (
                <li key={k}>{t.rich(`${s.id}.${k}`, tags)}</li>
              ))}
            </ul>
          )}
          {paragraphs(s.id, s.after)}
        </section>
      ))}
    </>
  )
}

export function KvkkDraft({ locale, c, uses }: { locale: string; c: Controller; uses: Uses }) {
  return <LegalText locale={locale} namespace="KvkkText" sections={kvkkSections(uses)} c={c} />
}
