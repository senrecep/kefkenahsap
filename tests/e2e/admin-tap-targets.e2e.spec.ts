import { expect, type Page, test } from '@playwright/test'
import { getPayload } from 'payload'
import sharp from 'sharp'

import config from '../../src/payload.config.js'
import { adminApi, ensureHomepageRows } from '../helpers/content'
import { login } from '../helpers/login'

// #157: every control a finger can hit on the editor's screens is at least 48×48 CSS px, for admins and editors,
// on a phone (390) and a desktop (1440).
const MIN = 48

/** Visible interactive elements smaller than MIN in either direction, described for the failure message. */
async function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate((min) => {
    const out: string[] = []
    // #165: react-select's clear "×" and multi-value chips are bare divs that still take taps.
    const sel = 'a[href],button,input,select,textarea,summary,[role=button],[role=tab],[role=checkbox],label:has(> input[type=file]),.clear-indicator,.multi-value'
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      // The file input is visually hidden behind its label; react-select's text input sits inside its 48px control.
      if (el.matches('input[type=file],input[type=hidden],.rs__input') || el.closest('[aria-hidden=true],[inert]')) continue
      // #167: icon controls keep Payload's size and take taps through an invisible 48px ::after (custom.scss `hit-area`).
      let r = el.getBoundingClientRect()
      const after = getComputedStyle(el, '::after')
      const cs = getComputedStyle(el)
      if (after.content !== 'none' && after.position === 'absolute') {
        const left = r.left + parseFloat(cs.borderLeftWidth) + parseFloat(after.left)
        const top = r.top + parseFloat(cs.borderTopWidth) + parseFloat(after.top)
        const l = Math.min(r.left, left), t = Math.min(r.top, top)
        r = new DOMRect(l, t, Math.max(r.right, left + parseFloat(after.width)) - l, Math.max(r.bottom, top + parseFloat(after.height)) - t)
      }
      // Checkboxes are opacity 0 on purpose: the transparent native input is what takes the tap.
      const invisible = cs.visibility === 'hidden' || (Number(cs.opacity) === 0 && !el.matches('input[type=checkbox],input[type=radio]'))
      if (!r.width || !r.height || invisible) continue
      // Half a pixel of slack: a tap area centred on a fractional-pixel icon measures 47.99px.
      if (r.width < min - 0.5 || r.height < min - 0.5) {
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
  await expect.poll(() => smallTargets(page), { message: `${screen}: targets under ${MIN}px` }).toEqual([])
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
let projectId: number
let tagId: number
let referenceId: number
let pageId: number

test.describe('admin tap targets', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 })

  // The homepage screen needs layout rows; an empty DB (CI, sharded) has none, so make sure they exist.
  let restoreHomepage = async () => {}
  test.beforeAll(async () => {
    restoreHomepage = await ensureHomepageRows(await adminApi())
    const payload = await getPayload({ config })
    for (const u of users) await payload.create({ collection: 'users', data: u })
    categoryId = (await payload.create({ collection: 'categories', locale: 'tr', data: { name: category } })).id
    // #158: an existing record shows the "Diller" panel and the AI tools in the main column.
    // #165: a tag chip on the media/project form, a reference with a joined project, a page with rich text (block handles).
    tagId = (await payload.create({ collection: 'tags', locale: 'tr', data: { name: `E2E Tap etiket ${run}`, axis: 'wood' } })).id
    referenceId = (await payload.create({ collection: 'references', data: { name: `E2E Tap referans ${run}` } })).id
    projectId = (await payload.create({ collection: 'projects', locale: 'tr', data: { title: `E2E Tap proje ${run}`, reference: referenceId, _status: 'published' } })).id
    const text = { type: 'text', text: 'Elle yazıldı', format: 0, mode: 'normal', style: '', detail: 0, version: 1 }
    const paragraph = { type: 'paragraph', format: '', indent: 0, version: 1, direction: null, textFormat: 0, children: [text] }
    const body = { root: { type: 'root', format: '', indent: 0, version: 1, direction: null, children: [paragraph] } }
    pageId = (await payload.create({ collection: 'pages', locale: 'tr', data: { title: `E2E Tap sayfa ${run}`, body: body as never } })).id
    const photo = await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 140, g: 100, b: 60 } } }).jpeg().toBuffer()
    for (const i of [1, 2]) {
      const doc = await payload.create({
        collection: 'media',
        locale: 'tr',
        data: { category: categoryId, title: `Tap foto ${i}`, tags: [tagId] },
        file: { data: photo, mimetype: 'image/jpeg', name: `tap-${run}-${i}.jpg`, size: photo.length },
        context: { skipAi: true },
      })
      mediaId ??= doc.id
    }
  })

  test.afterAll(async () => {
    await restoreHomepage()
    const payload = await getPayload({ config })
    // Never delete with an undefined filter: if beforeAll failed early there is no category to clean up.
    if (categoryId) {
      await payload.delete({ collection: 'media', where: { category: { equals: categoryId } } })
      await payload.delete({ collection: 'categories', id: categoryId })
    }
    if (projectId) await payload.delete({ collection: 'projects', id: projectId })
    if (pageId) await payload.delete({ collection: 'pages', id: pageId })
    if (referenceId) await payload.delete({ collection: 'references', id: referenceId })
    if (tagId) await payload.delete({ collection: 'tags', id: tagId })
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
        // Editors reach media and categories through Galeri only.
        for (const slug of ['media', 'categories'])
          await expect(p.locator(`#card-${slug}`)).toBeVisible({ visible: user.role === 'admin' })
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
        await expect(p.locator('.multi-value').first()).toBeVisible()
        await expectNoSmallTargets(p, at('media edit'))
        // #165: admin previews come from the CDN; nothing on the media screens 5xx's.
        const thumbs = p.locator('.cell-filename img, .file-details img, .thumbnail img')
        await p.goto('/admin/collections/media')
        await expect(thumbs.first()).toBeVisible()
        for (const src of await thumbs.evaluateAll((imgs) => imgs.slice(0, 5).map((i) => (i as HTMLImageElement).currentSrc))) {
          expect(src).not.toContain('/api/media/file')
          expect((await p.request.get(src)).status(), src).toBe(200)
        }
        expect(await thumbs.first().evaluate((i) => (i as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
        // #165: the account page fit 450px wide on a 390 phone.
        await p.goto('/admin/account')
        await expect(p.locator('#field-email')).toBeVisible()
        await expectNoSmallTargets(p, at('account'))
        await p.goto('/admin/collections/projects')
        await expect(p.locator('.list-header')).toBeVisible()
        await expectNoSmallTargets(p, at('projects list'))
        await p.goto(`/admin/collections/projects/${projectId}`)
        await expect(p.locator('.locale-status [data-state="live"]')).toHaveCount(1)
        await expectNoSmallTargets(p, at('project edit'))
        if (user.role === 'admin') {
          // Arrays, blocks, collapsibles and their row actions.
          await p.goto('/admin/globals/homepage')
          await expect(p.locator('.collapsible__toggle').first()).toBeVisible()
          await expectNoSmallTargets(p, at('homepage global'))
          // #165: list cell links, the join table's "add new", and the rich-text block handles.
          for (const slug of ['tags', 'references']) {
            await p.goto(`/admin/collections/${slug}`)
            await expect(p.locator('.table td a').first()).toBeVisible()
            await expectNoSmallTargets(p, at(`${slug} list`))
          }
          await p.goto(`/admin/collections/references/${referenceId}`)
          await expect(p.locator('.relationship-table__add-new')).toBeVisible()
          await expectNoSmallTargets(p, at('reference edit'))
          await p.goto(`/admin/collections/pages/${pageId}`)
          await p.getByText('Elle yazıldı').hover()
          // Lexical shows its block handles (drag / add) on hover, wide screens only.
          if (width >= 769) await expect(p.locator('.draggable-block-menu')).toBeVisible()
          await expectNoSmallTargets(p, at('page edit'))
        }
      })
  }
})
