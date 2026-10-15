import { expect, type Page, test } from '@playwright/test'
import { getPayload } from 'payload'

import config from '../../src/payload.config.js'
import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'

// #158: edit forms for a phone-first editor. Title → "Diller" panel → "AI ile çevir" above the tabs; "AI ile taslak"
// right after the story; the main button publishes only the language on screen.
const editor = {
  email: 'e2e-editor-158@kefkenahsap.test',
  password: 'editor-158',
  name: 'E2E Editör',
  role: 'editor' as const,
}

const top = (page: Page, sel: string) =>
  page
    .locator(sel)
    .first()
    .evaluate((e) => e.getBoundingClientRect().top + window.scrollY)

test.describe('project edit form', () => {
  let projectId: number

  test.beforeAll(async () => {
    await seedTestUser()
    const payload = await getPayload({ config })
    await payload.delete({ collection: 'users', where: { email: { equals: editor.email } } })
    await payload.create({ collection: 'users', data: editor })
    const p = await payload.create({
      collection: 'projects',
      locale: 'tr',
      data: { title: `E2E Diller ${Date.now()}`, _status: 'published' },
    })
    projectId = p.id
    await payload.update({
      collection: 'projects',
      id: p.id,
      locale: 'en',
      draft: true,
      data: { title: '[EN] E2E languages' },
    })
  })

  test.afterAll(async () => {
    const payload = await getPayload({ config })
    await payload.delete({ collection: 'projects', id: projectId }).catch(() => {})
    await payload.delete({ collection: 'users', where: { email: { equals: editor.email } } })
    await cleanupTestUser()
  })

  for (const [who, user] of [
    ['admin', testUser],
    ['editor', editor],
  ] as const) {
    for (const width of [390, 1440]) {
      test(`${who} @${width}: language panel, AI buttons in the main column, publish this language`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 })
        await login({ page, user })
        await page.goto(`/admin/collections/projects/${projectId}`)

        const panel = page.locator('.locale-status')
        await expect(panel.locator('[data-state="live"]')).toHaveCount(1)
        const state = (name: string) =>
          panel.locator('.locale-status__item', { hasText: name }).locator('.locale-status__state')
        await expect(state('Türkçe')).toHaveText('Yayında')
        await expect(state('İngilizce')).toHaveText('Taslak, yayında değil')
        await expect(state('Rusça')).toHaveText('Boş')

        // An AI draft must not go live with a Turkish edit: the main button names the language it publishes.
        await expect(page.locator('#action-save')).toHaveText('Yayınla: TR')

        // Order in the main column: title < Diller < AI ile çevir < tabs; not in the sidebar.
        const [title, status, translate, tabs] = await Promise.all(
          [
            '#field-title',
            '.locale-status',
            '.ai-action:has(button:text("AI ile çevir"))',
            '.tabs-field',
          ].map((s) => top(page, s)),
        )
        expect(title).toBeLessThan(status)
        expect(status).toBeLessThan(translate)
        expect(translate).toBeLessThan(tabs)
        await expect(page.locator('.document-fields__sidebar .ai-action')).toHaveCount(0)
        await expect(page.locator('.tabs-field__tab-button')).toHaveText([
          'Metin',
          'Görseller',
          'Künye',
        ])

        // "AI ile taslak" sits right after the story it writes.
        const story = await top(page, '.rich-text-lexical')
        const draft = await top(page, '.ai-action:has(button:text("AI ile taslak"))')
        expect(draft).toBeGreaterThan(story)

        for (const box of await page
          .locator('.ai-btn')
          .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height)))
          expect(box).toBeGreaterThanOrEqual(48)

        await page.screenshot({
          path: `docs/screens/admin-158-project-${who}-${width}.png`,
          fullPage: width === 390,
        })
      })
    }
  }
})

