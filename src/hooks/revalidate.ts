import { revalidateTag } from 'next/cache'
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, GlobalAfterChangeHook } from 'payload'

/** Invalidate cached public data when content changes (no-op outside a Next.js runtime, e.g. seed scripts). */
const bust = (tags: string[]) => {
  for (const t of tags) {
    try {
      revalidateTag(t, 'max')
    } catch {
      // Not inside Next (CLI/seed/tests): nothing cached to invalidate.
    }
  }
}

export const revalidateAfterChange =
  (...tags: string[]): CollectionAfterChangeHook =>
  ({ doc }) => {
    bust(tags)
    return doc
  }
export const revalidateAfterDelete =
  (...tags: string[]): CollectionAfterDeleteHook =>
  ({ doc }) => {
    bust(tags)
    return doc
  }
export const revalidateGlobal =
  (...tags: string[]): GlobalAfterChangeHook =>
  ({ doc }) => {
    bust(tags)
    return doc
  }
