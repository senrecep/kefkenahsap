import { expect, test } from '@playwright/test'

import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

// Spike #15 (F3 note): Payload admin renders right-to-left when the admin language is Arabic.
test('admin in Arabic is RTL', async ({ browser }) => {
  await seedTestUser()
  const context = await browser.newContext()
  const page = await context.newPage()
  await login({ page, user: testUser })
  await context.addCookies([{ name: 'payload-lng', value: 'ar', url: `http://localhost:${process.env.E2E_PORT ?? 3000}` }])
  await page.goto('/admin')
  await expect(page.getByRole('link', { name: 'تسجيل الخروج' })).toBeVisible() // Arabic "Log out"
  const direction = await page.evaluate(() => getComputedStyle(document.querySelector('nav') ?? document.body).direction)
  const htmlDir = await page.locator('html').getAttribute('dir')
  console.info(`[spike #15] admin ar: html dir=${htmlDir}, nav direction=${direction}`)
  expect(direction).toBe('rtl')
  await page.screenshot({ path: 'docs/spike/admin-ar-rtl.png' })
  await cleanupTestUser()
})
