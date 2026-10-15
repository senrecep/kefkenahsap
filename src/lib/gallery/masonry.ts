export type Box = { width?: number | null; height?: number | null }

/**
 * Masonry columns from known aspect ratios: each item goes to the shortest column so far (ties → lowest index).
 * Greedy and order-preserving, so appending items never moves the ones already placed (no layout shift).
 * Returns item indexes per column.
 */
export function distribute(items: readonly Box[], count: number): number[][] {
  const columns: number[][] = Array.from({ length: count }, () => [])
  const heights = new Array<number>(count).fill(0)
  items.forEach((item, i) => {
    const col = heights.indexOf(Math.min(...heights))
    columns[col]!.push(i)
    heights[col]! += item.width && item.height ? item.height / item.width : 1
  })
  return columns
}

/**
 * The card most likely to be the first screen's LCP: the tallest (columns share a width) among the first `rows` of
 * each column; a tie goes to the earlier one in document order (column by column), which is what Chrome reports.
 */
export function largestFirstScreenItem(items: readonly Box[], columns: readonly number[][], rows: number): number | undefined {
  const ratio = (b: Box) => (b.width && b.height ? b.height / b.width : 1)
  let best: number | undefined
  for (const col of columns) for (const i of col.slice(0, rows)) if (best === undefined || ratio(items[i]!) > ratio(items[best]!)) best = i
  return best
}

/**
 * For a fixed set (no feed appends): drop trailing tiles from each column while that brings its bottom closer to the
 * shortest column's, so the grid ends on a near-even line. A column always keeps its first tile.
 */
export function trimColumns(items: readonly Box[], columns: readonly number[][]): number[][] {
  const ratio = (b: Box) => (b.width && b.height ? b.height / b.width : 1)
  const heights = columns.map((col) => col.reduce((h, i) => h + ratio(items[i]!), 0))
  const target = Math.min(...heights)
  return columns.map((col, c) => {
    const kept = [...col]
    let h = heights[c]!
    while (kept.length > 1) {
      const last = ratio(items[kept.at(-1)!]!)
      if (Math.abs(h - last - target) >= Math.abs(h - target)) break
      kept.pop()
      h -= last
    }
    return kept
  })
}

type Score = (columns: number[][]) => number

/**
 * Steepest descent over the columns: each round takes the single move or swap of tiles (never a column's first tile:
 * the top row is the curated lead) that lowers `score` most, strictly; on a tie a move beats a swap, then the first in
 * feed order. Columns keep feed order. Ends when nothing helps (the score strictly falls, so it always ends).
 */
function improve(columns: readonly number[][], score: Score): number[][] {
  let cols = columns.map((c) => [...c])
  let current = score(cols)
  const sorted = (c: number[]) => c.sort((p, q) => p - q)
  for (;;) {
    let best: number[][] | null = null
    let bestScore = current
    const consider = (next: number[][]) => {
      const v = score(next)
      if (v < bestScore - 1e-9) [best, bestScore] = [next, v]
    }
    for (let a = 0; a < cols.length; a++)
      for (let b = 0; b < cols.length; b++)
        for (const x of a === b ? [] : cols[a]!.slice(1))
          consider(cols.map((c, k) => (k === a ? c.filter((i) => i !== x) : k === b ? sorted([...c, x]) : c)))
    for (let a = 0; a < cols.length; a++)
      for (let b = a + 1; b < cols.length; b++)
        for (const x of cols[a]!.slice(1))
          for (const y of cols[b]!.slice(1))
            consider(cols.map((c, k) => (k === a ? sorted(c.map((i) => (i === x ? y : i))) : k === b ? sorted(c.map((i) => (i === y ? x : i))) : c)))
    if (!best) return cols
    cols = best
    current = bestScore
  }
}

const heightsOf = (items: readonly Box[], columns: readonly number[][], gap: number) =>
  columns.map((c) => c.reduce((h, i) => h + (items[i]!.width && items[i]!.height ? items[i]!.height! / items[i]!.width! : 1) + gap, 0))

/**
 * Evens the columns by moving or swapping tiles between them, lowering the sum of squared column heights. `gap`: the
 * grid gap in units of column width, per tile.
 */
export const balanceColumns = (items: readonly Box[], columns: readonly number[][], gap = 0.05): number[][] =>
  improve(columns, (cols) => heightsOf(items, cols, gap).reduce((s, h) => s + h * h, 0))

// What one hidden photo is worth in uneven bottom edge (column widths): about a fifth of a tile row.
const HIDDEN_COST = 0.3

/**
 * For a fixed set (no feed appends), #156: balances, then rearranges for the most even bottom edge after trimColumns
 * (ragged edge plus HIDDEN_COST per hidden photo), and trims. So the grid ends on a near-even line while hiding as few
 * chosen photos as it can, and never more than trimColumns alone.
 */
export function evenColumns(items: readonly Box[], columns: readonly number[][], gap = 0.05): number[][] {
  const ragged: Score = (cols) => {
    const kept = trimColumns(items, cols)
    const h = heightsOf(items, kept, gap)
    return Math.max(...h) - Math.min(...h) + HIDDEN_COST * (items.length - kept.flat().length)
  }
  const even = trimColumns(items, improve(balanceColumns(items, columns, gap), ragged))
  // The trade-off above may hide a photo for a straighter edge; never more than trimming alone would (#161 review).
  const plain = trimColumns(items, columns)
  return even.flat().length >= plain.flat().length ? even : plain
}
