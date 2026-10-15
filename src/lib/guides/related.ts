/**
 * "İlgili yazılar" (#146): other guides, those sharing more related categories first, then the newest. `guides` comes
 * newest first (getGuides), and the sort is stable, so ties keep that order.
 */
export function relatedGuides<T extends { id: number; categories: number[] }>(guides: T[], currentId: number, categories: number[], limit = 3): T[] {
  const mine = new Set(categories)
  const shared = (g: T) => g.categories.filter((c) => mine.has(c)).length
  return guides
    .filter((g) => g.id !== currentId)
    .map((g) => ({ g, n: shared(g) }))
    .sort((a, b) => b.n - a.n)
    .slice(0, limit)
    .map(({ g }) => g)
}
