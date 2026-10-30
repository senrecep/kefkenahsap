import { expect, test } from '@playwright/test'

// #258: browser-tab icons and the public web app manifest; the admin keeps its own /admin-scoped manifest (#27).
test('public pages ship favicon.ico, 16/32 PNG icons and the site manifest', async ({ page, request }) => {
  const ico = await request.get('/favicon.ico')
  expect(ico.status()).toBe(200)
  expect(ico.headers()['content-type']).toContain('image/')

  await page.goto('/tr')
  const sizes = await page.locator('link[rel="icon"]').evaluateAll((ls) => ls.map((l) => l.getAttribute('sizes')))
  expect(sizes).toEqual(expect.arrayContaining(['16x16', '32x32']))
  for (const href of await page.locator('link[rel="icon"]').evaluateAll((ls) => ls.map((l) => l.getAttribute('href')!)))
    expect((await request.get(href)).ok(), href).toBe(true)

  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/site.webmanifest')
  const res = await request.get('/site.webmanifest')
  expect(res.ok()).toBe(true)
  const m = await res.json()
  expect(m).toMatchObject({ start_url: '/', scope: '/', display: 'standalone' })
  expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']))
  for (const i of m.icons) expect((await request.get(i.src)).ok(), i.src).toBe(true)
})

test('admin links only its own manifest', async ({ page }) => {
  await page.goto('/admin/login')
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1)
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/admin.webmanifest')
})
