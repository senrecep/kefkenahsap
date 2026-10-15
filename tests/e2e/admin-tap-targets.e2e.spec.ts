import { expect, type Page, test } from '@playwright/test'
import { getPayload } from 'payload'
import sharp from 'sharp'

import config from '../../src/payload.config.js'
import { login } from '../helpers/login'

// #157: every control a finger can hit on the editor's screens is at least 48×48 CSS px, for admins and editors,
// on a phone (390) and a desktop (1440).
const MIN = 48

/** Visible interactive elements smaller than MIN in either direction, described for the failure message. */
async function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate((min) => {
    const out: string[] = []
    const sel = 'a[href],button,input,select,textarea,summary,[role=button],[role=tab],[role=checkbox],label:has(> input[type=file])'
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      // The file input is visually hidden behind its label; react-select's text input sits inside its 48px control.
      if (el.matches('input[type=file],input[type=hidden],.rs__input') || el.closest('[aria-hidden=true],[inert]')) continue
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      // Checkboxes are opacity 0 on purpose: the transparent native input is what takes the tap.
      const invisible = cs.visibility === 'hidden' || (Number(cs.opacity) === 0 && !el.matches('input[type=checkbox],input[type=radio]'))
      if (!r.width || !r.height || invisible) continue
      if (r.width < min || r.height < min) {
        const name = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)
        out.push(`${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 2).join('.')} "${name}" ${Math.round(r.width)}×${Math.round(r.height)}`)
      }
    }
    return [...new Set(out)]
  }, MIN)
}

async function expectNoSmallTargets(page: Page, screen: string, { checkScroll = true } = {}) {
  // Let client components (react-select, Galeri cards) settle before measuring.
  await page.waitForLoadState('load')
  await page.waitForTimeout(500)
  expect(await smallTargets(page), `${screen}: targets under ${MIN}px`).toEqual([])
  if (checkScroll)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${screen}: horizontal scroll`).toBeLessThanOrEqual(0)
}

const run = Date.now()
const users = (['admin', 'editor'] as const).map((role) => ({
  email: `tap-${role}-${run}@local.test`,
  password: `tap-${run}`,
  name: `Tap ${role}`,
  role,
}))
const category = `E2E Tap ${run}`
let categoryId: number
let mediaId: number

test.describe('admin tap targets', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 })

  test.beforeAll(async () => {
    const payload = await getPayload({ config })
    for (const u of users) await payload.create({ collection: 'users', data: u })
    categoryId = (await payload.create({ collection: 'categories', locale: 'tr', data: { name: category } })).id
    const photo = await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 140, g: 100, b: 60 } } }).jpeg().toBuffer()
    for (const i of [1, 2]) {
      const doc = await payload.create({
        collection: 'media',
        locale: 'tr',
        data: { category: categoryId, title: `Tap foto ${i}` },
        file: { data: photo, mimetype: 'image/jpeg', name: `tap-${run}-${i}.jpg`, size: photo.length },
        context: { skipAi: true },
      })
      mediaId ??= doc.id
    }
  })

  test.afterAll(async () => {
    const payload = await getPayload({ config })
    await payload.delete({ collection: 'media', where: { category: { equals: categoryId } } })
    await payload.delete({ collection: 'categories', id: categoryId })
    await payload.delete({ collection: 'users', where: { email: { in: users.map((u) => u.email) } } })
  })

  for (const width of [390, 1440]) {
    test(`login at ${width}`, async ({ browser }) => {
      const page = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage()
      await page.goto('/admin/login')
      await expectNoSmallTargets(page, `[login ${width}]`)
    })

    for (const user of users)
      test(`${user.role} screens at ${width}`, async ({ browser }) => {
        const p = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage()
        const at = (screen: string) => `[${user.role} ${width}] ${screen}`
        await login({ page: p, user })

        await expect(p.locator('.editor-home')).toBeVisible()
        await expectNoSmallTargets(p, at('dashboard'))
        if (width < 769) {
          await p.locator('.app-header__mobile-nav-toggler').click()
          await expect(p.locator('.nav__mobile-close')).toBeVisible()
          // Payload pushes the header sideways under the open drawer; body `overflow-x: clip` keeps it from scrolling.
          await expectNoSmallTargets(p, at('navigation drawer'), { checkScroll: false })
        }

        await p.goto('/admin/galeri')
        await p.getByLabel('Kategori').selectOption({ label: category })
        await expect(p.locator('.galeri__card')).toHaveCount(2)
        await expectNoSmallTargets(p, at('Galeri'))
        await p.getByRole('button', { name: 'Sırala', exact: true }).click()
        await expect(p.locator('.galeri__row')).toHaveCount(2)
        await expectNoSmallTargets(p, at('Galeri sorting'))

        await p.goto('/admin/collections/media')
        await expect(p.locator('.cell-filename').first()).toBeVisible()
        await expectNoSmallTargets(p, at('media list'))
        await p.goto(`/admin/collections/media/${mediaId}`)
        await expect(p.locator('#field-alt')).toBeVisible()
        await expectNoSmallTargets(p, at('media edit'))
        await p.goto('/admin/collections/projects')
        await expect(p.locator('.list-header')).toBeVisible()
        await expectNoSmallTargets(p, at('projects list'))
        if (user.role === 'admin') {
          // Arrays, blocks, collapsibles and their row actions.
          await p.goto('/admin/globals/homepage')
          await expect(p.locator('.collapsible__toggle').first()).toBeVisible()
          await expectNoSmallTargets(p, at('homepage global'))
        }
      })
  }
})
