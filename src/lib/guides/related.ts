import { OUTDOOR_FIRST } from '@/lib/gallery/curate'

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

type Cat = { id: number; slug?: string | null }
/**
 * "Bu konudaki işlerimiz" (#156): projects in the guide's related categories, ranked by the guide's own category order
 * (a project counts under the earliest one it belongs to), then outdoor work first, then the input order (newest first).
 */
export function guideProjects<T extends { categories: Cat[] }>(projects: T[], categories: Cat[], limit = 3): T[] {
  const order = categories.map((c) => c.id)
  const key = (p: T) => [
    Math.min(...p.categories.map((c) => order.indexOf(c.id)).filter((i) => i >= 0)),
    // Outdoor or not, a binary: the order within OUTDOOR_FIRST is for gallery mixing, not for this.
    p.categories.some((c) => (OUTDOOR_FIRST as readonly string[]).includes(c.slug ?? '')) ? 0 : 1,
  ]
  return projects
    .map((p) => ({ p, k: key(p) }))
    .filter(({ k }) => Number.isFinite(k[0]))
    .sort((a, b) => a.k[0]! - b.k[0]! || a.k[1]! - b.k[1]!)
    .slice(0, limit)
    .map(({ p }) => p)
}
