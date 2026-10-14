import { revalidateTag } from 'next/cache'
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, GlobalAfterChangeHook } from 'payload'

/** Invalidate cached public data when content changes (no-op outside a Next.js runtime, e.g. seed scripts). */
const bust = (tags: string[]) => {
  for (const t of tags) {
    try {
      revalidateTag(t, 'max')
    } catch (err) {
      // Outside a Next runtime (seed/CLI/tests) there is no cache to invalidate; anything else is a real failure.
      if (!/static generation store|incrementalCache|outside a request/i.test(String(err))) console.error('revalidateTag failed', t, err)
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
