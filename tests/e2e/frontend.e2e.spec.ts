import { expect, test } from '@playwright/test'

import en from '../../messages/en/home.json' with { type: 'json' }
import tr from '../../messages/tr/home.json' with { type: 'json' }

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

  test('the language switcher remembers the choice for `/` (PLAN §5.1) without a Set-Cookie on pages (#211)', async ({ browser }) => {
    const page = await (await browser.newContext({ locale: 'tr-TR' })).newPage()
    const res = await page.goto('/tr')
    expect(res!.headers()['set-cookie']).toBeUndefined()
    await page.locator('header a[hreflang="en"]').first().evaluate((a: HTMLAnchorElement) => a.click())
    await expect(page).toHaveURL(/\/en$/)
    const root = await page.request.get('/', { maxRedirects: 0 })
    expect(new URL(root.headers()['location']!, 'http://x').pathname).toBe('/en')
  })

  test('each locale renders its own heading', async ({ page }) => {
    await page.goto('/tr')
    await expect(page.locator('h1')).toHaveText(tr.Home.heroTitle)
    await page.goto('/en')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.locator('h1')).toHaveText(en.Home.heroTitle)
  })
})
