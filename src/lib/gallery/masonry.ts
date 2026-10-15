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
