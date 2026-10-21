import type { SerializedEditorState, SerializedLexicalNode } from '@payloadcms/richtext-lexical/lexical'
import { LinebreakHTMLConverter, TextHTMLConverter, convertLexicalToHTML, type HTMLConverters } from '@payloadcms/richtext-lexical/html'
import { convertLexicalToPlaintext, type PlaintextConverters } from '@payloadcms/richtext-lexical/plaintext'

import { normalizeTrPhone, whatsappUrl } from '@/lib/whatsapp'

import { FONT, emailShell, esc } from './layout'

/** From Site Bilgileri; an empty field is left out of the signature. */
export type Signature = {
  name?: string | null
  company?: string | null
  phones?: { number?: string | null; whatsapp?: boolean | null }[] | null
  email?: string | null
}

const INK = '#1d1f1c'
const MUTED = '#5c5f58'
const GREEN = '#0b7a3e'

/** Only these schemes become links; anything else (javascript:, data:, relative, internal) keeps just its text. */
export const safeHref = (url: unknown): string | undefined => {
  const u = typeof url === 'string' ? url.trim() : ''
  return /^(https?:\/\/|mailto:|tel:)/i.test(u) ? u : undefined
}

// One converter for both `link` and `autolink` nodes.
type LinkLike = { children: SerializedLexicalNode[]; fields?: { url?: string | null; linkType?: string | null } }
type Render = (args: { nodes: SerializedLexicalNode[] }) => string[]
const linkHref = (node: LinkLike) => (node.fields?.linkType === 'internal' ? undefined : safeHref(node.fields?.url))

const htmlLink = ({ node, nodesToHTML }: { node: LinkLike; nodesToHTML: Render }) => {
  const children = nodesToHTML({ nodes: node.children }).join('')
  const href = linkHref(node)
  return href ? `<a href="${esc(href)}" style="color:${GREEN};text-decoration:underline">${children}</a>` : children
}

// Built from scratch, not on top of Payload's defaults: those emit classes, which mail clients ignore.
const HTML: HTMLConverters = {
  ...TextHTMLConverter,
  ...LinebreakHTMLConverter,
  paragraph: ({ node, nodesToHTML }) => `<p style="margin:0 0 16px 0">${nodesToHTML({ nodes: node.children }).join('') || '<br>'}</p>`,
  heading: ({ node, nodesToHTML }) => {
    const [tag, size] = node.tag === 'h2' ? ['h2', 'font-size:20px;line-height:26px'] : ['h3', 'font-size:17px;line-height:24px']
    return `<${tag} style="margin:24px 0 8px 0;${size};font-weight:700;color:${INK}">${nodesToHTML({ nodes: node.children }).join('')}</${tag}>`
  },
  list: ({ node, nodesToHTML }) => {
    const tag = node.tag === 'ol' ? 'ol' : 'ul'
    return `<${tag} style="margin:0 0 16px 0;padding:0 0 0 24px">${nodesToHTML({ nodes: node.children }).join('')}</${tag}>`
  },
  listitem: ({ node, nodesToHTML }) => `<li style="margin:0 0 4px 0">${nodesToHTML({ nodes: node.children }).join('')}</li>`,
  link: htmlLink,
  autolink: htmlLink,
  unknown: () => '',
}

const plainLink = ({ node, nodesToPlaintext }: { node: LinkLike; nodesToPlaintext: Render }) => {
  const label = nodesToPlaintext({ nodes: node.children }).join('')
  const href = linkHref(node)
  return href && href !== label ? `${label} (${href})` : label
}
const PLAIN: PlaintextConverters = { link: plainLink, autolink: plainLink }

const host = (siteUrl: string) => (URL.canParse(siteUrl) ? new URL(siteUrl).host : '')

/** `"Name" <addr>`; quotes, angle brackets, separators and line breaks are removed from the name. */
export function recipient(to: string, name?: string | null): string {
  const clean = String(name ?? '')
    .replace(/["<>,;\\\r\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return clean ? `"${clean}" <${to}>` : to
}

type PhoneLine = { number: string; tel?: string; wa?: string }
const phoneLines = (s: Signature): PhoneLine[] =>
  (s.phones ?? []).flatMap((p) => {
    const number = p.number?.trim()
    if (!number) return []
    const digits = normalizeTrPhone(number)
    const wa = p.whatsapp ? whatsappUrl({ phone: number }) : undefined
    return [{ number, tel: digits.ok ? `tel:+${digits.value}` : undefined, wa: wa?.ok ? wa.value : undefined }]
  })

/** Admin-written e-mail (#254): the Lexical body (Payload's converter, typed text escaped) + the owner's signature, in the site's shell. */
export function outgoingEmail({
  subject,
  body,
  signature,
  siteUrl,
}: {
  subject: string
  body: SerializedEditorState | null | undefined
  signature: Signature
  siteUrl: string
}): { html: string; text: string } {
  const content = body ? convertLexicalToHTML({ data: body, converters: HTML, disableContainer: true }) : ''
  const phones = phoneLines(signature)
  const site = host(siteUrl)
  const a = (href: string, label: string, color = INK) => `<a href="${esc(href)}" style="color:${color};text-decoration:none">${esc(label)}</a>`
  const sig = [
    signature.name && `<div style="font-weight:700;color:${INK}">${esc(signature.name)}</div>`,
    signature.company && `<div>${esc(signature.company)}</div>`,
    ...phones.map((p) => `<div>${p.tel ? a(p.tel, p.number) : esc(p.number)}${p.wa ? ` · ${a(p.wa, 'WhatsApp', GREEN)}` : ''}</div>`),
    site && `<div>${a(siteUrl.replace(/\/$/, ''), site, GREEN)}</div>`,
    signature.email && `<div>${a(`mailto:${signature.email}`, signature.email, GREEN)}</div>`,
  ].filter(Boolean)

  const html = emailShell({
    title: subject,
    siteUrl,
    rows:
      `<tr><td style="padding:24px 24px 8px 24px;${FONT};font-size:16px;line-height:24px;color:${INK}">${content}</td></tr>` +
      (sig.length ? `<tr><td style="padding:16px 24px 24px 24px;border-top:1px solid #e4e1da;${FONT};font-size:14px;line-height:22px;color:${MUTED}">${sig.join('')}</td></tr>` : ''),
  })

  const text = [
    body ? convertLexicalToPlaintext({ data: body, converters: PLAIN }).trim() : '',
    '',
    '--',
    signature.name,
    signature.company,
    ...phones.map((p) => `${p.number}${p.wa ? ` · WhatsApp: ${p.wa}` : ''}`),
    site,
    signature.email,
  ]
    .filter((l) => typeof l === 'string' && (l === '' || l.trim()))
    .join('\n')

  return { html, text }
}

/**
 * Owner decision (#254 review): admins may write to any address; other staff only reply to a lead, at the address that
 * lead left. Returns the Turkish refusal, or undefined when sending is allowed.
 */
export function sendDenied({ role, to, leadEmail }: { role?: string; to: string; leadEmail?: string | null }): string | undefined {
  if (role === 'admin') return undefined
  if (!role) return 'Bu işlem için yetkiniz yok.'
  const lead = leadEmail?.trim().toLowerCase()
  return lead && lead === to.trim().toLowerCase()
    ? undefined
    : 'Yalnızca bağlı talebin e-posta adresine gönderebilirsiniz. Başka adrese göndermek için yöneticiye başvurun.'
}
