import { expect, type Page } from '@playwright/test'

type Crumb = { name: string; item: string }

/** PLAN §7: the visible trail (text, links, current page) is exactly what the BreadcrumbList says. */
export async function expectTrailMatches(page: Page, items: Crumb[]) {
  const lis = page.getByRole('navigation', { name: 'Konum' }).locator('li')
  expect(await lis.allInnerTexts()).toEqual(items.map((i) => i.name))
  const hrefs = await lis.evaluateAll((els) => els.map((e) => e.querySelector('a')?.getAttribute('href') ?? null))
  expect(hrefs.slice(0, -1)).toEqual(items.slice(0, -1).map((i) => new URL(i.item).pathname))
  expect(hrefs.at(-1)).toBeNull()
  await expect(lis.last()).toHaveAttribute('aria-current', 'page')
}
