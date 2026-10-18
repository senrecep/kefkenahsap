// #172: the seed categories and the rename table agree with the committed content files.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { CATEGORY_RENAMES, SEED_CATEGORIES } from './categories'

const overlaySlug = (locale: string, trSlug: string) =>
  (JSON.parse(readFileSync(path.resolve(process.cwd(), `seed/i18n/${locale}/content/categories/${trSlug}.json`), 'utf8')) as { slug: string }).slug

describe('SEED_CATEGORIES', () => {
  it('keys and slugs are unique', () => {
    for (const pick of [(c: (typeof SEED_CATEGORIES)[number]) => c.key, (c: (typeof SEED_CATEGORIES)[number]) => c.slug.tr, (c: (typeof SEED_CATEGORIES)[number]) => c.slug.en])
      expect(new Set(SEED_CATEGORIES.map(pick)).size).toBe(SEED_CATEGORIES.length)
  })
})

describe.each(CATEGORY_RENAMES)('rename $key', ({ key, from, to }) => {
  const cat = SEED_CATEGORIES.find((c) => c.key === key)!

  it('targets the seed category and its overlays', () => {
    expect(cat.slug).toEqual({ tr: to.tr, en: to.en })
    for (const l of ['ru', 'de', 'ar']) expect(overlaySlug(l, cat.slug.tr), l).toBe(to[l as keyof typeof to])
  })

  it('frees the old slugs (no current category or overlay uses them)', () => {
    for (const c of SEED_CATEGORIES) {
      expect(c.slug.tr).not.toBe(from.tr)
      expect(c.slug.en).not.toBe(from.en)
      for (const l of ['ru', 'de', 'ar'] as const) expect(overlaySlug(l, c.slug.tr)).not.toBe(from[l])
    }
  })
})
