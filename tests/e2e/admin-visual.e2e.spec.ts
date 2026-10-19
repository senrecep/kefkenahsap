import { expect, type Page, test } from '@playwright/test'
import { getPayload } from 'payload'
import sharp from 'sharp'

import config from '../../src/payload.config.js'
import { visualProblems } from '../helpers/admin-visual'
import { adminApi, ensureHomepageRows } from '../helpers/content'
import { login } from '../helpers/login'

// #167: the 48px tap areas must grow invisibly. In light and dark, on a phone and a desktop, with menus, drawers and
// popups open: no control paints a box bigger than Payload's own, no control sits on another control or on text, and
// every tap area reaches its control.
async function expectClean(page: Page, screen: string) {
  await page.waitForLoadState('load')
  await expect.poll(() => visualProblems(page), { message: screen, timeout: 10_000 }).toEqual([])
}

const run = Date.now()
const user = { email: `visual-${run}@local.test`, password: `visual-${run}`, name: 'E2E Visual', role: 'admin' as const }
const ids: { category?: number; media?: number; project?: number; tag?: number; reference?: number; page?: number } = {}
const category = `E2E Visual ${run}`

test.describe('admin visual: tap areas grow invisibly', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 })

  // The homepage screen needs layout rows; an empty DB (CI, sharded) has none, so make sure they exist.
  let restoreHomepage = async () => {}
  test.beforeAll(async () => {
    restoreHomepage = await ensureHomepageRows(await adminApi())
    const payload = await getPayload({ config })
    await payload.create({ collection: 'users', data: user })
    ids.category = (await payload.create({ collection: 'categories', locale: 'tr', data: { name: category } })).id
    ids.tag = (await payload.create({ collection: 'tags', locale: 'tr', data: { name: `E2E Visual etiket ${run}`, axis: 'wood' } })).id
    ids.reference = (await payload.create({ collection: 'references', data: { name: `E2E Visual referans ${run}` } })).id
    ids.project = (
      await payload.create({ collection: 'projects', locale: 'tr', data: { title: `E2E Visual proje ${run}`, reference: ids.reference, tags: [ids.tag], _status: 'published' } })
    ).id
    const text = { type: 'text', text: 'Görsel deneme', format: 0, mode: 'normal', style: '', detail: 0, version: 1 }
    const paragraph = { type: 'paragraph', format: '', indent: 0, version: 1, direction: null, textFormat: 0, children: [text] }
    const body = { root: { type: 'root', format: '', indent: 0, version: 1, direction: null, children: [paragraph] } }
    ids.page = (await payload.create({ collection: 'pages', locale: 'tr', data: { title: `E2E Visual sayfa ${run}`, body: body as never } })).id
    const photo = await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 140, g: 100, b: 60 } } }).jpeg().toBuffer()
    for (const i of [1, 2]) {
      const doc = await payload.create({
        collection: 'media',
        locale: 'tr',
        data: { category: ids.category, title: `Visual foto ${i}`, tags: [ids.tag] },
        file: { data: photo, mimetype: 'image/jpeg', name: `visual-${run}-${i}.jpg`, size: photo.length },
        context: { skipAi: true },
      })
      ids.media ??= doc.id
    }
  })

  test.afterAll(async () => {
    await restoreHomepage()
    const payload = await getPayload({ config })
    if (ids.category) {
      await payload.delete({ collection: 'media', where: { category: { equals: ids.category } } })
      await payload.delete({ collection: 'categories', id: ids.category })
    }
    if (ids.project) await payload.delete({ collection: 'projects', id: ids.project })
    if (ids.page) await payload.delete({ collection: 'pages', id: ids.page })
    if (ids.reference) await payload.delete({ collection: 'references', id: ids.reference })
    if (ids.tag) await payload.delete({ collection: 'tags', id: ids.tag })
    await payload.delete({ collection: 'users', where: { email: { equals: user.email } } })
  })

  for (const width of [390, 1440])
    for (const theme of ['light', 'dark'] as const)
      test(`${width} ${theme}`, async ({ browser }) => {
        // No theme cookie: Payload follows prefers-color-scheme ("Otomatik" in the account settings).
        const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme })
        try {
          const p = await context.newPage()
          const at = (screen: string) => `[${width} ${theme}] ${screen}`
          await login({ page: p, user })
          await expect.poll(() => p.evaluate(() => document.documentElement.dataset.theme)).toBe(theme)
          await expectClean(p, at('dashboard'))
          if (width < 769) {
            await p.locator('.app-header__mobile-nav-toggler').click()
            await expect(p.locator('.nav__mobile-close')).toBeVisible()
            await expectClean(p, at('navigation drawer'))
          }

          await p.goto('/admin/galeri')
          await p.getByLabel('Kategori').selectOption({ label: category })
          await expect(p.locator('.galeri__card')).toHaveCount(2)
          await expectClean(p, at('Galeri'))
          await p.getByRole('button', { name: 'Sırala', exact: true }).click()
          await expect(p.locator('.galeri__row')).toHaveCount(2)
          await expectClean(p, at('Galeri sorting'))

          await p.goto('/admin/collections/projects')
          await p.locator('.list-controls__toggle-columns').click()
          await expect(p.locator('.pill-selector')).toBeVisible()
          await expectClean(p, at('projects list, columns open'))

          await p.goto(`/admin/collections/projects/${ids.project}`)
          await expect(p.locator('#field-title')).toBeVisible()
          await expectClean(p, at('project edit'))
          // The per-language publish menu opens once there is something to publish.
          await p.locator('#field-title').fill(`E2E Visual proje ${run} *`)
          const publishMenu = p.locator('.doc-controls__controls .popup-button--default').first()
          await expect(publishMenu).toBeEnabled()
          await publishMenu.click()
          await expect(p.locator('.popup__content').first()).toBeVisible()
          await expectClean(p, at('publish menu'))
          await p.keyboard.press('Escape')
          // Tag chips, relation edit/add buttons and the react-select menu (Künye tab).
          await p.locator('.tabs-field__tab-button').nth(2).click()
          await expect(p.locator('#field-tags .multi-value').first()).toBeVisible()
          await expectClean(p, at('project chips'))
          await p.locator('#field-tags .dropdown-indicator').click()
          await expect(p.locator('.rs__menu')).toBeVisible()
          await expectClean(p, at('react-select menu'))
          await p.keyboard.press('Escape')
          await p.locator('.relationship--single-value__drawer-toggler').first().click()
          await expect(p.locator('.drawer--is-open').first()).toBeVisible()
          await expectClean(p, at('relationship drawer'))

          await p.goto(`/admin/collections/media/${ids.media}`)
          await expect(p.locator('#field-alt')).toBeVisible()
          await expectClean(p, at('media edit'))

          // The owner's report: the array/blocks row "…" became a 48px black disc over the row header in dark mode.
          await p.goto('/admin/globals/homepage')
          const rowActions = p.locator('.array-actions__button').first()
          await rowActions.scrollIntoViewIfNeeded()
          await rowActions.hover()
          await expectClean(p, at('row "…" hovered'))
          await rowActions.click()
          await expect(p.getByRole('button', { name: 'Altına ekle' }).first()).toBeVisible()
          await expectClean(p, at('row "…" menu'))
          await p.keyboard.press('Escape')
          await p.locator('.blocks-field__drawer-toggler').last().click()
          await expect(p.locator('.drawer--is-open').first()).toBeVisible()
          await expectClean(p, at('add-block drawer'))

          await p.goto(`/admin/collections/pages/${ids.page}`)
          await p.getByText('Görsel deneme').hover()
          // Lexical shows its block handles (drag / add) on hover, wide screens only.
          if (width >= 769) await expect(p.locator('.draggable-block-menu')).toBeVisible()
          await expectClean(p, at('page edit'))
        } finally {
          await context.close()
        }
      })
})
