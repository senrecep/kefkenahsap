/** A tag earns its gallery chip from this many approved photos (taxonomy v0's 5-photo rule, #171). */
export const MIN_TAG_PHOTOS = 5

/**
 * Splits the gallery tags into the product-type row and the row of every other axis. `photoTags` is each approved
 * photo's tag ids. A tag shows from `min` photos, or while it is the active filter (so it can be cleared), so a tag
 * no photo carries yet never leads to an empty gallery. Input order is kept.
 */
export function galleryTagRows<T extends { id: number; slug?: string | null; axis: string }>(
  tags: T[],
  photoTags: number[][],
  active?: string,
  min = MIN_TAG_PHOTOS,
): { types: T[]; others: T[] } {
  const count = new Map<number, number>()
  for (const ids of photoTags) for (const id of new Set(ids)) count.set(id, (count.get(id) ?? 0) + 1)
  const shown = tags.filter((t) => (count.get(t.id) ?? 0) >= min || (active !== undefined && t.slug === active))
  return { types: shown.filter((t) => t.axis === 'type'), others: shown.filter((t) => t.axis !== 'type') }
}
