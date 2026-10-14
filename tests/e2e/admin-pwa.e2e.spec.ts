import { expect, test } from '@playwright/test'
import { getPayload } from 'payload'

import config from '../../src/payload.config.js'
import { login } from '../helpers/login'

const owner = { email: 'owner-pwa@example.com', password: 'test', name: 'E2E Yönetici', role: 'admin' as const }
const editor = { email: 'editor-pwa@example.com', password: 'test', name: 'E2E Editör', role: 'editor' as const }

// #27: installable admin (manifest scoped to /admin) and the simplified editor menu.
test('admin links a valid manifest with reachable icons and iOS meta', async ({ page, request }) => {
  await page.goto('/admin/login')
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/admin.webmanifest')
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/brand/apple-touch-icon.png')
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes')

  const res = await request.get('/admin.webmanifest')
  expect(res.ok()).toBe(true)
  const m = await res.json()
  expect(m).toMatchObject({ name: 'Kefken Ahşap Yönetim', short_name: 'Kefken', start_url: '/admin', scope: '/admin', display: 'standalone', background_color: '#fbfaf7', theme_color: '#0b7a3e' })
  expect(m.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes}/${i.purpose}`)).toEqual(['192x192/any', '512x512/any', '512x512/maskable'])
  for (const i of m.icons) expect((await request.get(i.src)).ok()).toBe(true)
})

test('editor nav shows only the simplified menu (mobile)', async ({ browser }) => {
  test.setTimeout(90_000)
  const payload = await getPayload({ config })
  const emails = { in: [owner.email, editor.email] }
  await payload.delete({ collection: 'users', where: { email: emails } })
  // The first account ever created becomes admin, so an admin must exist before the editor.
  await payload.create({ collection: 'users', data: owner })
  await payload.create({ collection: 'users', data: editor })
  try {
    const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
    await login({ page, user: editor })
    await page.locator('button[aria-label="Open Menu"]:visible').click()
    const nav = page.locator('aside')
    await expect(nav.getByRole('link', { name: 'Galeri' })).toBeVisible()
    for (const name of ['Projeler', 'Talepler', 'Site Bilgileri']) await expect(nav.getByRole('link', { name })).toBeVisible()
    for (const name of ['Görseller', 'Kategoriler', 'Etiketler', 'Sayfalar', 'Kullanıcılar', 'Ana sayfa', 'Yapay Zeka']) await expect(nav.getByRole('link', { name })).toHaveCount(0)
    expect(await page.evaluate(() => getComputedStyle(document.body).fontSize)).toBe('16px')
    await page.screenshot({ path: 'docs/screens/admin-editor-nav-mobile.png' })
    // Media stays routable: the Galeri view links editors to its edit screen.
    await page.goto('/admin/collections/media')
    await expect(page.getByText('Nothing found')).toHaveCount(0)
  } finally {
    await payload.delete({ collection: 'users', where: { email: emails } })
  }
})
