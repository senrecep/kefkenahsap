import { Result, type VoidResult } from 'tsentials/result'
import { Err } from 'tsentials/errors'

export type MediaStatus = 'pending' | 'approved' | 'hidden'
export const ALT_MAX = 125

/** Only approved images are public, and an approved image must carry Turkish (default-locale) alt text. */
export function checkPublishable(input: { status: MediaStatus; alt: Partial<Record<string, string | null>> }): VoidResult {
  if (input.status !== 'approved') return Result.ok()
  const tr = input.alt.tr?.trim() ?? ''
  if (!tr) return Result.failure(Err.validation('Media.AltRequired', 'Onaylanan görselin Türkçe alt metni olmalı.'))
  if (tr.length > ALT_MAX)
    return Result.failure(Err.validation('Media.AltTooLong', `Alt metin en fazla ${ALT_MAX} karakter olmalı.`))
  return Result.ok()
}

// Fields the site never renders: AI bookkeeping (jobs write these on approved photos too) and the save timestamp.
const INTERNAL = new Set(['aiSuggestion', 'i18nSync', 'updatedAt'])
const publicPart = (doc: Record<string, unknown>) => JSON.stringify(Object.entries(doc).filter(([k]) => !INTERNAL.has(k)))

/**
 * #211: does this media save change anything the public pages show? Only approved photos are public, so a photo that is
 * approved neither before nor after cannot; an approved one can unless only internal fields moved. Saves that can't
 * skip the tag revalidation, which would otherwise re-render every cached page on each AI job write.
 */
export function changeIsPublic(doc: Record<string, unknown>, previousDoc: Record<string, unknown> | undefined): boolean {
  if (doc.status !== 'approved' && previousDoc?.status !== 'approved') return false
  return !previousDoc || doc.status !== previousDoc.status || publicPart(doc) !== publicPart(previousDoc)
}
