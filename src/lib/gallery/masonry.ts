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
