import { expect, test } from '@playwright/test'
import { getPayload } from 'payload'
import sharp from 'sharp'

import config from '../../src/payload.config.js'
import { login } from '../helpers/login'

// #26: upload through the Galeri view, reorder with ↑, approve after adding Turkish alt text.
// #157: "En sona al" in the Sırala list; Galeri opens on "Onay bekliyor" and an approved card stays in view.
test('Galeri: upload three photos, reorder (↑, En başa, En sona, fast ↓↓), approve with alt text', async ({ browser }) => {
  test.setTimeout(180_000)
  const payload = await getPayload({ config })
  const run = Date.now()
  // Own user: other admin specs delete and recreate the shared seed user, which logs this one out mid-run.
  const testUser = { email: `galeri-${run}@local.test`, password: `galeri-${run}`, name: 'E2E Galeri', role: 'admin' as const }
  await payload.create({ collection: 'users', data: testUser })
  const cat = await payload.create({ collection: 'categories', locale: 'tr', data: { name: `E2E Galeri ${run}` } })
  const photo = async (r: number, g: number, b: number) =>
    sharp({ create: { width: 1600, height: 1200, channels: 3, background: { r, g, b } } }).jpeg().toBuffer()

  try {
    const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
    await login({ page, user: testUser })
    await page.goto('/admin/galeri')
    await page.getByLabel('Kategori').selectOption({ label: `E2E Galeri ${run}` })
    await expect(page.getByText('Bu kategoride henüz fotoğraf yok.')).toBeVisible()

    const [a, b, c] = ['birinci', 'ikinci', 'ucuncu'].map((n) => `${n}-${run}.webp`) as [string, string, string]
    await page.locator('input[type="file"]').setInputFiles([
      { name: `birinci-${run}.jpg`, mimeType: 'image/jpeg', buffer: await photo(160, 110, 60) },
      { name: `ikinci-${run}.jpg`, mimeType: 'image/jpeg', buffer: await photo(60, 110, 160) },
      { name: `ucuncu-${run}.jpg`, mimeType: 'image/jpeg', buffer: await photo(60, 160, 110) },
    ])
    await expect(page.getByText('3 fotoğraf yüklendi.')).toBeVisible({ timeout: 90_000 })
    // #169: admin uploads are stamped with the site watermark.
    const uploaded = await payload.find({ collection: 'media', where: { filename: { in: [a, b, c] } }, depth: 0 })
    expect(uploaded.docs.map((d) => d.watermark)).toEqual(['applied', 'applied', 'applied'])
    await expect(page.getByRole('button', { name: 'Onay bekleyenleri göster' })).toBeVisible()

    const names = page.locator('.galeri__card .galeri__name')
    await expect(names).toHaveText([a, b, c])
    await expect(page.locator('.galeri__badge').first()).toHaveText('AI hazırlıyor…')

    const reordered = page.waitForResponse((r) => r.url().endsWith('/api/reorder') && r.ok())
    await page.getByRole('button', { name: `${b}: yukarı taşı` }).click()
    await reordered
    await expect(names).toHaveText([b, a, c])

    // The order is persisted, and the category choice is remembered across reloads.
    await page.reload()
    await expect(names).toHaveText([b, a, c], { timeout: 30_000 })
    await expect(page.getByRole('button', { name: 'Onay bekliyor 3' })).toHaveAttribute('aria-pressed', 'true')

    // Sırala: jump to the start and to the end. A move counts as done once its refresh is in (buttons enabled again).
    const rows = page.locator('.galeri__row .galeri__name')
    const settled = () => expect(page.locator('.galeri__row button[aria-disabled="true"]')).toHaveCount(4)
    await page.getByRole('button', { name: 'Tümü 3' }).click()
    await page.getByRole('button', { name: 'Sırala', exact: true }).click()
    await page.getByRole('button', { name: `En başa al: ${c}` }).click()
    await expect(rows).toHaveText([`1. ${c}`, `2. ${b}`, `3. ${a}`])
    await settled()
    await page.getByRole('button', { name: `En sona al: ${c}` }).click()
    await expect(rows).toHaveText([`1. ${b}`, `2. ${a}`, `3. ${c}`])
    await settled()

    // Two fast "↓" taps: the second lands while the first is saving (force skips Playwright's wait for enabled).
    // Whatever the screen settles on must be what was saved.
    const down = page.getByRole('button', { name: `${b}: aşağı taşı` })
    await down.click()
    await down.click({ force: true })
    await settled()
    const shown = await rows.allInnerTexts()
    expect(shown).not.toEqual([`1. ${b}`, `2. ${a}`, `3. ${c}`])
    await page.reload()
    await page.getByRole('button', { name: 'Tümü 3' }).click()
    await page.getByRole('button', { name: 'Sırala', exact: true }).click()
    await expect(rows).toHaveText(shown)
    await page.getByRole('button', { name: 'Bitti' }).click()
    await page.getByRole('button', { name: 'Onay bekliyor 3' }).click()

    const first = page.locator('.galeri__card').first()
    await first.getByRole('button', { name: 'Onayla' }).click()
    await expect(first.getByRole('alert')).toContainText('Türkçe alt metni')
    await first.getByLabel(/Alt metin/).fill('Mavi tonlarda ahşap deck örneği')
    await first.getByRole('button', { name: 'Kaydet ve onayla' }).click()
    await expect(first.locator('.galeri__badge')).toHaveText('Yayında')
    await expect(first.locator('.galeri__alt')).toHaveText('Mavi tonlarda ahşap deck örneği')
    await expect(page.getByRole('button', { name: 'Onay bekliyor 2' })).toBeVisible()
    // Docs screenshot only on demand (UPDATE_SCREENSHOTS=1) to avoid churn in normal runs.
    if (process.env.UPDATE_SCREENSHOTS) await page.screenshot({ path: 'docs/screens/admin-galeri-mobile.png', fullPage: true })
  } finally {
    await payload.delete({ collection: 'media', where: { category: { equals: cat.id } } })
    await payload.delete({ collection: 'categories', id: cat.id })
    await payload.delete({ collection: 'users', where: { email: { equals: testUser.email } } })
  }
})

