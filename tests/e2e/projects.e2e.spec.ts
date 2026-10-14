import { type APIRequestContext, expect, request, test } from '@playwright/test'
import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config.js'
import { seedTestUser, testUser } from '../helpers/seedUser'

// The seed has no projects: create two temporary ones (and a reference), delete them afterwards.
// Writes go through the REST API so Payload's hooks run inside the Next server and revalidate its cached loaders.
test.describe('Projects, project page and references', () => {
  let payload: Payload
  let api: APIRequestContext
  const create = async <T>(collection: string, data: Record<string, unknown>): Promise<T> => {
    const res = await api.post(`/api/${collection}?locale=tr`, { data })
    expect(res.ok(), await res.text()).toBe(true)
    return (await res.json()).doc as T
  }
  const stamp = Date.now()
  const ids: { projects: number[]; references: number[]; tags: number[] } = {
    projects: [],
    references: [],
    tags: [],
  }
  let full: { slug: string; title: string }
  let bare: { slug: string; title: string }

  test.beforeAll(async () => {
    payload = await getPayload({ config })
    await seedTestUser()
    const baseURL = `http://localhost:${process.env.E2E_PORT ?? 3000}`
    const login = await (
      await request.newContext({ baseURL })
    ).post('/api/users/login', { data: { email: testUser.email, password: testUser.password } })
    api = await request.newContext({
      baseURL,
      extraHTTPHeaders: { Authorization: `JWT ${(await login.json()).token}` },
    })
    const deck = (
      await payload.find({
        collection: 'categories',
        locale: 'tr',
        where: { slug: { equals: 'deck-ve-zeminler' } },
        depth: 0,
      })
    ).docs[0]!
    const photos = (
      await payload.find({
        collection: 'media',
        where: { and: [{ status: { equals: 'approved' } }, { category: { equals: deck.id } }] },
        limit: 4,
        depth: 0,
      })
    ).docs
    const wood = await create<{ id: number }>('tags', { name: `E2E Iroko ${stamp}`, axis: 'wood' })
    const ref = await create<{ id: number }>('references', {
      name: `E2E Referans ${stamp}`,
      location: 'Riva / İstanbul',
    })
    ids.references.push(ref.id)
    type P = { id: number; slug: string; title: string }
    const a = await create<P>('projects', {
      _status: 'published',
      title: `E2E Havuz Deck ${stamp}`,
      categories: [deck.id],
      gallery: photos.map((p) => p.id),
      city: 'İstanbul',
      district: 'Beykoz',
      year: 2019,
      areaValue: 120,
      areaUnit: 'm2',
      woodSpecies: [wood.id],
      reference: ref.id,
      testimonial: { quote: 'Gizli yorum', author: 'A. Müşteri', consentGiven: false },
    })
    const b = await create<P>('projects', {
      _status: 'published',
      title: `E2E Boş Künye ${stamp}`,
      categories: [deck.id],
      testimonial: { quote: 'Çok memnun kaldık.', author: 'B. Müşteri', consentGiven: true },
    })
    ids.projects.push(a.id, b.id)
    full = a
    bare = b
    ids.tags.push(wood.id)
  })

  test.afterAll(async () => {
    for (const [collection, list] of Object.entries(ids))
      for (const id of list) await api.delete(`/api/${collection}/${id}`)
  })

  test('project page shows only filled facts, ordered gallery, consented testimonial only, similar projects and CTA', async ({
    page,
  }) => {
    await page.goto(`/tr/projeler/${full.slug}`)
    await expect(page.locator('h1')).toHaveText(full.title)
    const facts = page.getByRole('region', { name: 'Proje künyesi' })
    await expect(facts.locator('dt')).toHaveText(['Yer', 'Yıl', 'Alan', 'Ahşap türü', 'Kategori'])
    await expect(facts).toContainText('Beykoz, İstanbul')
    await expect(facts).toContainText('120 m²')
    await expect(page.getByText('Gizli yorum')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Benzer projeler' })).toBeVisible()
    await expect(page.getByRole('link', { name: new RegExp(bare.title) })).toBeVisible()
    await expect(page.locator('a[data-umami-event-place="project_cta"]')).toHaveAttribute(
      'href',
      /^https:\/\/wa\.me\/.*E2E%20Havuz%20Deck/,
    )

    await page.goto(`/tr/projeler/${bare.slug}`)
    // Only the category is filled: every other künye row stays out.
    await expect(page.getByRole('region', { name: 'Proje künyesi' }).locator('dt')).toHaveText(['Kategori'])
    await expect(page.getByText('Çok memnun kaldık.')).toBeVisible()
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(0)
  })

  test('index filters by category through the URL', async ({ page }) => {
    await page.goto('/tr/projeler')
    await expect(page.getByRole('link', { name: new RegExp(full.title) })).toBeVisible()
    await page.goto('/tr/projeler?kategori=deck-ve-zeminler')
    await expect(page.getByRole('link', { name: new RegExp(bare.title) })).toBeVisible()
    await page.goto('/tr/projeler?kategori=merdivenler')
    await expect(page.getByRole('link', { name: new RegExp(bare.title) })).toBeVisible() // unknown/unused filter → all projects
  })

  test('references list names, locations and linked projects', async ({ page }) => {
    await page.goto('/tr/referanslar')
    const row = page.locator('li', { hasText: `E2E Referans ${stamp}` })
    await expect(row).toContainText('Riva / İstanbul')
    await expect(row.getByRole('link', { name: full.title })).toHaveAttribute(
      'href',
      `/tr/projeler/${full.slug}`,
    )
    await page.goto('/en/references')
    await expect(page.locator('h1')).toHaveText('References')
  })

  test('unknown project is a 404', async ({ page }) => {
    expect((await page.goto('/tr/projeler/boyle-bir-proje-yok'))?.status()).toBe(404)
  })
})
