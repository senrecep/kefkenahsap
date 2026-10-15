import type { MediaStatus } from './publish'

/** Target size for the client-side downscale: long edge ≤ max, never upscaled. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

export type BadgeTone = 'ok' | 'wait' | 'busy' | 'muted'

/** Status badge shown on each Galeri card. A pending image is "ready to review" once it has an AI suggestion or alt text. */
export function mediaBadge(doc: { status?: MediaStatus | null; aiSuggestion?: unknown; alt?: string | null }): {
  tone: BadgeTone
  label: string
} {
  if (doc.status === 'approved') return { tone: 'ok', label: 'Yayında' }
  if (doc.status === 'hidden') return { tone: 'muted', label: 'Gizli' }
  if (doc.aiSuggestion || doc.alt?.trim()) return { tone: 'wait', label: 'Onay bekliyor' }
  return { tone: 'busy', label: 'AI hazırlıyor…' }
}

type Orderable = { id: number | string; _media_media_order?: string | null }

/**
 * Moves list[from] to index `to` and builds the matching Payload `/api/reorder` request:
 * the item lands right before (less) or after (greater) the item currently at `to`.
 */
export function reorder<T extends Orderable>(
  list: readonly T[],
  from: number,
  to: number,
): { next: T[]; request: { id: T['id']; newKeyWillBe: 'greater' | 'less'; target: { id: T['id']; key: string | null } } } | null {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return null
  const target = list[to]!
  const next = list.filter((_, i) => i !== from)
  next.splice(to, 0, list[from]!)
  return {
    next,
    request: {
      id: list[from]!.id,
      newKeyWillBe: to > from ? 'greater' : 'less',
      target: { id: target.id, key: target._media_media_order ?? null },
    },
  }
}

/** Page size of the Galeri media query; a full page means more photos may exist than are listed. */
export const MEDIA_LIMIT = 200
export const isTruncated = (count: number) => count >= MEDIA_LIMIT

export type StatusFilter = MediaStatus | 'all'
export type StatusCounts = Record<StatusFilter, number>

/** Per-status totals for the Galeri filter chips; a missing status is the collection default, pending. */
export function statusCounts(list: readonly { status?: MediaStatus | null }[]): StatusCounts {
  const counts: StatusCounts = { pending: 0, approved: 0, hidden: 0, all: list.length }
  for (const d of list) counts[d.status ?? 'pending']++
  return counts
}

/** Galeri opens on the photos that wait for approval, if any. */
export const initialFilter = (counts: StatusCounts): StatusFilter => (counts.pending > 0 ? 'pending' : 'all')
