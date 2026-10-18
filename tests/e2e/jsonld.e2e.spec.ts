import { type APIRequestContext, expect, test, type Page } from '@playwright/test'

import { adminApi, createDoc, deleteDocs, uploadPhoto } from '../helpers/content'
import { expectTrailMatches } from '../helpers/breadcrumb'

// PLAN §7 Structured data: the site-wide business node states exactly the siteSettings facts that are filled
// (read from the API, so it holds on any DB), each of them visible on the page; empty ones are absent.

type Node = Record<string, unknown> & { '@type': string }
type Settings = {
  companyName: string
  foundingYear?: number | null
  founder?: { name?: string | null } | null
  phones?: { number: string }[] | null
  email?: string | null
  address?: { street?: string | null } | null
  social?: { instagram?: string | null; facebook?: string | null; googleBusiness?: string | null } | null
}

async function jsonLd(page: Page) {
  return (await page.locator('script[type="application/ld+json"]').allTextContents()).map((r) => JSON.parse(r) as Node)
}
const byType = (nodes: Node[], type: string) => nodes.filter((n) => n['@type'] === type)

test.describe('JSON-LD', () => {
  let api: APIRequestContext
  const stamp = Date.now()
  const ids = { categories: [] as number[], media: [] as number[] }
  const photo = { seo: `e2e-jsonld-foto-${stamp}`, title: `E2E JSON-LD fotoğrafı ${stamp}`, caption: `Bahçede iroko deck ${stamp}.` }

  test.beforeAll(async () => {
    api = await adminApi()
    const c = await createDoc(api, 'categories', { _status: 'published', name: `E2E JSON-LD ${stamp}`, slug: `e2e-jsonld-${stamp}` })
    ids.categories.push(c.id)
    const m = await uploadPhoto(api, { seoFilename: photo.seo, category: c.id }, 5)
    ids.media.push(m.id)
    expect((await api.patch(`/api/media/${m.id}?locale=tr`, { data: { title: photo.title, caption: photo.caption } })).ok()).toBe(true)
  })

  test.afterAll(async () => {
    await deleteDocs(api, 'media', ids.media)
    await deleteDocs(api, 'categories', ids.categories)
  })

  test('every page: HomeAndConstructionBusiness = the filled siteSettings facts, all visible; WebSite without SearchAction', async ({ page }) => {
    const s = (await (await api.get('/api/globals/siteSettings?locale=tr&depth=0')).json()) as Settings
    await page.goto('/tr')
    const nodes = await jsonLd(page)
    const [biz] = byType(nodes, 'HomeAndConstructionBusiness')
    const text = await page.locator('body').innerText()

    expect(biz!['@id']).toMatch(/#business$/)
    expect(biz!.name).toBe(s.companyName)
    expect(text).toContain(s.companyName)
    // [JSON-LD key, expected from settings (undefined when empty), visible text to find]
    const facts: [string, unknown, string | undefined][] = [
      ['telephone', s.phones?.[0]?.number, s.phones?.[0]?.number],
      ['email', s.email || undefined, s.email || undefined],
      ['foundingDate', s.foundingYear ? String(s.foundingYear) : undefined, s.foundingYear ? String(s.foundingYear) : undefined],
      ['founder', s.founder?.name ? { '@type': 'Person', name: s.founder.name } : undefined, s.founder?.name || undefined],
    ]
    for (const [key, expected, visible] of facts) {
      if (expected === undefined) expect(biz, key).not.toHaveProperty(key)
      else {
        expect(biz![key], key).toEqual(expected)
        expect(text, key).toContain(visible)
      }
    }
    const street = s.address?.street || undefined
    expect((biz!.address as { streetAddress?: string } | undefined)?.streetAddress).toBe(street)
    if (street) expect(text).toContain(street)
    else expect(biz).not.toHaveProperty('geo')
    const profiles = [s.social?.instagram, s.social?.facebook, s.social?.googleBusiness].filter(Boolean)
    if (profiles.length) expect(biz!.sameAs).toEqual(profiles)
    else expect(biz).not.toHaveProperty('sameAs')
    expect(biz).not.toHaveProperty('areaServed')

    const [site] = byType(nodes, 'WebSite')
    expect(site?.publisher).toEqual({ '@id': biz!['@id'] })
    expect(JSON.stringify(nodes)).not.toContain('SearchAction')
  })

  test('photo page: ImageObject + BreadcrumbList match the visible title and caption', async ({ page }) => {
    await expect.poll(async () => (await page.goto(`/tr/galeri/${photo.seo}`))?.status(), { timeout: 20_000 }).toBe(200)
    const nodes = await jsonLd(page)
    const [img] = byType(nodes, 'ImageObject')
    expect(img!.name).toBe(photo.title)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(photo.title)
    expect(img!.caption).toBe(photo.caption)
    await expect(page.getByText(photo.caption)).toBeVisible()
    expect(img!.contentUrl).toMatch(/^https?:\/\//)
    expect(new URL(img!.url as string).pathname).toBe(`/tr/galeri/${photo.seo}`)
    const [crumbs] = byType(nodes, 'BreadcrumbList')
    const items = crumbs!.itemListElement as { position: number; name: string; item: string }[]
    expect(items.map((i) => i.position)).toEqual([1, 2, 3])
    expect(new URL(items[1]!.item).pathname).toBe('/tr/galeri')
    expect(items[2]).toMatchObject({ name: photo.title, item: img!.url })
    // PLAN §7: the JSON-LD names are exactly the visible trail.
    await expectTrailMatches(page, items)
  })
})
