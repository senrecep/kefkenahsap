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
  const tagName = `E2E etiket ${Date.now()}`
  await payload.create({ collection: 'tags', data: { name: tagName, axis: 'wood' } as never, locale: 'tr' })
  const emails = { in: [owner.email, editor.email] }
  await payload.delete({ collection: 'users', where: { email: emails } })
  // The first account ever created becomes admin, so an admin must exist before the editor.
  await payload.create({ collection: 'users', data: owner })
  await payload.create({ collection: 'users', data: editor })
  try {
    const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
    await login({ page, user: editor })
    await page.locator('button[aria-label="Aç Menü"]:visible').click()
    const nav = page.locator('aside')
    // Wait for the slide-in to finish: the open nav must cover (nearly) the full 390px width, not a squeezed strip.
    await expect.poll(async () => (await nav.boundingBox())?.width ?? 0).toBeGreaterThan(300)
    await expect(nav.getByRole('link', { name: 'Galeri' })).toBeVisible()
    for (const name of ['Projeler', 'Yazılar', 'Talepler', 'Site Bilgileri']) await expect(nav.getByRole('link', { name })).toBeVisible()
    // Media/categories links exist (a selector that stops matching must fail) but are not visible to editors.
    for (const slug of ['media', 'categories']) {
      const link = nav.locator(`a[href*="/collections/${slug}"]`)
      await expect(link).toHaveCount(1)
      await expect(link).toBeHidden()
    }
    for (const name of ['Etiketler', 'Sayfalar', 'Kullanıcılar', 'Ana sayfa', 'Yapay Zeka']) await expect(nav.getByRole('link', { name })).toHaveCount(0)
    // Nav labels are not clipped at 390px.
    const clipped = await nav.locator('.nav__link-label, .nav__link').evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth).map((e) => e.textContent))
    expect(clipped).toEqual([])
    await page.waitForTimeout(800) // let the slide-in transition settle before the screenshot
    await page.screenshot({ path: 'docs/screens/admin-editor-nav-mobile.png' })

    // Media stays routable: the Galeri view links editors to its edit screen.
    await page.goto('/admin/collections/media')
    await expect(page.getByText('Hiçbir şey bulunamadı')).toHaveCount(0)

    // Hidden Tags/References must still work in relationship fields: list, pick, and create in a drawer.
    await page.goto('/admin/collections/projects/create')
    await page.getByRole('button', { name: 'Künye' }).click() // tags/reference live in the "Künye" tab (#158)
    const tags = page.locator('#field-tags')
    await tags.click()
    await tags.locator('input').fill(tagName) // the option list is paginated; search for ours
    await expect(page.locator('.rs__option', { hasText: tagName })).toBeVisible()
    await page.locator('.rs__option', { hasText: tagName }).click()
    await expect(tags.locator('.relationship--multi-value-label__text')).toHaveText(tagName)
    for (const id of ['tags', 'reference']) {
      await page.locator(`#${id}-add-new button`).click()
      await expect(page.getByRole('dialog').getByRole('button', { name: 'Kaydet' })).toBeVisible()
      await page.getByRole('dialog').getByRole('button', { name: 'Kapat' }).last().click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
    }
  } finally {
    await payload.delete({ collection: 'tags', where: { name: { equals: tagName } } })
    await payload.delete({ collection: 'users', where: { email: emails } })
  }
})
