import { expect, test } from '@playwright/test'

import { expectTrailMatches } from '../helpers/breadcrumb'

// PLAN §7 / #6: indexable pages carry the large-preview robots directives, each fixed page its own schema.org type, and a
// BreadcrumbList that is exactly the visible trail. Fixed pages only (no content to create); project and guide
// pages are covered in seo-projects / seo-guides.

type Node = Record<string, unknown> & { '@type': string }
const jsonLd = (html: string) => [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]!) as Node)

const pages: { path: string; type?: string }[] = [
  { path: '/tr/iletisim', type: 'ContactPage' },
  { path: '/tr/hakkimizda', type: 'AboutPage' },
  { path: '/tr/hizmetlerimiz', type: 'CollectionPage' },
  { path: '/tr/referanslar', type: 'CollectionPage' },
  { path: '/tr/galeri', type: 'CollectionPage' },
  { path: '/tr/projeler', type: 'CollectionPage' },
  { path: '/tr/rehber', type: 'CollectionPage' },
  { path: '/tr/kvkk' },
  { path: '/tr/cerez-politikasi' },
]

test.describe('structured data per page type', () => {
  for (const p of pages) {
    test(`${p.path}: robots, ${p.type ?? 'no page type'}, BreadcrumbList = visible trail`, async ({ page, request }) => {
      const html = await (await request.get(p.path)).text()
      const robots = html.match(/<meta name="robots" content="([^"]*)"/)?.[1] ?? ''
      if (/noindex/.test(robots)) return // an empty guides index is noindex by design
      expect(robots).toContain('max-image-preview:large')
      expect(robots).toContain('max-snippet:-1')
      expect(robots).toContain('max-video-preview:-1')

      const nodes = jsonLd(html)
      const biz = nodes.find((n) => n['@type'] === 'HomeAndConstructionBusiness')!
      const site = nodes.find((n) => n['@type'] === 'WebSite')!
      if (p.type) {
        const node = nodes.find((n) => n['@type'] === p.type)
        expect(node, p.type).toBeTruthy()
        expect(new URL(node!.url as string).pathname).toBe(p.path)
        expect(node!.isPartOf).toEqual({ '@id': site['@id'] })
        expect(node!.inLanguage).toBe('tr')
        if (p.type === 'CollectionPage') expect(node).not.toHaveProperty('mainEntity')
        else expect(node!.mainEntity).toEqual({ '@id': biz['@id'] })
      }

      const crumbs = nodes.find((n) => n['@type'] === 'BreadcrumbList')
      const items = (crumbs!.itemListElement as { position: number; name: string; item: string }[])
      expect(items.length).toBeGreaterThanOrEqual(2)
      expect(items.map((i) => i.position)).toEqual(items.map((_, n) => n + 1))
      expect(new URL(items.at(-1)!.item).pathname).toBe(p.path)
      await page.goto(p.path)
      await expectTrailMatches(page, items)
    })
  }
})
