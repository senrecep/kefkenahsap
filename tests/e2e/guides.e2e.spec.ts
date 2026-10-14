import { readFileSync } from 'fs'
import path from 'path'

import { convertMarkdownToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import { expect, test } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import { guideBodyFeatures } from '../../src/collections/Guides'
import config from '../../src/payload.config.js'

// Seed guides are drafts (owner publishes), so the spec publishes its own copy of one and removes it afterwards.
const seed = JSON.parse(readFileSync(path.resolve('seed/content/guides/iroko-mu-teak-mi.json'), 'utf8'))
const stamp = Date.now()
const slugs = { tr: `e2e-rehber-${stamp}`, en: `e2e-guide-${stamp}` }

let payload: Payload
let id: number | string
let founderBefore: string | null | undefined

test.beforeAll(async () => {
  payload = await getPayload({ config })
  const editorConfig = await editorConfigFactory.fromFeatures({ config: payload.config, features: guideBodyFeatures })
  const body = (md: string) => convertMarkdownToLexical({ editorConfig, markdown: md })
  const settings = await payload.findGlobal({ slug: 'siteSettings', depth: 0 })
  founderBefore = settings.founder?.name
  if (!founderBefore) await payload.updateGlobal({ slug: 'siteSettings', data: { founder: { ...settings.founder, name: 'Murat Şen' } } })
  const tr = seed.tr
  const doc = await payload.create({ collection: 'guides', locale: 'tr', data: { ...tr, slug: slugs.tr, body: body(tr.body), _status: 'published' } })
  id = doc.id
  const en = seed.en
  await payload.update({ collection: 'guides', id, locale: 'en', data: { ...en, slug: slugs.en, body: body(en.body), _status: 'published' } })
})

test.afterAll(async () => {
  if (id) await payload.delete({ collection: 'guides', id })
  if (!founderBefore) {
    const settings = await payload.findGlobal({ slug: 'siteSettings', depth: 0 })
    await payload.updateGlobal({ slug: 'siteSettings', data: { founder: { ...settings.founder, name: founderBefore ?? null } } })
  }
})

test.describe('guides', () => {
  test('guide page: TOC anchors, body table, FAQ, author box, updated date, hreflang', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`/tr/rehber/${slugs.tr}`)
    await expect(page.getByRole('heading', { level: 1, name: seed.tr.title })).toBeVisible()
    // Screenshots before any scrolling, so the sticky header stays at the top of the full-page image.
    await page.screenshot({ path: 'docs/screens/guide-desktop.png', fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({ path: 'docs/screens/guide-mobile.png', fullPage: true })
    await page.setViewportSize({ width: 1440, height: 900 })

    // Every TOC link points at an H2 that exists on the page.
    const toc = page.getByRole('navigation', { name: 'Bu yazıda' })
    const hrefs = await toc.getByRole('link').evaluateAll((as) => as.map((a) => a.getAttribute('href')))
    expect(hrefs.length).toBeGreaterThanOrEqual(3)
    for (const href of hrefs) await expect(page.locator(`h2${href}`)).toHaveCount(1)
    await toc.getByRole('link').nth(1).click()
    await expect(page).toHaveURL(new RegExp(`${hrefs[1]}$`))

    await expect(page.locator('article table')).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Sık sorulan sorular' })).toBeVisible()
    await expect(page.locator('dt').first()).toHaveText(seed.tr.faq[0].q)
    await expect(page.getByRole('complementary', { name: 'Yazar' })).toContainText('Murat Şen')
    await expect(page.locator('time[datetime]').first()).toBeVisible()
    await expect(page.locator(`link[rel="alternate"][hreflang="en"]`)).toHaveAttribute('href', new RegExp(`/en/guides/${slugs.en}$`))

  })

  test('EN guide path and index page', async ({ page }) => {
    await page.goto(`/en/guides/${slugs.en}`)
    await expect(page.getByRole('heading', { level: 1, name: seed.en.title })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'In this guide' })).toBeVisible()

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/tr/rehber')
    await expect(page.getByRole('heading', { level: 1, name: 'Rehber' })).toBeVisible()
    // Index is cached per hour: assert structure, not this run's fixture.
    const links = page.locator('main ol a')
    for (const href of await links.evaluateAll((as) => as.map((a) => a.getAttribute('href')))) expect(href).toMatch(/^\/tr\/rehber\/[a-z0-9-]+$/)
    if ((await links.count()) === 0) await expect(page.getByText('Henüz yayında bir rehber yok.', { exact: false })).toBeVisible()
    await page.screenshot({ path: 'docs/screens/guides-index-desktop.png', fullPage: true })
  })

  test('unpublished or unknown guide is a real 404', async ({ page }) => {
    const res = await page.goto('/tr/rehber/iroko-mu-teak-mi-yok')
    expect(res?.status()).toBe(404)
  })
})
