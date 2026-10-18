// #33: "possible project" suggestions — average-linkage clustering of CLIP vectors within a category,
// strengthened by same-day dates and split by dates too far apart. Pure; the scripts in scripts/clusters/ do the I/O.
import { Err } from 'tsentials/errors'
import { Result } from 'tsentials/result'

export type ClusterPhoto = { key: string; category: string; v: number[]; day?: string }
export type ClusterOptions = {
  /** Minimum average pairwise similarity (cosine + same-day bonus) for two groups to merge. */
  threshold: number
  /** Added to the cosine of two photos taken on the same day. */
  sameDayBonus: number
  /** Groups whose dated photos would span more than this many days never merge. */
  maxGapDays: number
  minSize: number
  maxSize: number
}
export type Cluster = { category: string; keys: string[]; from?: string; to?: string }

const DAY_PATTERNS = [
  /WhatsApp[- ]Image[- ](\d{4})-(\d{2})-(\d{2})/i, // WhatsApp-Image-2021-04-30-at-20.41.55
  /IMG[_-](\d{4})(\d{2})(\d{2})[_-]/i, // IMG_20180408_071129, IMG-20160512-WA0003
]

/** The day a photo was taken (or received), when its file name carries one. */
export function dayFromFilename(file: string): string | undefined {
  for (const re of DAY_PATTERNS) {
    const m = file.match(re)
    if (!m) continue
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
    const date = new Date(Date.UTC(y, mo - 1, d))
    if (y >= 2000 && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d) return `${m[1]}-${m[2]}-${m[3]}`
  }
  return undefined
}

/**
 * WhatsApp names carry the day a photo was forwarded, not taken. A name day shared by 3+ categories is a bulk
 * transfer (e.g. 69 photos on 2026-08-07 whose EXIF says 2022–2024), so it says nothing about the job.
 */
export function transferDays(named: { category: string; day: string }[], minCategories = 3): Set<string> {
  const cats = new Map<string, Set<string>>()
  for (const { category, day } of named) cats.set(day, (cats.get(day) ?? new Set()).add(category))
  return new Set([...cats].filter(([, c]) => c.size >= minCategories).map(([day]) => day))
}

const dayNumber =(day: string) => Date.parse(`${day}T00:00:00Z`) / 86_400_000

type Group = { members: number[]; first?: number; last?: number }

export function clusterPhotos(photos: ClusterPhoto[], opts: ClusterOptions): Result<Cluster[]> {
  const dim = photos[0]?.v.length ?? 0
  if (photos.some((ph) => ph.v.length !== dim))
    return Result.failure(Err.validation('Clusters.DimensionMismatch', 'All embedding vectors must have the same length.'))

  const clusters: Cluster[] = []
  for (const category of new Set(photos.map((ph) => ph.category))) {
    const idx = photos.flatMap((ph, i) => (ph.category === category ? [i] : []))
    const sim = (i: number, j: number) => {
      const [a, b] = [photos[i]!, photos[j]!]
      const cos = a.v.reduce((s, x, k) => s + x * b.v[k]!, 0)
      return cos + (a.day && a.day === b.day ? opts.sameDayBonus : 0)
    }
    let groups: Group[] = idx.map((i) => {
      const day = photos[i]!.day
      return { members: [i], first: day ? dayNumber(day) : undefined, last: day ? dayNumber(day) : undefined }
    })
    // sums[a][b] = sum of pairwise similarities between groups a and b (average = sum / (|a|·|b|)).
    let sums = groups.map((_, a) => groups.map((__, b) => (a === b ? 0 : sim(idx[a]!, idx[b]!))))

    for (;;) {
      let best: [number, number] | undefined
      let bestAvg = opts.threshold
      for (let a = 0; a < groups.length; a++)
        for (let b = a + 1; b < groups.length; b++) {
          const [ga, gb] = [groups[a]!, groups[b]!]
          const avg = sums[a]![b]! / (ga.members.length * gb.members.length)
          if (avg < bestAvg || (best && avg === bestAvg)) continue
          const lo = Math.min(ga.first ?? Infinity, gb.first ?? Infinity)
          const hi = Math.max(ga.last ?? -Infinity, gb.last ?? -Infinity)
          if (hi - lo > opts.maxGapDays) continue
          best = [a, b]
          bestAvg = avg
        }
      if (!best) break
      const [a, b] = best
      const [ga, gb] = [groups[a]!, groups[b]!]
      const merged: Group = {
        members: [...ga.members, ...gb.members].sort((x, y) => x - y),
        first: Math.min(ga.first ?? Infinity, gb.first ?? Infinity),
        last: Math.max(ga.last ?? -Infinity, gb.last ?? -Infinity),
      }
      if (!Number.isFinite(merged.first)) merged.first = merged.last = undefined
      const keep = groups.map((_, i) => i).filter((i) => i !== a && i !== b)
      const mergedRow = keep.map((i) => sums[a]![i]! + sums[b]![i]!)
      sums = [...keep.map((i, r) => [...keep.map((j) => sums[i]![j]!), mergedRow[r]!]), [...mergedRow, 0]]
      groups = [...keep.map((i) => groups[i]!), merged]
    }

    for (const g of groups) {
      if (g.members.length < opts.minSize || g.members.length > opts.maxSize) continue
      const days = g.members.flatMap((i) => photos[i]!.day ?? []).sort()
      clusters.push({ category, keys: g.members.map((i) => photos[i]!.key), from: days[0], to: days.at(-1) })
    }
  }
  const firstIndex = new Map(photos.map((ph, i) => [ph.key, i]))
  return Result.success(clusters.sort((x, y) => firstIndex.get(x.keys[0]!)! - firstIndex.get(y.keys[0]!)!))
}
