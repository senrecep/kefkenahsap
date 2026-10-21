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

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

const FONT = "font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

/** Bulletproof button: the colour sits on the table cell, so Outlook (Word engine) renders it too. Secondary = outlined, so calling stays the obvious first action. */
const button = (href: string, label: string, secondary = false) =>
  `<tr><td style="padding:0 0 10px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
  (secondary
    ? `<td align="center" bgcolor="#ffffff" style="background-color:#ffffff;border:2px solid #0b7a3e;border-radius:6px">`
    : `<td align="center" bgcolor="#0b7a3e" style="background-color:#0b7a3e;border-radius:6px">`) +
  `<a href="${esc(href)}" style="display:block;padding:${secondary ? '12px' : '14px'} 20px;${FONT};font-size:16px;line-height:20px;font-weight:600;color:${secondary ? '#0b7a3e' : '#ffffff'};text-decoration:none">${esc(label)}</a>` +
  `</td></tr></table></td></tr>`

/** Pure renderer for the new-lead notification. Every lead value is untrusted and escaped. Phone is E.164 digits without "+". */
export function leadEmail(doc: LeadEmailDoc, siteUrl: string): { subject: string; html: string; text: string } {
  const phone = String(doc.phone ?? '').replace(/\D/g, '')
  const panel = `${siteUrl}/admin/collections/leads/${doc.id}`
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
    doc.email && button(`mailto:${doc.email}`, 'E-posta ile yanıtla', true),
    button(panel, 'Talebi panelde aç', true),
  ].filter(Boolean)

  const detail = lines
    .map(
      ([k, v, br]) =>
        `<tr><td valign="top" width="96" style="padding:10px 12px 10px 0;border-top:1px solid #e4e1da;${FONT};font-size:14px;line-height:20px;color:#5c5f58">${k}</td>` +
        `<td valign="top" style="padding:10px 0;border-top:1px solid #e4e1da;${FONT};font-size:15px;line-height:22px;color:#1d1f1c;word-break:break-word">${br ? esc(v).replace(/\r?\n/g, '<br>') : esc(v)}</td></tr>`,
    )
    .join('')

  const html =
    `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>` +
    `<body style="margin:0;padding:0;background-color:#fbfaf7">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fbfaf7" style="background-color:#fbfaf7"><tr><td align="center" style="padding:24px 12px">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="max-width:600px;background-color:#ffffff;border-radius:8px">` +
    `<tr><td style="padding:24px 24px 16px 24px;border-bottom:2px solid #39b54a"><img src="${esc(siteUrl)}/brand/logo.png" alt="Kefken Ahşap Dekorasyon" width="200" style="display:block;width:200px;max-width:100%;height:auto;border:0"></td></tr>` +
    `<tr><td style="padding:24px 24px 8px 24px;${FONT}">` +
    `<div style="font-size:22px;line-height:28px;font-weight:700;color:#1d1f1c">Yeni talep #${esc(doc.id)}</div>` +
    (doc.service ? `<div style="font-size:16px;line-height:24px;color:#5c5f58;padding-top:2px">${esc(doc.service)}</div>` : '') +
    `</td></tr>` +
    `<tr><td style="padding:16px 24px 8px 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${buttons.join('')}</table></td></tr>` +
    `<tr><td style="padding:8px 24px 24px 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${detail}</table></td></tr>` +
    `<tr><td style="padding:16px 24px;border-top:1px solid #e4e1da;${FONT};font-size:12px;line-height:18px;color:#5c5f58">Bu e-posta kefkenahsap.com iletişim formundan otomatik gönderildi.</td></tr>` +
    `</table></td></tr></table></body></html>`

  const text = [
    `Yeni talep #${doc.id}${doc.service ? ` — ${doc.service}` : ''}`,
    '',
    ...lines.map(([k, v]) => `${k}: ${v}`),
    '',
    phone && `Ara: tel:+${phone}`,
    phone && `WhatsApp: https://wa.me/${phone}`,
    doc.email && `E-posta ile yanıtla: mailto:${doc.email}`,
    `Talebi panelde aç: ${panel}`,
    '',
    'Bu e-posta kefkenahsap.com iletişim formundan otomatik gönderildi.',
  ]
    .filter((l) => typeof l === 'string')
    .join('\n')

  return { subject, html, text }
}
