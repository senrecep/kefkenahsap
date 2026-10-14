import type { FieldHook } from 'payload'
import { Result } from 'tsentials/result'

import { slugify } from '@/lib/slug'

/** Fills an empty localized slug from another field of the same locale. */
export const slugFrom =
  (source: string): FieldHook =>
  ({ value, siblingData }) => {
    if (typeof value === 'string' && value.trim()) {
      const r = slugify(value)
      return Result.isSuccess(r) ? r.value : value
    }
    const from = siblingData?.[source]
    if (typeof from !== 'string') return value
    const r = slugify(from)
    return Result.isSuccess(r) ? r.value : value
  }
