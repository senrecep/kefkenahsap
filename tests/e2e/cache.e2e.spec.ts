import { expect, test } from '@playwright/test'

import { adminApi, createDoc, deleteDocs } from '../helpers/content'

// #211: public pages are ISR (PLAN §3: SSG + ISR with tag revalidation), not rendered per request. A `no-store` page
// can't be kept by the browser's back/forward cache or by Cloudflare, and pays the full render on every visit.
test.describe('Public page caching', () => {
  test('bare public URLs are served from the ISR cache with a shared-cache lifetime', async ({ request }) => {
    // global-setup's category on an empty (CI) DB, else the launch seed's.
    const category = (await request.get('/tr/e2e-deck')).ok() ? '/tr/e2e-deck' : '/tr/deck-ve-zeminler'
    const paths = ['/tr', '/en', '/tr/galeri', '/en/gallery', '/tr/projeler', '/tr/iletisim', '/tr/hizmetlerimiz', category]
    for (const path of paths) {
      await request.get(path) // the first visit renders and stores the page
      const res = await request.get(path)
      expect(res.status(), path).toBe(200)
      const cc = res.headers()['cache-control'] ?? ''
      expect(cc, path).not.toMatch(/no-store|private/)
      expect(cc, path).toMatch(/s-maxage=\d+/)
      expect(res.headers()['x-nextjs-cache'], path).toMatch(/HIT|STALE/)
    }
  })

  test('an admin save shows on the very next visit of a cached page (#192 read-your-writes)', async ({ request }) => {
    const api = await adminApi()
    const slug = `e2e-cache-${Date.now()}`
    const cat = await createDoc(api, 'categories', { name: 'E2E Önbellek', slug, shortDesc: 'Eski açıklama', _status: 'published' })
    try {
      await request.get(`/tr/${slug}`)
      expect((await request.get(`/tr/${slug}`)).headers()['x-nextjs-cache']).toMatch(/HIT|STALE/)
      const res = await api.patch(`/api/categories/${cat.id}?locale=tr`, { data: { shortDesc: 'Yeni açıklama' } })
      expect(res.ok(), await res.text()).toBe(true)
      expect(await (await request.get(`/tr/${slug}`)).text()).toContain('Yeni açıklama')
    } finally {
      await deleteDocs(api, 'categories', [cat.id])
    }
  })

  test('query-string variants still render on the server per request', async ({ request }) => {
    const res = await request.get('/tr/galeri?sayfa=2')
    expect(res.status()).toBe(200)
    // "?sayfa=N" repeats page 1's photos: only the first page is indexable.
    expect(await res.text()).toMatch(/<meta name="robots" content="noindex/)
  })

  test('the internal query route is not reachable from outside', async ({ request }) => {
    expect((await request.get('/tr/_q/galeri')).status()).toBe(404)
  })
})
