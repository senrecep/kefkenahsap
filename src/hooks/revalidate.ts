import { revalidateTag } from 'next/cache.js' // explicit path: Playwright imports this config under plain Node ESM
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, GlobalAfterChangeHook } from 'payload'

/** Invalidate cached public data when content changes (no-op outside a Next.js runtime, e.g. seed scripts). */
const bust = (tags: string[]) => {
  for (const t of tags) {
    try {
      // #192 read-your-writes: { expire: 0 } makes the next request render fresh instead of serving the old page once
      // ('max' is stale-while-revalidate). updateTag would do it too, but only in Server Actions, and admin saves come
      // through Payload's REST route handlers (node_modules/next/dist/docs/.../revalidateTag.md).
      revalidateTag(t, { expire: 0 })
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
