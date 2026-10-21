import { describe, expect, it } from 'vitest'

import { outgoingEmail, recipient, sendDenied, type Signature } from './outgoing'

const site = 'https://www.kefkenahsap.com'
const text = (t: string, format = 0) => ({ type: 'text', text: t, format, detail: 0, mode: 'normal', style: '', version: 1 })
const block = (type: string, children: unknown[], extra: object = {}) => ({ type, children, direction: null, format: '', indent: 0, version: 1, ...extra })
const link = (url: string, label: string, extra: object = {}) => block('link', [text(label)], { fields: { url, linkType: 'custom', newTab: false, ...extra } })
const doc = (...children: unknown[]) => ({ root: block('root', children) }) as never

const owner: Signature = {
  name: 'Murat Şen',
  company: 'Kefken Ahşap Dekorasyon',
  phones: [
    { number: '0532 295 84 16', whatsapp: true },
    { number: '0212 322 43 59', whatsapp: false },
  ],
  email: 'info@kefkenahsap.com',
}
const render = (body: unknown, signature: Signature = owner, subject = 'Talebiniz hakkında — Deck') =>
  outgoingEmail({ subject, body: body as never, signature, siteUrl: site })

describe('outgoingEmail', () => {
  it('wraps the body in the branded shell', () => {
    const { html } = render(doc(block('paragraph', [text('Merhaba, teklifimiz ektedir.')])))
    expect(html).toContain('src="https://www.kefkenahsap.com/brand/logo.png"')
    expect(html).toContain('border-bottom:2px solid #39b54a')
    expect(html).toContain('<title>Talebiniz hakkında — Deck</title>')
    expect(html).toMatch(/<p style="[^"]+">Merhaba, teklifimiz ektedir\.<\/p>/)
  })

  it('renders headings, lists and bold/italic/underline with inline styles', () => {
    const { html } = render(
      doc(
        block('heading', [text('Ölçüler')], { tag: 'h2' }),
        block('heading', [text('Malzeme')], { tag: 'h3' }),
        block('list', [block('listitem', [text('Iroko')], { value: 1 }), block('listitem', [text('Teak')], { value: 2 })], { listType: 'number', tag: 'ol', start: 1 }),
        block('list', [block('listitem', [text('Deck')], { value: 1 })], { listType: 'bullet', tag: 'ul', start: 1 }),
        block('paragraph', [text('kalın', 1), text(' '), text('eğik', 2), text(' '), text('altı çizili', 8)]),
      ),
    )
    expect(html).toMatch(/<h2 style="[^"]+">Ölçüler<\/h2>/)
    expect(html).toMatch(/<h3 style="[^"]+">Malzeme<\/h3>/)
    expect(html).toMatch(/<ol style="[^"]+"><li style="[^"]+">Iroko<\/li><li style="[^"]+">Teak<\/li><\/ol>/)
    expect(html).toMatch(/<ul style="[^"]+"><li style="[^"]+">Deck<\/li><\/ul>/)
    expect(html).toContain('<strong>kalın</strong>')
    expect(html).toContain('<em>eğik</em>')
    expect(html).toContain('<span style="text-decoration: underline;">altı çizili</span>')
    expect(html).not.toContain('class=')
  })

  it('escapes typed text and the subject', () => {
    const { html, text: plain } = render(doc(block('paragraph', [text('<script>alert(1)</script> & "q"')])), owner, '<b>Fiyat</b>')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;q&quot;')
    expect(html).toContain('<title>&#60;b&#62;Fiyat&#60;/b&#62;</title>')
    expect(plain).toContain('<script>alert(1)</script> & "q"') // the plain-text part is not HTML
  })

  it('keeps only http, https, mailto and tel links', () => {
    const { html } = render(
      doc(
        block('paragraph', [
          link('https://www.kefkenahsap.com/tr/deck', 'deck'),
          link('http://example.com', 'eski'),
          link('mailto:info@kefkenahsap.com', 'yazın'),
          link('tel:+905322958416', 'arayın'),
          link('javascript:alert(1)', 'tıkla'),
          link(' JaVaScRiPt:alert(1)', 'tıkla2'),
          link('data:text/html,<script>alert(1)</script>', 'veri'),
          link('/tr/iletisim', 'göreli'),
          block('autolink', [text('evil')], { fields: { url: 'javascript:alert(2)', linkType: 'custom' } }),
          link('https://x.co/?a="><script>', 'tırnak'),
        ]),
        block('paragraph', [block('link', [text('iç')], { fields: { linkType: 'internal', doc: { relationTo: 'pages', value: 1 } } })]),
      ),
    )
    expect(html).toMatch(/<a href="https:\/\/www\.kefkenahsap\.com\/tr\/deck" style="[^"]+">deck<\/a>/)
    expect(html).toContain('href="http://example.com"')
    expect(html).toContain('href="mailto:info@kefkenahsap.com"')
    expect(html).toContain('href="tel:+905322958416"')
    expect(html).toContain('href="https://x.co/?a=&#34;&#62;&#60;script&#62;"')
    expect(html.toLowerCase()).not.toContain('javascript:')
    expect(html).not.toContain('data:text')
    expect(html).not.toContain('href="/tr/iletisim"')
    for (const label of ['tıkla', 'tıkla2', 'veri', 'göreli', 'evil', 'iç']) expect(html).toContain(`${label}`)
  })

  it('ends with the signature from Site Bilgileri', () => {
    const { html, text: plain } = render(doc(block('paragraph', [text('x')])))
    expect(html).toContain('>Murat Şen<')
    expect(html).toContain('>Kefken Ahşap Dekorasyon<')
    expect(html).toContain('<a href="tel:+905322958416" style="color:#1d1f1c;text-decoration:none">0532 295 84 16</a>')
    expect(html).toContain('href="https://wa.me/905322958416"')
    expect(html).toContain('<a href="tel:+902123224359" style="color:#1d1f1c;text-decoration:none">0212 322 43 59</a>')
    expect(html.match(/wa\.me/g)).toHaveLength(1) // the landline has no WhatsApp
    expect(html).toMatch(/href="https:\/\/www\.kefkenahsap\.com" style="[^"]+">www\.kefkenahsap\.com<\/a>/)
    expect(html).toContain('href="mailto:info@kefkenahsap.com"')
    expect(plain).toBe(
      [
        'x',
        '',
        '--',
        'Murat Şen',
        'Kefken Ahşap Dekorasyon',
        '0532 295 84 16 · WhatsApp: https://wa.me/905322958416',
        '0212 322 43 59',
        'www.kefkenahsap.com',
        'info@kefkenahsap.com',
      ].join('\n'),
    )
  })

  it('leaves out empty signature fields (no invented contact data)', () => {
    const { html, text: plain } = render(doc(block('paragraph', [text('x')])), { phones: [] })
    expect(html).not.toContain('tel:')
    expect(html).not.toContain('mailto:')
    expect(html).not.toContain('WhatsApp')
    expect(plain).toBe(['x', '', '--', 'www.kefkenahsap.com'].join('\n'))
  })

  it('escapes the signature', () => {
    const { html } = render(doc(block('paragraph', [text('x')])), { name: '<img src=x onerror=alert(1)>', company: 'A & B', phones: [{ number: '"><b>' }] })
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&#60;img src=x onerror=alert(1)&#62;')
    expect(html).toContain('A &#38; B')
    expect(html).not.toContain('<b>')
  })

  it('puts link targets into the plain-text part', () => {
    const { text: plain } = render(doc(block('paragraph', [text('Bakınız '), link('https://www.kefkenahsap.com/tr/deck', 'deck sayfası'), link('javascript:x', ' kötü')])))
    expect(plain.split('\n')[0]).toBe('Bakınız deck sayfası (https://www.kefkenahsap.com/tr/deck) kötü')
  })
})

