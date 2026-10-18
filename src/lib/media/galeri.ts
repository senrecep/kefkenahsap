import { routing } from '@/i18n/routing'

import type { I18nSync } from './i18nSync'
import type { MediaStatus } from './publish'
import { approvalTags, type TagRef } from './taxonomy'

/** Target size for the client-side downscale: long edge ≤ max, never upscaled. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

export type BadgeTone = 'ok' | 'wait' | 'busy' | 'muted' | 'bad'

/** #216: a photo no save has touched for this long has no tagImage job working on it any more (a job takes seconds; retries are queued minutes apart). */
export const AI_STALL_MS = 15 * 60_000

type AiState = { status?: MediaStatus | null; aiSuggestion?: unknown; alt?: string | null; aiFailure?: unknown; updatedAt?: string | null }

/**
 * #216: a pending photo with nothing to review (no suggestion, no alt text) whose tagImage job failed (aiFailure, written
 * by the job) or is gone (the row is deleted on completion, so only the clock can tell): shows "AI önerisi alınamadı"
 * and the retry button instead of waiting forever.
 */
export function aiStalled(doc: AiState, nowMs: number): boolean {
  if (doc.status === 'approved' || doc.status === 'hidden' || doc.aiSuggestion || doc.alt?.trim()) return false
  if (doc.aiFailure) return true
  const touched = doc.updatedAt ? Date.parse(doc.updatedAt) : NaN
  return nowMs - touched >= AI_STALL_MS
}

/** Status badge shown on each Galeri card. A pending image is "ready to review" once it has an AI suggestion or alt text. */
export function mediaBadge(doc: AiState, nowMs: number): { tone: BadgeTone; label: string } {
  if (doc.status === 'approved') return { tone: 'ok', label: 'Yayında' }
  if (doc.status === 'hidden') return { tone: 'muted', label: 'Gizli' }
  if (doc.aiSuggestion || doc.alt?.trim()) return { tone: 'wait', label: 'Onay bekliyor' }
  if (aiStalled(doc, nowMs)) return { tone: 'bad', label: 'AI önerisi alınamadı' }
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

export type AiReview = { confidence?: number; categoryAgrees?: boolean; doubtful: boolean; addTags: string[] }

/**
 * #192: what a Galeri card shows about the AI suggestion: its confidence and category match (only when the suggestion has
 * them), whether to flag it (confidence under 0.5, or the photo does not fit its category), and the names of the tags
 * "Onayla" will attach (approvalTags, the rule the approve hook runs). No suggestion → null.
 */
export function aiReview(doc: { aiSuggestion?: unknown; tags?: (number | { id: number })[] | null }, tags: TagRef[]): AiReview | null {
  const s = doc.aiSuggestion
  if (!s || typeof s !== 'object') return null
  const { confidence, categoryAgrees } = s as { confidence?: unknown; categoryAgrees?: unknown }
  const current = (doc.tags ?? []).map((t) => (typeof t === 'number' ? t : t.id))
  const added = approvalTags(s, tags, current).filter((id) => !current.includes(id))
  return {
    ...(typeof confidence === 'number' && { confidence }),
    ...(typeof categoryAgrees === 'boolean' && { categoryAgrees }),
    doubtful: (typeof confidence === 'number' && confidence < 0.5) || categoryAgrees === false,
    addTags: added.map((id) => tags.find((t) => t.id === id)!.name),
  }
}

/** #203: the card line about the other languages, from the photo's stored i18nSync state (no hashing in the browser). */
export function localesStatus(sync: I18nSync | null | undefined): { tone: BadgeTone; label: string } {
  if (sync?.pending?.length) return { tone: 'busy', label: 'TR değişti, çeviriliyor…' }
  const names = (reason: string) => routing.locales.filter((l) => sync?.stale?.[l] === reason).map((l) => l.toUpperCase())
  const parts = [
    [names('edited'), 'Elle düzenlendi, güncel olmayabilir'],
    [names('failed'), 'Çevrilemedi, eski olabilir'],
  ] as const
  const label = parts.filter(([l]) => l.length).map(([l, text]) => `${text}: ${l.join(', ')}`).join(' · ')
  return label ? { tone: 'wait', label } : { tone: 'ok', label: 'Diller: güncel' }
}
