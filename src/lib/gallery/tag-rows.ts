/** A tag earns its gallery chip from this many approved photos (taxonomy v0's 5-photo rule, #171). */
export const MIN_TAG_PHOTOS = 5
/** Product types shown before "more filters": the rest wait behind the disclosure (#178). */
export const TOP_TYPES = 8

/** One approved photo: its service (category id) and tag ids. */
export type PhotoTags = { category: number | null; tags: number[] }

/**
 * Splits the gallery tags into the visible product types, the product types behind "more", and every other axis.
 * Counts run over the selected service's photos only (all photos without one). A tag shows from `min` photos, or while
 * it is the active filter (so it can be cleared), so a chip never leads to an empty gallery. Types go most common
 * first (ties keep input order), the top `top` visible plus the active one; the rest and the other axes keep input
 * (alphabetical) order, which scans better in a long list.
 */
export function galleryTagRows<T extends { id: number; slug?: string | null; axis: string }>(
  tags: T[],
  photos: PhotoTags[],
  { active, category, min = MIN_TAG_PHOTOS, top = TOP_TYPES }: { active?: string; category?: number; min?: number; top?: number } = {},
): { types: T[]; moreTypes: T[]; others: T[] } {
  const count = new Map<number, number>()
  for (const p of photos) {
    if (category !== undefined && p.category !== category) continue
    for (const id of new Set(p.tags)) count.set(id, (count.get(id) ?? 0) + 1)
  }
  const n = (t: T) => count.get(t.id) ?? 0
  const isActive = (t: T) => active !== undefined && t.slug === active
  const shown = tags.filter((t) => n(t) >= min || isActive(t))
  const ranked = shown.filter((t) => t.axis === 'type').sort((x, y) => n(y) - n(x))
  const types = ranked.filter((t, i) => i < top || isActive(t))
  return {
    types,
    moreTypes: shown.filter((t) => t.axis === 'type' && !types.includes(t)),
    others: shown.filter((t) => t.axis !== 'type'),
  }
}

/** The services (category ids) with an approved photo carrying `tagId`: a service chip keeps the tag only into these. */
export function tagCategories(photos: PhotoTags[], tagId: number): number[] {
  return [...new Set(photos.flatMap((p) => (p.category !== null && p.tags.includes(tagId) ? [p.category] : [])))]
}
