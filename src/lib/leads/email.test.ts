import { describe, expect, it } from 'vitest'

import { leadEmail } from './email'

const site = 'https://kefkenahsap.com'
const base = { id: 42, name: 'Ayşe Yılmaz', phone: '905321112233', service: 'Deck' }

describe('leadEmail', () => {
  it('formats the subject as "Yeni talep #id — service"', () => {
    expect(leadEmail(base, site).subject).toBe('Yeni talep #42 — Deck')
    expect(leadEmail({ ...base, service: '' }, site).subject).toBe('Yeni talep #42')
  })

  it('escapes HTML in every user value', () => {
    const { html } = leadEmail({ ...base, name: '<script>alert(1)</script>', message: '<b>x</b>\n"q"', service: '<i>s</i>', sourcePage: '/a?b=1&c="2"' }, site)
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<b>x</b>')
    expect(html).not.toContain('<i>s</i>')
    expect(html).toContain('&#60;script&#62;')
    expect(html).toContain('&#60;b&#62;x&#60;/b&#62;<br>')
    expect(html).toContain('&#38;c=&#34;2&#34;')
  })

  it('builds tel and wa.me links from the E.164 digits', () => {
    const { html, text } = leadEmail({ ...base, phone: '491701234567' }, site)
    expect(html).toContain('href="tel:+491701234567"')
    expect(html).toContain('href="https://wa.me/491701234567"')
    expect(text).toContain('+491701234567')
  })

  it('omits empty rows', () => {
    const { html, text } = leadEmail(base, site)
    for (const label of ['E-posta', 'Konum', 'Mesaj', 'Sayfa', 'Dil', 'Fotoğraf']) {
      expect(html).not.toContain(`>${label}<`)
      expect(text).not.toContain(`${label}:`)
    }
    expect(html).toContain('>Ad<')
    expect(html).toContain('>Hizmet<')
  })

  it('shows the filled optional rows', () => {
    const { html } = leadEmail({ ...base, district: 'Kadıköy', city: 'İstanbul', locale: 'de', photos: [1, 2] }, site)
    expect(html).toContain('Kadıköy, İstanbul')
    expect(html).toContain('>de<')
    expect(html).toContain('2 adet (panelde)')
  })

  it('the reply button opens a prefilled admin e-mail (#254), only when an email is given', () => {
    expect(leadEmail(base, site).html).not.toContain('E-posta ile yanıtla')
    const { html, text } = leadEmail({ ...base, email: 'a@b.co' }, site)
    expect(html).toContain('href="https://kefkenahsap.com/admin/collections/outgoing-emails/create?lead=42"')
    expect(html).toContain('E-posta ile yanıtla')
    expect(html).not.toContain('mailto:')
    expect(text).toContain('E-posta ile yanıtla: https://kefkenahsap.com/admin/collections/outgoing-emails/create?lead=42')
  })

  it('includes the panel link and the logo', () => {
    const { html, text } = leadEmail(base, site)
    expect(html).toContain('href="https://kefkenahsap.com/admin/collections/leads/42"')
    expect(html).toContain('src="https://kefkenahsap.com/brand/logo.png"')
    expect(html).toContain('alt="Kefken Ahşap Dekorasyon"')
    expect(text).toContain('https://kefkenahsap.com/admin/collections/leads/42')
  })
})
