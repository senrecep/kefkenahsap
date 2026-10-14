import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'

import { routing } from '../../src/i18n/routing'

// #52: axe (WCAG 2.2 AA tags) on every public template in every locale, desktop and mobile, plus the interactive
// states (lightbox, cookie banner, contact form errors, mobile menu). No rule is disabled: findings are fixed in source.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } }
// Every localized template path, from routing.locales + getPathname (scripts/quality/fixtures.ts).
const TEMPLATES = ['home', 'services', 'category', 'gallery', 'image', 'projects', 'project', 'references', 'about', 'contact', 'kvkk', 'cookies', 'search', 'searchEmpty', 'notFound', 'guides', 'guide'] as const
const fixtures = (flag = '') => execSync(`bun run payload run scripts/quality/fixtures.ts${flag}`, { stdio: 'inherit' })

type Messages = { Nav: { menu: string }; Consent: { label: string; preferences: string }; Contact: { submit: string } }
let targets: Record<string, Record<(typeof TEMPLATES)[number], string>> = {}
const messages: Record<string, Messages> = {}

async function audit(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  const summary = violations.map((v) => `${v.id} [${v.impact}] ${v.help}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 4).join(' | ')}`)
  expect(summary, `axe violations on ${page.url()}`).toEqual([])
}

test.beforeAll(async () => {
  test.setTimeout(180_000) // fixtures boot Payload and convert a guide body
  fixtures()
  targets = JSON.parse(readFileSync('.quality-targets.json', 'utf8'))
  const json = async (locale: string, file: string) => (await import(`../../messages/${locale}/${file}.json`, { with: { type: 'json' } })).default
  for (const locale of routing.locales)
    messages[locale] = { ...(await json(locale, 'common')), ...(await json(locale, 'consent')), ...(await json(locale, 'contact')) } as Messages
})

// CI keeps them for the Lighthouse step (an ephemeral DB, and a re-created doc would meet stale cached pages);
// locally they would otherwise show up in the shared dev DB's lists, search and sitemap.
test.afterAll(() => {
  if (!process.env.CI) fixtures(' -- --remove')
})

for (const locale of routing.locales) {
  for (const [device, viewport] of Object.entries(VIEWPORTS)) {
    test.describe(`axe ${locale} ${device}`, () => {
      test.use({ viewport })

      for (const template of TEMPLATES) {
        test(template, async ({ page }) => {
          await page.goto(targets[locale]![template])
          await audit(page)
        })
      }

      test('lightbox open', async ({ page }) => {
        await page.goto(targets[locale]!.gallery)
        await page.locator('[data-gallery-item]:visible').first().click()
        await expect(page.getByRole('dialog')).toBeVisible()
        await audit(page)
      })

      test('cookie banner open', async ({ page }) => {
        await page.goto(targets[locale]!.home)
        await page.getByRole('button', { name: messages[locale]!.Consent.preferences }).click()
        await expect(page.getByRole('region', { name: messages[locale]!.Consent.label })).toBeVisible()
        await audit(page)
      })

      test('contact form errors', async ({ page }) => {
        await page.goto(targets[locale]!.contact)
        await page.getByRole('button', { name: messages[locale]!.Contact.submit }).click()
        await expect(page.locator('[aria-invalid="true"]').first()).toBeVisible()
        await audit(page)
      })
    })
  }

  test(`axe ${locale} mobile: menu open`, async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile)
    await page.goto(targets[locale]!.home)
    await page.getByRole('button', { name: messages[locale]!.Nav.menu }).click()
    await expect(page.locator('#mobile-menu')).toBeVisible()
    await audit(page)
  })
}