// #192: a card waiting for approval shows the AI's confidence and category check, flags a doubtful one, and lists the
// tags "Onayla" will attach; approving attaches exactly those.
test('Galeri: AI confidence, category check and the tags Onayla will attach', async ({ browser }) => {
  test.setTimeout(120_000)
  const payload = await getPayload({ config })
  const run = Date.now()
  const testUser = { email: `galeri-ai-${run}@local.test`, password: `galeri-ai-${run}`, name: 'E2E Galeri AI', role: 'admin' as const }
  await payload.create({ collection: 'users', data: testUser })
  const cat = await payload.create({ collection: 'categories', locale: 'tr', data: { name: `E2E Galeri AI ${run}` } })
  const tag = await payload.create({ collection: 'tags', locale: 'tr', data: { name: `E2E Tür ${run}`, axis: 'type' } })
  const file = { name: `ai-${run}.jpg`, mimetype: 'image/jpeg', size: 0, data: await sharp({ create: { width: 1200, height: 900, channels: 3, background: { r: 150, g: 110, b: 70 } } }).jpeg().toBuffer() }
  file.size = file.data.length
  const suggestion = (confidence: number, categoryAgrees: boolean) => ({
    promptVersion: 'tagImage@4',
    model: 'fake/model',
    at: '2026-10-17T09:00:00.000Z',
    tags: { type: [tag.name], wood: [], setting: [], finish: [], stage: [] },
    confidence,
    categoryAgrees,
  })
  const make = (title: string, s: Record<string, unknown>) =>
    payload.create({ collection: 'media', locale: 'tr', context: { skipAi: true }, data: { category: cat.id, status: 'pending', title, alt: `${title} için alt metin`, aiSuggestion: s }, file: { ...file, name: `${title}-${run}.jpg` } })
  const doubtful = await make('Foto-A', suggestion(0.32, false))
  await make('Foto-B', suggestion(0.91, true))

  try {
    for (const [width, height, name] of [[1440, 900, 'desktop'], [390, 844, 'mobile']] as const) {
      const page = await (await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })).newPage()
      await login({ page, user: testUser })
      await page.goto('/admin/galeri')
      await page.getByLabel('Kategori').selectOption({ label: `E2E Galeri AI ${run}` })
      const flagged = page.locator('.galeri__card', { hasText: 'Foto-A' })
      const sure = page.locator('.galeri__card', { hasText: 'Foto-B' })
      await expect(flagged.locator('.galeri__ai')).toHaveAttribute('data-doubtful', 'true')
      await expect(flagged).toContainText('Kontrol edin: AI bu fotoğraftan emin değil. Fotoğraf bu kategoriye uymuyor olabilir.')
      await expect(flagged).toContainText('AI güveni:%32 (düşük)')
      await expect(flagged).toContainText('Kategoriye uyuyor:Hayır')
      await expect(flagged).toContainText(`Onaylayınca eklenecek etiketler:E2E Tür ${run}`)
      await expect(sure.locator('.galeri__ai')).not.toHaveAttribute('data-doubtful', /.*/)
      await expect(sure).toContainText('AI güveni:%91')
      if (process.env.UPDATE_SCREENSHOTS) await page.screenshot({ path: `docs/screens/admin-galeri-ai-${name}.png`, fullPage: true })
      if (name === 'mobile') {
        await flagged.getByRole('button', { name: 'Onayla' }).click()
        await expect(flagged.locator('.galeri__badge')).toHaveText('Yayında')
        // Approved: the AI check is gone, and the photo has the listed tag.
        await expect(flagged.locator('.galeri__ai')).toHaveCount(0)
        const saved = await payload.findByID({ collection: 'media', id: doubtful.id, depth: 0 })
        expect(saved.tags).toEqual([tag.id])
      }
      await page.context().close()
    }
  } finally {
    await payload.delete({ collection: 'media', where: { category: { equals: cat.id } } })
    await payload.delete({ collection: 'categories', id: cat.id })
    await payload.delete({ collection: 'tags', id: tag.id })
    await payload.delete({ collection: 'users', where: { email: { equals: testUser.email } } })
  }
})
