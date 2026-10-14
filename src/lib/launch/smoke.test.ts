import { describe, expect, it } from 'vitest'

import attachments from '../legacy/attachment-map.json'
import media from '../legacy/media-map.json'
import { evaluate, smokeChecks, type Check } from './smoke'

const SITE = 'https://www.kefkenahsap.com'
const CDN = 'https://cdn.kefkenahsap.com'
const prod = smokeChecks({ site: SITE, mediaBase: CDN, production: true })
const byPath = (path: string) => prod.find((c) => c.path === path)!
const ok = (body = '') => ({ status: 200, location: null, body })

describe('smokeChecks (launch #53)', () => {
  it('covers health, key pages, robots, sitemap', () => {
    for (const p of ['/api/health', '/tr', '/en', '/tr/deck-ve-zeminler', '/tr/iletisim', '/robots.txt', '/sitemap.xml']) {
      expect(byPath(p)?.status, p).toBe(200)
    }
  })

  it('samples 5 legacy WP URLs as single 301s to the PLAN §5.2 targets', () => {
    const legacy = prod.filter((c) => c.status === 301)
    expect(legacy).toHaveLength(5)
    expect(byPath('/deck-ve-zeminler/').location).toBe('/tr/deck-ve-zeminler')
    expect(byPath('/ireko-teak/').location).toBe('/tr/ireko-teak')
    expect(byPath('/kefken-ahsap-dekorasyon/').location).toBe('/tr')
    // Targets cross-checked against the committed legacy maps (seed #31), not the resolver.
    expect(media['2018/09/1-1'].file).toBe('bahce-ahsap-deck-platformu.webp')
    expect(attachments['/deck-ve-zeminler/1-6/'].file).toBe('bahce-ahsap-deck-platformu.webp')
    expect(byPath('/wp-content/uploads/2018/09/1-1-400x400.jpg').location).toBe(`${CDN}/bahce-ahsap-deck-platformu.webp`)
    expect(byPath('/deck-ve-zeminler/1-6/').location).toBe('/tr/galeri/bahce-ahsap-deck-platformu')
  })

  it('an unknown WP upload is 410 and the redirected CDN file itself is 200', () => {
    expect(byPath('/wp-content/uploads/2021/02/kap%C4%B1dolap2.jpeg').status).toBe(410)
    expect(byPath(`${CDN}/bahce-ahsap-deck-platformu.webp`).status).toBe(200)
  })

  it('uses the media base as given (dev files live under /dev)', () => {
    const dev = smokeChecks({ site: 'https://development.kefkenahsap.com', mediaBase: `${CDN}/dev`, production: false })
    expect(dev.find((c) => c.path.startsWith('/wp-content/uploads/2018'))?.location).toBe(`${CDN}/dev/bahce-ahsap-deck-platformu.webp`)
  })
})

describe('evaluate', () => {
  const page = byPath('/tr')
  const head = (canonical: string, langs: string[]) =>
    `<head><link rel="canonical" href="${canonical}"/>${langs.map((l) => `<link rel="alternate" hrefLang="${l}" href="${SITE}/${l}"/>`).join('')}</head>`

  it('passes a page with a self canonical on the site origin and tr + x-default hreflang', () => {
    expect(evaluate(page, ok(head(`${SITE}/tr`, ['tr', 'en', 'x-default'])), SITE)).toEqual([])
  })

  it('flags a wrong status, a canonical on another origin and missing hreflang', () => {
    expect(evaluate(page, { status: 500, location: null, body: '' }, SITE)).toContain('status 500, expected 200')
    expect(evaluate(page, ok(head('https://development.kefkenahsap.com/tr', ['tr', 'x-default'])), SITE).join()).toMatch(/canonical/)
    expect(evaluate(page, ok(head(`${SITE}/tr`, ['tr'])), SITE).join()).toMatch(/hreflang x-default/)
  })

  it('compares same-site redirects by path (absolute or relative Location) and CDN redirects exactly', () => {
    const r = byPath('/deck-ve-zeminler/')
    expect(evaluate(r, { status: 301, location: 'https://internal:3000/tr/deck-ve-zeminler', body: '' }, SITE)).toEqual([])
    expect(evaluate(r, { status: 301, location: '/tr/deck-ve-zeminler', body: '' }, SITE)).toEqual([])
    expect(evaluate(r, { status: 302, location: '/tr/deck-ve-zeminler', body: '' }, SITE)).toContain('status 302, expected 301')
    expect(evaluate(r, { status: 301, location: '/tr', body: '' }, SITE).join()).toMatch(/location/)
    const m = byPath('/wp-content/uploads/2018/09/1-1-400x400.jpg')
    expect(evaluate(m, { status: 301, location: `${CDN}/dev/bahce-ahsap-deck-platformu.webp`, body: '' }, SITE).join()).toMatch(/location/)
  })

  it('production robots must advertise the sitemap and must not block everything; dev robots must block everything', () => {
    const robots = byPath('/robots.txt')
    const good = `User-Agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: ${SITE}/sitemap.xml\n`
    expect(evaluate(robots, ok(good), SITE)).toEqual([])
    expect(evaluate(robots, ok('User-Agent: *\nDisallow: /\n'), SITE).length).toBeGreaterThan(0)
    const devRobots = smokeChecks({ site: SITE, mediaBase: CDN, production: false }).find((c) => c.path === '/robots.txt')!
    expect(evaluate(devRobots, ok('User-Agent: *\nDisallow: /\n'), SITE)).toEqual([])
    expect(evaluate(devRobots, ok(good), SITE).length).toBeGreaterThan(0)
    // "Disallow: /admin" alone must not count as blocking everything.
    expect(evaluate(devRobots, ok('User-Agent: *\nDisallow: /admin\n'), SITE).length).toBeGreaterThan(0)
  })

  it('sitemap must list the site home page', () => {
    const sm: Check = byPath('/sitemap.xml')
    expect(evaluate(sm, ok(`<urlset><url><loc>${SITE}/tr</loc></url></urlset>`), SITE)).toEqual([])
    expect(evaluate(sm, ok('<urlset></urlset>'), SITE).length).toBeGreaterThan(0)
  })
})
