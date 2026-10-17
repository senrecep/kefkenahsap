import { expect, test } from '@playwright/test'

// Single-hop legacy redirects (#32), against the seeded maps in src/lib/legacy/. `maxRedirects: 0` asserts the very first response.
const hop = (request: import('@playwright/test').APIRequestContext, url: string) =>
  request.get(url, { maxRedirects: 0 })

test('old WP page with trailing slash → /tr/<slug> in one 301', async ({ request }) => {
  const r = await hop(request, '/deck-ve-zeminler/')
  expect(r.status()).toBe(301)
  expect(new URL(r.headers().location, 'http://x').pathname).toBe('/tr/deck-ve-zeminler')
})

test('WP size variant of a known image → CDN original in one 301', async ({ request }) => {
  const r = await hop(request, '/wp-content/uploads/2018/09/1-1-400x400.jpg')
  expect(r.status()).toBe(301)
  expect(r.headers().location).toBe(`${process.env.MEDIA_PUBLIC_URL}/bahce-ahsap-deck-platformu-1.webp`)
})

test('old attachment page → its image page in one 301', async ({ request }) => {
  const r = await hop(request, '/deck-ve-zeminler/1-6/')
  expect(r.status()).toBe(301)
  expect(new URL(r.headers().location, 'http://x').pathname).toBe('/tr/galeri/bahce-ahsap-deck-platformu')
})

test('WP internals → 410', async ({ request }) => {
  expect((await hop(request, '/wp-login.php')).status()).toBe(410)
})

test('unknown WP upload (Turkish characters, encoded) → 410', async ({ request }) => {
  const r = await hop(request, '/wp-content/uploads/2021/02/kap%C4%B1dolap2.jpeg')
  expect(r.status()).toBe(410)
})

test('new URL with trailing slash → one 308 to the canonical path', async ({ request }) => {
  const r = await hop(request, '/tr/')
  expect(r.status()).toBe(308)
  expect(new URL(r.headers().location, 'http://x').pathname).toBe('/tr')
})
