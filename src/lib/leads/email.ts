import { FONT, button, emailShell, esc } from '@/lib/email/layout'

export type LeadEmailDoc = {
  id: number | string
  name?: string | null
  phone?: string | null
  email?: string | null
  service?: string | null
  city?: string | null
  district?: string | null
  message?: string | null
  sourcePage?: string | null
  locale?: string | null
  photos?: unknown[] | null
}

/** Pure renderer for the new-lead notification. Every lead value is untrusted and escaped. Phone is E.164 digits without "+". */
export function leadEmail(doc: LeadEmailDoc, siteUrl: string): { subject: string; html: string; text: string } {
  const phone = String(doc.phone ?? '').replace(/\D/g, '')
  const panel = `${siteUrl}/admin/collections/leads/${doc.id}`
  // #254: a branded reply written in the admin (prefilled from this lead), not the mail app.
  const reply = `${siteUrl}/admin/collections/outgoing-emails/create?lead=${doc.id}`
  const place = [doc.district, doc.city].filter(Boolean).join(', ')
  const rows: [string, string, string?][] = [
    ['Ad', String(doc.name ?? '')],
    ['Telefon', phone ? `+${phone}` : ''],
    ['E-posta', String(doc.email ?? '')],
    ['Hizmet', String(doc.service ?? '')],
    ['Konum', place],
    ['Mesaj', String(doc.message ?? ''), 'br'],
    ['Sayfa', String(doc.sourcePage ?? '')],
    ['Dil', String(doc.locale ?? '')],
    ['Fotoğraf', doc.photos?.length ? `${doc.photos.length} adet (panelde)` : ''],
  ]
  const lines = rows.filter(([, v]) => v)

  const subject = `Yeni talep #${doc.id}${doc.service ? ` — ${doc.service}` : ''}`

  const buttons = [
    phone && button(`tel:+${phone}`, 'Ara'),
    phone && button(`https://wa.me/${phone}`, 'WhatsApp'),
    doc.email && button(reply, 'E-posta ile yanıtla', true),
    button(panel, 'Talebi panelde aç', true),
  ].filter(Boolean)

  const detail = lines
    .map(
      ([k, v, br]) =>
        `<tr><td valign="top" width="96" style="padding:10px 12px 10px 0;border-top:1px solid #e4e1da;${FONT};font-size:14px;line-height:20px;color:#5c5f58">${k}</td>` +
        `<td valign="top" style="padding:10px 0;border-top:1px solid #e4e1da;${FONT};font-size:15px;line-height:22px;color:#1d1f1c;word-break:break-word">${br ? esc(v).replace(/\r?\n/g, '<br>') : esc(v)}</td></tr>`,
    )
    .join('')

  const html = emailShell({
    title: subject,
    siteUrl,
    rows:
      `<tr><td style="padding:24px 24px 8px 24px;${FONT}">` +
      `<div style="font-size:22px;line-height:28px;font-weight:700;color:#1d1f1c">Yeni talep #${esc(doc.id)}</div>` +
      (doc.service ? `<div style="font-size:16px;line-height:24px;color:#5c5f58;padding-top:2px">${esc(doc.service)}</div>` : '') +
      `</td></tr>` +
      `<tr><td style="padding:16px 24px 8px 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${buttons.join('')}</table></td></tr>` +
      `<tr><td style="padding:8px 24px 24px 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${detail}</table></td></tr>`,
    footer: 'Bu e-posta kefkenahsap.com iletişim formundan otomatik gönderildi.',
  })

  const text = [
    `Yeni talep #${doc.id}${doc.service ? ` — ${doc.service}` : ''}`,
    '',
    ...lines.map(([k, v]) => `${k}: ${v}`),
    '',
    phone && `Ara: tel:+${phone}`,
    phone && `WhatsApp: https://wa.me/${phone}`,
    doc.email && `E-posta ile yanıtla: ${reply}`,
    `Talebi panelde aç: ${panel}`,
    '',
    'Bu e-posta kefkenahsap.com iletişim formundan otomatik gönderildi.',
  ]
    .filter((l) => typeof l === 'string')
    .join('\n')

  return { subject, html, text }
}
