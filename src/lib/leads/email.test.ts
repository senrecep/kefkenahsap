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

  it('shows the mailto button only when an email is given', () => {
    expect(leadEmail(base, site).html).not.toContain('mailto:')
    const { html } = leadEmail({ ...base, email: 'a@b.co' }, site)
    expect(html).toContain('href="mailto:a@b.co"')
    expect(html).toContain('E-posta ile yanıtla')
  })

  it('includes the panel link and the logo', () => {
    const { html, text } = leadEmail(base, site)
    expect(html).toContain('href="https://kefkenahsap.com/admin/collections/leads/42"')
    expect(html).toContain('src="https://kefkenahsap.com/brand/logo.png"')
    expect(html).toContain('alt="Kefken Ahşap Dekorasyon"')
    expect(text).toContain('https://kefkenahsap.com/admin/collections/leads/42')
  })
})
