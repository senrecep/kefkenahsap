import { expect, test } from '@playwright/test'

import en from '../../messages/en/home.json'
import tr from '../../messages/tr/home.json'

test.describe('Frontend smoke', () => {
  test('root redirects by Accept-Language: Turkish browser → /tr', async ({ browser }) => {
    const page = await (await browser.newContext({ locale: 'tr-TR' })).newPage()
    await page.goto('/')
    await expect(page).toHaveURL(/\/tr$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'tr')
  })

  test('root redirects by Accept-Language: English browser → /en', async ({ browser }) => {
    const page = await (await browser.newContext({ locale: 'en-US' })).newPage()
    await page.goto('/')
    await expect(page).toHaveURL(/\/en$/)
  })

  test('each locale renders its own heading', async ({ page }) => {
    await page.goto('/tr')
    await expect(page.locator('h1')).toHaveText(tr.Home.heroTitle)
    await page.goto('/en')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.locator('h1')).toHaveText(en.Home.heroTitle)
  })
})