test.describe('other forms', () => {
  test.beforeAll(async () => {
    await seedTestUser()
    const payload = await getPayload({ config })
    await payload.delete({ collection: 'users', where: { email: { equals: editor.email } } })
    await payload.create({ collection: 'users', data: editor })
  })
  test.afterAll(async () => {
    const payload = await getPayload({ config })
    await payload.delete({ collection: 'users', where: { email: { equals: editor.email } } })
    await cleanupTestUser()
  })

  test('editor presses "Yayınla: TR": Turkish goes live, the EN draft stays unpublished', async ({
    page,
  }) => {
    const payload = await getPayload({ config })
    const p = await payload.create({
      collection: 'projects',
      locale: 'tr',
      data: { title: `E2E Yayın ${Date.now()}`, _status: 'published' },
    })
    try {
      await payload.update({
        collection: 'projects',
        id: p.id,
        locale: 'en',
        draft: true,
        data: { title: '[EN] E2E publish' },
      })
      await login({ page, user: editor })
      await page.goto(`/admin/collections/projects/${p.id}`)
      await page.locator('#field-title').fill(`${p.title} düzeltildi`)
      await page.getByRole('button', { name: 'Yayınla: TR' }).click()
      await expect(page.locator('.locale-status__item', { hasText: 'Türkçe' })).toContainText(
        'Yayında',
      )
      await expect
        .poll(
          async () =>
            (
              await payload.findByID({
                collection: 'projects',
                id: p.id,
                locale: 'tr',
                draft: false,
              })
            ).title,
        )
        .toBe(`${p.title} düzeltildi`)
      expect(
        (
          await payload.findByID({
            collection: 'projects',
            id: p.id,
            locale: 'en',
            fallbackLocale: false,
            draft: false,
          })
        ).title ?? null,
      ).toBeNull()
      expect(
        (
          await payload.findByID({
            collection: 'projects',
            id: p.id,
            locale: 'en',
            fallbackLocale: false,
            draft: true,
          })
        ).title,
      ).toBe('[EN] E2E publish')
    } finally {
      await payload.delete({ collection: 'projects', id: p.id })
    }
  })

  test('category: Metin / Görseller / Fiyat / SEO tabs with Turkish SEO labels', async ({
    page,
  }) => {
    const payload = await getPayload({ config })
    const cat = await payload.create({
      collection: 'categories',
      locale: 'tr',
      data: { name: `E2E Kategori ${Date.now()}` },
    })
    try {
      await login({ page, user: testUser })
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        await page.goto(`/admin/collections/categories/${cat.id}`)
        await expect(page.locator('.tabs-field__tab-button')).toHaveText([
          'Metin',
          'Görseller',
          'Fiyat',
          'SEO',
        ])
        await expect(page.locator('.locale-status [data-state="draft"]')).toHaveCount(1)
        await expect(page.locator('#action-save')).toHaveText('Yayınla: TR')
        await page.screenshot({ path: `docs/screens/admin-158-category-${width}.png` })
        await page.getByRole('button', { name: 'SEO' }).click()
        await expect(page.getByText('Google başlığı')).toBeVisible()
      }
    } finally {
      await payload.delete({ collection: 'categories', id: cat.id })
    }
  })

  test('site settings: technical address fields are collapsed and read-only for an editor', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 900 })
    await login({ page, user: editor })
    await page.goto('/admin/globals/siteSettings')
    await page.getByRole('button', { name: 'İletişim' }).click()
    const lat = page.locator('#field-address__lat')
    await expect(lat).toBeHidden() // collapsed until opened
    await page
      .locator('.collapsible', { hasText: 'Teknik (harita ve posta bilgileri)' })
      .locator('.collapsible__toggle')
      .first()
      .click()
    await expect(lat).toBeVisible()
    await expect(lat).toBeDisabled()
    await expect(page.locator('#field-address__city')).toBeEnabled()
    await page.screenshot({
      path: 'docs/screens/admin-158-site-settings-editor-390.png',
      fullPage: true,
    })
  })
})