describe('recipient', () => {
  it('quotes the name and strips header syntax from it', () => {
    expect(recipient('a@b.co', 'Ayşe Yılmaz')).toBe('"Ayşe Yılmaz" <a@b.co>')
    expect(recipient('a@b.co', 'Ayşe "Y" <x>, evil@x.com;\r\nBcc: z@z.co\\')).toBe('"Ayşe Y x evil@x.com Bcc: z@z.co" <a@b.co>')
    expect(recipient('a@b.co', '  ')).toBe('a@b.co')
    expect(recipient('a@b.co', null)).toBe('a@b.co')
  })
})

describe('sendDenied', () => {
  it('lets admins send anywhere', () => {
    expect(sendDenied({ role: 'admin', to: 'x@y.co' })).toBeUndefined()
  })
  it('lets editors send only to the linked lead’s own address (any case)', () => {
    expect(sendDenied({ role: 'editor', to: 'Ayse@Example.com', leadEmail: 'ayse@example.COM' })).toBeUndefined()
    expect(sendDenied({ role: 'editor', to: 'other@example.com', leadEmail: 'ayse@example.com' })).toMatch(/talebin e-posta adresine/)
    expect(sendDenied({ role: 'editor', to: 'ayse@example.com' })).toMatch(/talebin e-posta adresine/)
    expect(sendDenied({ role: 'editor', to: 'ayse@example.com', leadEmail: '' })).toMatch(/talebin e-posta adresine/)
    expect(sendDenied({ role: undefined, to: 'ayse@example.com', leadEmail: 'ayse@example.com' })).toMatch(/yetkiniz yok/)
  })
})
