import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { execSync } from 'child_process'

import F from '../../scripts/quality/fixtures.json' with { type: 'json' }

// #52: axe (WCAG 2.2 AA tags) on every public template, desktop and mobile, plus the interactive states
// (lightbox, mobile menu, cookie banner). No rule is disabled: every finding is fixed in the source.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } }
const fixtures = (flag = '') => execSync(`bun run payload run scripts/quality/fixtures.ts${flag}`, { stdio: 'inherit' })

async function audit(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  const summary = violations.map((v) => `${v.id} [${v.impact}] ${v.help}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 4).join(' | ')}`)
  expect.soft(summary, `axe violations on ${page.url()}`).toEqual([])
}

let category = ''
let image = ''

test.beforeAll(async ({ request }) => {
  // Published project + guide at fixed slugs (shared with lighthouserc); category and photo come from whatever is seeded.
  fixtures()
  const cat = await (await request.get('/api/categories?limit=1&depth=0&locale=tr&where[_status][equals]=published')).json()
  category = cat.docs[0].slug
  const media = await (await request.get('/api/media?limit=1&depth=0&locale=tr&where[status][equals]=approved')).json()
  image = media.docs[0].seoFilename
})

test.afterAll(() => fixtures(' -- --remove'))

const pages = () => [
  ['home tr', '/tr'],
  ['home en', '/en'],
  ['services', '/tr/hizmetlerimiz'],
  ['category', `/tr/${category}`],
  ['gallery', '/tr/galeri'],
  ['image', `/tr/galeri/${image}`],
  ['projects', '/tr/projeler'],
  ['project', `/tr/projeler/${F.project.tr}`],
  ['references', '/tr/referanslar'],
  ['about', '/tr/hakkimizda'],
  ['contact', '/tr/iletisim'],
  ['kvkk', '/tr/kvkk'],
  ['cookies', '/tr/cerez-politikasi'],
  ['search', '/tr/ara?q=deck'],
  ['404', '/tr/boyle-bir-sayfa-yok'],
  ['guides', '/tr/rehber'],
  ['guide', `/tr/rehber/${F.guide.tr}`],
]

for (const [device, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`axe ${device}`, () => {
    test.use({ viewport })

    test('every template', async ({ page }) => {
      for (const [, path] of pages()) {
        await page.goto(path)
        await audit(page)
      }
    })

    test('lightbox open', async ({ page }) => {
      await page.goto('/tr/galeri')
      await page.locator('[data-gallery-item]:visible').first().click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await audit(page)
    })

    test('cookie banner open', async ({ page }) => {
      await page.goto('/tr')
      await page.getByRole('button', { name: 'Çerez tercihleri' }).click()
      await expect(page.getByRole('region', { name: 'Çerez tercihi' })).toBeVisible()
      await audit(page)
    })
  })
}

test('axe mobile: menu open', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.mobile)
  await page.goto('/tr')
  await page.getByRole('button', { name: 'Menü' }).click()
  await expect(page.locator('#mobile-menu')).toBeVisible()
  await audit(page)
})
