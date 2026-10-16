/** Outdoor work leads the mixed photo lists (Turkish category slugs; both slugs of the category renamed in #172). */
export const OUTDOOR_FIRST = ['deck-ve-zeminler', 'pergola-ve-kamelyalar', 'korkuluk-ve-cit', 'kopru-ve-iskele', 'sundurma-ve-ahsap-cati', 'ahsap-yapilar', 'ciceklik-ve-oturma-grubu'] as const

/** Rank of a category slug: outdoor ones first, then the rest in the saved category order, unknown last. */
export function categoryRank(savedOrder: readonly string[]) {
  return (slug: string) => {
    const outdoor = (OUTDOOR_FIRST as readonly string[]).indexOf(slug)
    if (outdoor >= 0) return outdoor
    const saved = savedOrder.indexOf(slug)
    return saved >= 0 ? 100 + saved : 1000
  }
}

type DiversifyOptions<T> = {
  group: (item: T) => string
  rank: (group: string) => number
  featured?: (item: T) => boolean
  /** At most this many per group within the first `head` items, while other groups still have photos. */
  cap?: number
  head?: number
}

/**
 * Featured photos first (as given), then round-robin across groups in rank order, keeping each group's input order.
 * Deterministic and lossless: the output is a permutation of the input.
 */
export function diversify<T>(items: readonly T[], { group, rank, featured = () => false, cap = 2, head = 12 }: DiversifyOptions<T>): T[] {
  const out = items.filter(featured)
  const queues = new Map<string, T[]>()
  for (const item of items) {
    if (featured(item)) continue
    const g = group(item)
    queues.set(g, [...(queues.get(g) ?? []), item])
  }
  const order = [...queues.keys()].sort((a, b) => rank(a) - rank(b)) // stable: ties keep first appearance
  const count = new Map<string, number>()
  for (const item of out) count.set(group(item), (count.get(group(item)) ?? 0) + 1)

  let capped = true
  while (out.length < items.length) {
    let took = false
    for (const g of order) {
      const q = queues.get(g)!
      if (!q.length || (capped && out.length < head && (count.get(g) ?? 0) >= cap)) continue
      out.push(q.shift()!)
      count.set(g, (count.get(g) ?? 0) + 1)
      took = true
    }
    if (!took) capped = false
  }
  return out
}

type Photo = { width?: number | null; height?: number | null; status?: string | null }

/** Category cover: the admin's approved cover, else the first large landscape photo in the saved order, else the first photo. */
export function pickCover<T extends Photo>(cover: number | T | null | undefined, photos: readonly T[]): T | undefined {
  if (cover && typeof cover === 'object' && cover.status === 'approved') return cover
  return photos.find((m) => (m.width ?? 0) >= 1280 && (m.width ?? 0) > (m.height ?? 0)) ?? photos[0]
}

/**
 * Photo for the "Galeri" tile that closes the services grid: from the curated selection, not already a service cover,
 * taken from its end; photos in `exclude` (the homepage gallery's tiles) only when nothing else is left.
 */
export function galleryTileCover<T extends { id: number }>(curated: readonly T[], tiles: readonly { image?: { id?: number } | null }[], exclude: readonly number[] = []): T | undefined {
  const used = new Set(tiles.map((c) => c.image?.id))
  const free = [...curated].reverse().filter((i) => !used.has(i.id))
  return free.find((i) => !exclude.includes(i.id)) ?? free[0]
}

const holes = (n: number) => ((2 - (n % 2)) % 2) + ((3 - (n % 3)) % 3)
/** Whether a closing "Galeri" tile after `n` services leaves fewer empty cells in the 2- and 3-column grids. */
export const galleryTileFills = (n: number) => n > 0 && holes(n + 1) < holes(n)
