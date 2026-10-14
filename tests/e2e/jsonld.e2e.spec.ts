import { expect, test, type Page } from '@playwright/test'

// PLAN §7 Structured data: every template's JSON-LD parses, carries its required fields, and the names it
// states are text the visitor can see on that page. Seed-agnostic (samples the first item of each list).

type Node = Record<string, unknown> & { '@type': string }

async function jsonLd(page: Page) {
  const raw = await page.locator('script[type="application/ld+json"]').allTextContents()
  return raw.map((r) => JSON.parse(r) as Node)
}
const byType = (nodes: Node[], type: string) => nodes.filter((n) => n['@type'] === type)
const visible = (page: Page) => page.locator('body').innerText()

test.describe('JSON-LD', () => {
  test('every page: HomeAndConstructionBusiness + WebSite from siteSettings (no SearchAction)', async ({ page }) => {
    await page.goto('/tr')
    const nodes = await jsonLd(page)
    const [biz] = byType(nodes, 'HomeAndConstructionBusiness')
    expect(biz).toBeTruthy()
    for (const k of ['@id', 'name', 'url']) expect(biz![k], k).toBeTruthy()
    // Optional facts appear only when siteSettings has them, and then exactly as the footer shows them.
    const text = await visible(page)
    expect(text).toContain(biz!.name as string)
    if (biz!.telephone) expect(text).toContain(biz!.telephone as string)
    const street = (biz!.address as { streetAddress?: string } | undefined)?.streetAddress
    if (street) expect(text).toContain(street)
    if (biz!.founder) expect(text).toContain((biz!.founder as { name: string }).name)
    if (biz!.foundingDate) expect(text).toContain(biz!.foundingDate as string)
    for (const url of (biz!.sameAs as string[] | undefined) ?? []) expect(url).toMatch(/^https:\/\//)
    const [site] = byType(nodes, 'WebSite')
    expect(site?.publisher).toEqual({ '@id': biz!['@id'] })
    expect(JSON.stringify(nodes)).not.toContain('SearchAction')
  })

  test('photo page: ImageObject + BreadcrumbList match the visible title and caption', async ({ page }) => {
    await page.goto('/tr/galeri')
    await page.goto((await page.locator('[data-gallery-item]:visible').first().getAttribute('href'))!)
    const nodes = await jsonLd(page)
    const [img] = byType(nodes, 'ImageObject')
    expect(img?.contentUrl).toMatch(/^https?:\/\//)
    expect(img?.name).toBe(await page.getByRole('heading', { level: 1 }).innerText())
    if (img?.caption) expect(await visible(page)).toContain(img.caption as string)
    expect(new URL(img!.url as string).pathname).toBe(new URL(page.url()).pathname)
    const [crumbs] = byType(nodes, 'BreadcrumbList')
    const items = crumbs!.itemListElement as { position: number; name: string; item: string }[]
    expect(items.map((i) => i.position)).toEqual(items.map((_, n) => n + 1))
    expect(items.at(-1)!.name).toBe(img!.name)
  })
})
