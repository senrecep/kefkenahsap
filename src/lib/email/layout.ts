/** Shared shell of the site's e-mails: inline-styled table layout (Outlook/Gmail ignore classes and <style>). */

export const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

export const FONT = "font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

/** Bulletproof button: the colour sits on the table cell, so Outlook (Word engine) renders it too. Secondary = outlined, so calling stays the obvious first action. */
export const button = (href: string, label: string, secondary = false) =>
  `<tr><td style="padding:0 0 10px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
  (secondary
    ? `<td align="center" bgcolor="#ffffff" style="background-color:#ffffff;border:2px solid #0b7a3e;border-radius:6px">`
    : `<td align="center" bgcolor="#0b7a3e" style="background-color:#0b7a3e;border-radius:6px">`) +
  `<a href="${esc(href)}" style="display:block;padding:${secondary ? '12px' : '14px'} 20px;${FONT};font-size:16px;line-height:20px;font-weight:600;color:${secondary ? '#0b7a3e' : '#ffffff'};text-decoration:none">${esc(label)}</a>` +
  `</td></tr></table></td></tr>`

/** Page, card, logo + green rule, then `rows` (trusted `<tr>` markup) and an optional small footer line (plain text, escaped). */
export function emailShell({ title, siteUrl, rows, footer }: { title: string; siteUrl: string; rows: string; footer?: string }): string {
  return (
    `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>` +
    `<body style="margin:0;padding:0;background-color:#fbfaf7">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fbfaf7" style="background-color:#fbfaf7"><tr><td align="center" style="padding:24px 12px">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="max-width:600px;background-color:#ffffff;border-radius:8px">` +
    `<tr><td style="padding:24px 24px 16px 24px;border-bottom:2px solid #39b54a"><img src="${esc(siteUrl)}/brand/logo.png" alt="Kefken Ahşap Dekorasyon" width="200" style="display:block;width:200px;max-width:100%;height:auto;border:0"></td></tr>` +
    rows +
    (footer ? `<tr><td style="padding:16px 24px;border-top:1px solid #e4e1da;${FONT};font-size:12px;line-height:18px;color:#5c5f58">${esc(footer)}</td></tr>` : '') +
    `</table></td></tr></table></body></html>`
  )
}
