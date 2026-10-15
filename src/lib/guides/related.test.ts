import { describe, expect, it } from 'vitest'

import { guideProjects, relatedGuides } from './related'

const g = (id: number, categories: number[], updatedAt: string) => ({ id, categories, updatedAt })
// Newest first, as getGuides returns them.
const all = [
  g(1, [10], '2026-10-09'),
  g(2, [30], '2026-10-08'),
  g(3, [10, 20], '2026-10-07'),
  g(4, [20], '2026-10-06'),
  g(5, [], '2026-10-05'),
]

describe('relatedGuides', () => {
  it('never lists the guide itself; most shared categories first, then the newest', () => {
    expect(relatedGuides(all, 3, [10, 20]).map((x) => x.id)).toEqual([1, 4, 2])
  })

  it('falls back to the newest guides when none shares a category', () => {
    expect(relatedGuides(all, 1, [99]).map((x) => x.id)).toEqual([2, 3, 4])
  })

  it('returns at most `limit` and nothing when the guide is the only one', () => {
    expect(relatedGuides(all, 1, [10], 2).map((x) => x.id)).toEqual([3, 2])
    expect(relatedGuides([g(1, [10], '2026-10-09')], 1, [10])).toEqual([])
  })
})

describe('guideProjects (#156: "Bu konudaki işlerimiz")', () => {
  // Category ids as on dev; slugs are the stable identifiers the outdoor rule reads.
  const deck = { id: 1, slug: 'deck-ve-zeminler' }
  const iroko = { id: 2, slug: 'ireko-teak' }
  const furniture = { id: 3, slug: 'mobilya-ve-cila' }
  const pergola = { id: 4, slug: 'pergola-ve-kamelyalar' }
  const p = (id: number, ...categories: { id: number; slug: string }[]) => ({ id, categories })
  // Newest first, as getProjectCards returns them (dev projects: 15 office, 10 bench, 11 table, 9 terrace pergola, 1/3/2 decks).
  const cards = [p(15, furniture), p(10, iroko), p(11, iroko), p(9, iroko, pergola), p(1, deck), p(3, deck), p(2, deck), p(12, furniture)]

  it("ranks by the guide's category order: the first listed category's projects come first", () => {
    // havuz-kenari-deck lists deck, then iroko: the three decks, not the table and the bench.
    expect(guideProjects(cards, [deck, iroko]).map((x) => x.id)).toEqual([1, 3, 2])
    // iroko-mu-teak-mi lists iroko first: iroko work leads, the decks only fill up.
    expect(guideProjects(cards, [iroko, deck], 5).map((x) => x.id)).toEqual([9, 10, 11, 1, 3])
  })

  it('within one category, a project that is also outdoor work leads; otherwise the newest first', () => {
    // 9 is iroko and pergola (outdoor), so it leads 10 and 11 (iroko only), which keep their newest-first order.
    expect(guideProjects(cards, [iroko]).map((x) => x.id)).toEqual([9, 10, 11])
  })

  it('lists only projects in one of the categories, at most `limit`', () => {
    expect(guideProjects(cards, [furniture]).map((x) => x.id)).toEqual([15, 12])
    expect(guideProjects(cards, [])).toEqual([])
  })
})
