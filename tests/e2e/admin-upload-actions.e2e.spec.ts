import { type APIRequestContext, expect, type Locator, test } from '@playwright/test'

import { adminApi, deleteDocs, uploadPhoto } from '../helpers/content'
import { login } from '../helpers/login'
import { testUser } from '../helpers/seedUser'

// On a phone (390 px) the picked-photo rows of an upload field (Ana Sayfa → Hero → Sonraki slaytlar) put the edit and
// remove buttons' 48px tap areas over each other, and the file name link over the edit button. Each control must be
// ≥48px and no two may overlap. Self-contained: its own photos in a hero saved as a draft (the edit view opens the
// latest draft; the public homepage never shows them), the previous layout restored afterwards.

/** The box a finger can hit: the element plus its invisible ::after tap area (custom.scss `hit-area`). */
const tapArea = (l: Locator) =>
  l.evaluate((el) => {
    const r = el.getBoundingClientRect()
    const a = getComputedStyle(el, '::after')
    const cs = getComputedStyle(el)
    if (a.content === 'none' || a.position !== 'absolute') return { x: r.left, y: r.top, w: r.width, h: r.height }
    const left = r.left + parseFloat(cs.borderLeftWidth) + parseFloat(a.left)
    const top = r.top + parseFloat(cs.borderTopWidth) + parseFloat(a.top)
    const x = Math.min(r.left, left)
    const y = Math.min(r.top, top)
    return { x, y, w: Math.max(r.right, left + parseFloat(a.width)) - x, h: Math.max(r.bottom, top + parseFloat(a.height)) - y }
  })
type Box = Awaited<ReturnType<typeof tapArea>>
// Half a pixel of slack for fractional layout, as in admin-tap-targets.
const overlap = (a: Box, b: Box) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.5 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.5

test.describe('upload field actions on a phone', () => {
  let api: APIRequestContext
  const photos: number[] = []
  let restore = async () => {}
  const stamp = Date.now()

  test.beforeAll(async () => {
    api = await adminApi()
    for (const i of [1, 2, 3]) photos.push((await uploadPhoto(api, { seoFilename: `e2e-upload-actions-${stamp}-${i}` }, i)).id)
    const current = await (await api.get('/api/globals/homepage?locale=tr&depth=0')).json()
    const layout = (current.layout ?? []) as { blockType: string }[]
    const hero = { blockType: 'hero', image: photos[0], slides: photos.slice(1) }
    const next = [hero, ...layout.filter((b) => b.blockType !== 'hero')]
    const res = await api.post('/api/globals/homepage?locale=tr&draft=true', { data: { layout: next, _status: 'draft' } })
    expect(res.ok(), await res.text()).toBe(true)
    restore = async () => {
      await api.post('/api/globals/homepage?locale=tr', { data: { layout, _status: current._status ?? 'published' } })
    }
  })

  test.afterAll(async () => {
    await restore()
    await deleteDocs(api, 'media', photos)
  })

  test('390×844: file link, edit and remove are each ≥48px and do not overlap', async ({ browser }) => {
    const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
    await login({ page, user: testUser })
    await page.goto('/admin/globals/homepage')
    const rows = page.locator('#field-layout__0__slides .upload-relationship-details')
    await expect(rows).toHaveCount(2)
    await expect(rows.first()).toContainText(`e2e-upload-actions-${stamp}-2`)
    for (const row of await rows.all()) {
      await row.scrollIntoViewIfNeeded()
      const parts = {
        link: await tapArea(row.locator('.upload-relationship-details__filename a')),
        edit: await tapArea(row.locator('.upload-relationship-details__edit')),
        remove: await tapArea(row.locator('.upload-relationship-details__remove')),
      }
      for (const [name, b] of Object.entries(parts)) {
        expect(b.w, `${name} width`).toBeGreaterThanOrEqual(47.5)
        expect(b.h, `${name} height`).toBeGreaterThanOrEqual(47.5)
      }
      expect(overlap(parts.edit, parts.remove), `edit ${JSON.stringify(parts.edit)} / remove ${JSON.stringify(parts.remove)}`).toBe(false)
      expect(overlap(parts.link, parts.edit), `link ${JSON.stringify(parts.link)} / edit ${JSON.stringify(parts.edit)}`).toBe(false)
      expect(overlap(parts.link, parts.remove), 'link / remove').toBe(false)
    }
  })
})
