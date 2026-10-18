import { expect, test } from '@playwright/test'

import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

// Spike #15 → #158: the admin UI is Turkish only, but Arabic *content* is still edited right-to-left
// (localization.locales[].rtl), so the editor types Arabic in an RTL field inside a Turkish admin.
test('admin stays Turkish; Arabic content fields are RTL', async ({ browser }) => {
  await seedTestUser()
  const context = await browser.newContext()
  const page = await context.newPage()
  await login({ page, user: testUser })
  // A leftover Arabic language cookie (from before #158) no longer switches the admin.
  await context.addCookies([{ name: 'payload-lng', value: 'ar', url: `http://localhost:${process.env.E2E_PORT ?? 3000}` }])
  await page.goto('/admin')
  await expect(page.getByRole('link', { name: 'Çıkış' })).toBeVisible()
  expect(await page.locator('html').getAttribute('dir')).not.toBe('rtl')

  await page.goto('/admin/collections/guides/create?locale=ar')
  await expect(page.locator('#field-title')).toHaveAttribute('data-rtl', 'true')
  await page.goto('/admin/collections/guides/create?locale=tr')
  await expect(page.locator('#field-title')).toHaveAttribute('data-rtl', 'false')
  await cleanupTestUser()
})
