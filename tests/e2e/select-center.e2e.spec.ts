import { expect, type Locator, type Page, test } from '@playwright/test'
import { getPayload } from 'payload'

import config from '../../src/payload.config.js'
import { login } from '../helpers/login'

// #238: iOS Safari does not centre the text of a native <select> that has a min-height and native appearance, so the
// text sat high. Every select now drops the native look (appearance: none) and takes equal block padding around a set
// line-height, which centres the text in WebKit too. Set SHOT=before|after to write docs/screens/238-*.png.
const SHOT = process.env.SHOT
const shot = (target: Page | Locator, name: string) =>
  SHOT ? target.screenshot({ path: `docs/screens/238-${name}-${SHOT}.png` }) : undefined

async function metrics(select: Locator) {
  return select.evaluate((el) => {
    const cs = getComputedStyle(el)
    const px = (v: string) => parseFloat(v)
    return {
      appearance: cs.appearance,
      top: px(cs.paddingTop) + px(cs.borderTopWidth),
      bottom: px(cs.paddingBottom) + px(cs.borderBottomWidth),
      lineHeight: cs.lineHeight,
      height: el.getBoundingClientRect().height,
      image: cs.backgroundImage,
      posX: cs.backgroundPositionX,
    }
  })
}

async function expectCentred(select: Locator, minHeight: number, rtl: boolean) {
  const m = await metrics(select)
  expect(m.appearance).toBe('none')
  expect(m.top).toBe(m.bottom)
  expect(m.lineHeight).not.toBe('normal')
  expect(m.height).toBeGreaterThanOrEqual(minHeight)
  expect(m.image).toContain('svg')
  // Computed x is "12px" (anchored left) or "calc(100% - 12px)" / "right 12px" (anchored right).
  expect(/^(left )?[\d.]+px$/.test(m.posX)).toBe(rtl)
}

const PAGES = [
  { name: 'calculator', url: (l: string) => (l === 'tr' ? '/tr/malzeme-hesaplayici' : '/ar/material-calculator'), ready: '[data-ready]' },
  { name: 'contact', url: (l: string) => (l === 'tr' ? '/tr/iletisim' : '/ar/contact'), ready: '#service' },
]

for (const [device, viewport] of Object.entries({ mobile: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } })) {
  test.describe(`public selects ${device}`, () => {
    test.use({ viewport })
    for (const locale of ['tr', 'ar']) {
      for (const p of PAGES) {
        test(`${p.name} ${locale}: text centred, chevron at the inline end`, async ({ page }) => {
          await page.goto(p.url(locale))
          await page.locator(p.ready).first().waitFor()
          const selects = page.locator('select')
          const n = await selects.count()
          expect(n).toBeGreaterThan(0)
          await selects.first().scrollIntoViewIfNeeded()
          const area = p.name === 'calculator' ? page.locator('section[aria-labelledby$="timber"]') : selects.first().locator('xpath=ancestor::*[self::label or self::div][1]')
          await shot(area, `${p.name}-${locale}-${device}`)
          for (let i = 0; i < n; i++) await expectCentred(selects.nth(i), 44, locale === 'ar')
        })
      }
    }
  })
}

const LOCALES = ['tr', 'en', 'ru', 'de', 'ar']
const CALC = { tr: '/tr/malzeme-hesaplayici', en: '/en/material-calculator', ru: '/ru/kalkulyator-materialov', de: '/de/materialrechner', ar: '/ar/material-calculator' } as Record<string, string>

test.describe('calculator layout', () => {
  for (const width of [320, 360, 390]) {
    for (const locale of LOCALES) {
      test(`${locale} ${width}px: placeholders fit, unit selects line up with the row inputs`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 })
        await page.goto(CALC[locale]!)
        await page.locator('[data-ready]').waitFor()
        const row = page.locator('[data-timber-row]').first()
        const inputs = row.locator('input')
        // Placeholders show (empty fields): none is cut off by its field (or by the unit suffix).
        const clipped = await row.evaluate((el) =>
          [...el.querySelectorAll('input')]
            .filter((i) => !i.value && i.scrollWidth > i.clientWidth)
            .map((i) => `${i.id} ${i.scrollWidth}>${i.clientWidth}`),
        )
        expect(clipped).toEqual([])
        expect(await inputs.first().getAttribute('placeholder')).toMatch(/^[\d.,\u0660-\u0669\u066b\u066c]+$/)
        // The three unit selects share the thickness / width / length columns.
        const selects = page.locator('fieldset select')
        for (let i = 0; i < 3; i++) {
          const [s, f] = await Promise.all([selects.nth(i).boundingBox(), inputs.nth(i).boundingBox()])
          expect(Math.abs(s!.x - f!.x)).toBeLessThanOrEqual(1)
          expect(Math.abs(s!.width - f!.width)).toBeLessThanOrEqual(1)
        }
      })
    }
  }
})

test.describe('admin selects (390)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  for (const theme of ['light', 'dark']) {
    test(`Galeri pickers and a Payload select field: centred, ${theme}`, async ({ page }) => {
      const payload = await getPayload({ config })
      const run = Date.now()
      const user = { email: `select-${run}@local.test`, password: `select-${run}`, name: 'E2E Select', role: 'admin' as const }
      await payload.create({ collection: 'users', data: user })
      try {
        await login({ page, user })
        await page.goto('/admin/galeri')
        const pickers = page.locator('.galeri__field select')
        await expect(pickers.first()).toBeVisible()
        await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme)
        await shot(page.locator('.galeri__pickers'), `galeri-${theme}`)
        for (let i = 0; i < (await pickers.count()); i++) await expectCentred(pickers.nth(i), 48, false)

        // react-select: the value must sit on the control's vertical centre.
        await page.goto('/admin/collections/users/create')
        await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme)
        const control = page.locator('.rs__control').first()
        await expect(control.locator('.rs__single-value')).toBeVisible()
        await shot(page.locator('.field-type.select').first(), `payload-select-${theme}`)
        const [c, v] = await Promise.all([control.boundingBox(), control.locator('.rs__single-value').boundingBox()])
        expect(c!.height).toBeGreaterThanOrEqual(47.5)
        expect(Math.abs(c!.y + c!.height / 2 - (v!.y + v!.height / 2))).toBeLessThanOrEqual(1)
      } finally {
        await payload.delete({ collection: 'users', where: { email: { equals: user.email } } })
      }
    })
  }
})
