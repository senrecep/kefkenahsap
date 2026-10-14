import type { FieldHook } from 'payload'
import { Result } from 'tsentials/result'

import { slugify } from '@/lib/slug'

/** Fills an empty localized slug from another field of the same locale. */
export const slugFrom =
  (source: string): FieldHook =>
  ({ value, siblingData, operation, originalDoc, req }) => {
    if (typeof value === 'string' && value.trim()) {
      const r = slugify(value, undefined, req?.locale ?? undefined)
      return Result.isSuccess(r) ? r.value : value
    }
    // Once a document has a slug, a name change must not silently move its URL.
    if (operation === 'update' && originalDoc?.slug && value === undefined) return value
    const from = siblingData?.[source]
    if (typeof from !== 'string') return value
    const r = slugify(from, undefined, req?.locale ?? undefined)
    return Result.isSuccess(r) ? r.value : value
  }
