import { type APIRequestContext, expect, type Page, test } from '@playwright/test'

import { adminApi, createDoc, deleteDocs } from '../helpers/content'

// #60: the woodSamples block in a guide body. OGL is fetched only once the samples near the viewport, keyboard turns a
// plank, and reduced motion keeps the static photos without ever loading OGL. Self-contained published guide.

const text = (t: string) => ({
  type: 'text',
  text: t,
  detail: 0,
  format: 0,
  mode: 'normal',
  style: '',
  version: 1,
})
const para = (t: string) => ({
  type: 'paragraph',
  children: [text(t)],
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 1,
  textFormat: 0,
})
const filler = Array.from({ length: 14 }, (_, i) =>
  para(`Paragraf ${i + 1}: iroko, teak, çam ve thermowood dış mekânda farklı davranır. `.repeat(4)),
)
const block = {
  type: 'block',
  version: 2,
  format: '',
  fields: { id: '6560e2e0000000000000aaaa', blockName: '', blockType: 'woodSamples' },
}
const body = {
  root: {
    type: 'root',
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
    children: [...filler, block, para('Son paragraf.')],
  },
}
// The scene chunk is recognised by its content (chunk names are hashed in production builds).
const isScene = (js: string) => js.includes('WEBGL_lose_context')
const isIsland = (js: string) => js.includes('wood-samples-title')

test.describe('wood samples block', () => {
  let api: APIRequestContext
  const stamp = Date.now()
  const slug = `e2e-ahsap-numune-${stamp}`
  const plain = `e2e-ahsap-numunesiz-${stamp}`
  const ids: number[] = []

  test.beforeAll(async () => {
    api = await adminApi()
    ids.push(
      (
        await createDoc(api, 'guides', {
          _status: 'published',
          title: `E2E Ahşap numuneleri ${stamp}`,
          slug,
          body,
        })
      ).id,
    )
  })
  test.beforeAll(async () => {
    const noBlock = { root: { ...body.root, children: filler } }
    ids.push(
      (
        await createDoc(api, 'guides', {
          _status: 'published',
          title: `E2E Numunesiz ${stamp}`,
          slug: plain,
          body: noBlock,
        })
      ).id,
    )
  })
  test.afterAll(async () => {
    await deleteDocs(api, 'guides', ids)
  })

  const open = async (page: Page) => {
    const scripts: string[] = []
    page.on('response', async (r) => {
      if (r.request().resourceType() === 'script') scripts.push(await r.text().catch(() => ''))
    })
    await expect
      .poll(async () => (await page.goto(`/tr/rehber/${slug}`))?.status(), { timeout: 20_000 })
      .toBe(200)
    const figure = page.locator('figure', { hasText: 'Ahşap numuneleri' })
    // Static first: four labelled photos, server-rendered.
    await expect(figure.locator('img[src^="/wood/"]')).toHaveCount(2)
    // Only species with a real-photo texture (no drawn wood, DESIGN.md).
    await expect(figure.getByText('Teak', { exact: true })).toHaveCount(0)
    for (const name of ['İroko', 'Emprenyeli çam'])
      await expect(figure.getByText(name, { exact: true })).toBeVisible()
    return { figure, scripts }
  }

  test('OGL loads only on scroll; arrow keys turn a plank', async ({ page }) => {
    const { figure, scripts } = await open(page)
    await page.waitForLoadState('networkidle')
    expect(scripts.some(isScene)).toBe(false)

    await figure.scrollIntoViewIfNeeded()
    const plank = figure.getByRole('img', { name: /^İroko\. Sürükleyerek/ })
    await expect(plank).toBeVisible({ timeout: 15_000 })
    await expect.poll(() => scripts.some(isScene)).toBe(true)
    await expect(figure.locator('canvas')).toHaveCount(2)

    const before = await plank.screenshot()
    await plank.focus()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowDown')
    expect((await plank.screenshot()).equals(before)).toBe(false)
  })

  test('reduced motion keeps the static photos and never loads OGL', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const { figure, scripts } = await open(page)
    await figure.scrollIntoViewIfNeeded()
    await page.waitForTimeout(1500)
    await expect(figure.locator('canvas')).toHaveCount(0)
    await expect(figure.locator('[tabindex="0"]')).toHaveCount(0)
    expect(scripts.some(isScene)).toBe(false)
  })

  test('a guide without the block loads none of the samples code', async ({ page }) => {
    const scripts: string[] = []
    page.on('response', async (r) => {
      if (r.request().resourceType() === 'script') scripts.push(await r.text().catch(() => ''))
    })
    await expect
      .poll(async () => (await page.goto(`/tr/rehber/${plain}`))?.status(), { timeout: 20_000 })
      .toBe(200)
    await page.waitForLoadState('networkidle')
    await page.mouse.wheel(0, 20_000)
    await page.waitForTimeout(1000)
    expect(scripts.length).toBeGreaterThan(0)
    expect(scripts.some(isIsland)).toBe(false)
    expect(scripts.some(isScene)).toBe(false)
  })
})
