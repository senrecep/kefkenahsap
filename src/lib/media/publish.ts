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
