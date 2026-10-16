/** A product type earns its gallery chip from this many approved photos (taxonomy v0's 5-photo rule, #171). */
export const MIN_TYPE_PHOTOS = 5

/**
 * Splits the gallery tags into the product-type row and the row of every other axis. `photoTags` is each approved
 * photo's tag ids. A type shows from `min` photos, or while it is the active filter (so it can be cleared); the other
 * axes keep showing as before. Input order is kept.
 */
export function galleryTagRows<T extends { id: number; slug?: string | null; axis: string }>(
  tags: T[],
  photoTags: number[][],
  active?: string,
  min = MIN_TYPE_PHOTOS,
): { types: T[]; others: T[] } {
  const count = new Map<number, number>()
  for (const ids of photoTags)
    for (const id of new Set(ids)) count.set(id, (count.get(id) ?? 0) + 1)
  return {
    types: tags.filter(
      (t) =>
        t.axis === 'type' &&
        ((count.get(t.id) ?? 0) >= min || (active !== undefined && t.slug === active)),
    ),
    others: tags.filter((t) => t.axis !== 'type'),
  }
}
