import { describe, expect, it } from 'vitest'

import { fitWithin, initialFilter, isTruncated, MEDIA_LIMIT, mediaBadge, reorder, statusCounts } from './galeri'

describe('fitWithin (client downscale to a 2560px long edge, PLAN §4)', () => {
  it('scales a landscape photo so the long edge is 2560', () => {
    // 4032×3024 (12 MP phone): 3024 × 2560/4032 = 1920
    expect(fitWithin(4032, 3024, 2560)).toEqual({ width: 2560, height: 1920 })
  })

  it('scales a portrait photo by its height', () => {
    // 3000×4000: 3000 × 2560/4000 = 1920
    expect(fitWithin(3000, 4000, 2560)).toEqual({ width: 1920, height: 2560 })
  })

  it('never upscales a small image', () => {
    expect(fitWithin(800, 600, 2560)).toEqual({ width: 800, height: 600 })
  })

  it('rounds to whole pixels', () => {
    // 5000×3333: 3333 × 2560/5000 = 1706.496 → 1706
    expect(fitWithin(5000, 3333, 2560)).toEqual({ width: 2560, height: 1706 })
  })
})

describe('mediaBadge (status → Turkish badge)', () => {
  it('maps approved and hidden directly', () => {
    expect(mediaBadge({ status: 'approved' })).toEqual({ tone: 'ok', label: 'Yayında' })
    expect(mediaBadge({ status: 'hidden' })).toEqual({ tone: 'muted', label: 'Gizli' })
  })

  it('shows "AI hazırlıyor…" for a pending image with no suggestion and no alt yet', () => {
    expect(mediaBadge({ status: 'pending' })).toEqual({ tone: 'busy', label: 'AI hazırlıyor…' })
    expect(mediaBadge({ status: 'pending', aiSuggestion: null, alt: '' })).toEqual({ tone: 'busy', label: 'AI hazırlıyor…' })
  })

  it('shows "Onay bekliyor" once there is a suggestion or alt text to review', () => {
    expect(mediaBadge({ status: 'pending', aiSuggestion: { at: '2026-10-14' } })).toEqual({ tone: 'wait', label: 'Onay bekliyor' })
    expect(mediaBadge({ status: 'pending', alt: 'Teras deck' })).toEqual({ tone: 'wait', label: 'Onay bekliyor' })
  })

  it('treats a missing status as pending (field default)', () => {
    expect(mediaBadge({ status: null }).label).toBe('AI hazırlıyor…')
  })
})

describe('reorder (optimistic list + Payload /api/reorder request)', () => {
  const list = [
    { id: 1, _media_media_order: 'a0' },
    { id: 2, _media_media_order: 'a1' },
    { id: 3, _media_media_order: 'a2' },
  ]
  const ids = (l: { id: number }[]) => l.map((d) => d.id)

  it('moving up places the item before its upper neighbour (less than it)', () => {
    const r = reorder(list, 2, 1)!
    expect(ids(r.next)).toEqual([1, 3, 2])
    expect(r.request).toEqual({ id: 3, newKeyWillBe: 'less', target: { id: 2, key: 'a1' } })
  })

  it('moving down places the item after its lower neighbour (greater than it)', () => {
    const r = reorder(list, 0, 1)!
    expect(ids(r.next)).toEqual([2, 1, 3])
    expect(r.request).toEqual({ id: 1, newKeyWillBe: 'greater', target: { id: 2, key: 'a1' } })
  })

  it('a drag across several slots targets the item at the drop index', () => {
    const r = reorder(list, 0, 2)!
    expect(ids(r.next)).toEqual([2, 3, 1])
    expect(r.request).toEqual({ id: 1, newKeyWillBe: 'greater', target: { id: 3, key: 'a2' } })
    const up = reorder(list, 2, 0)!
    expect(ids(up.next)).toEqual([3, 1, 2])
    expect(up.request).toEqual({ id: 3, newKeyWillBe: 'less', target: { id: 1, key: 'a0' } })
  })

  it('returns null for a no-op or out-of-range move and leaves the input untouched', () => {
    expect(reorder(list, 0, -1)).toBeNull()
    expect(reorder(list, 2, 3)).toBeNull()
    expect(reorder(list, 1, 1)).toBeNull()
    expect(ids(list)).toEqual([1, 2, 3])
  })

  it('returns null when the moved or target item is gone from a refreshed list (findIndex → -1)', () => {
    // Retry after Payload's "initial migration": a vanished item must abort, not resend a stale request.
    expect(reorder(list, -1, 1)).toBeNull()
    expect(reorder(list, 1, -1)).toBeNull()
  })
})

describe('isTruncated (Galeri lists at most MEDIA_LIMIT photos)', () => {
  it('flags a full page as possibly truncated', () => {
    expect(MEDIA_LIMIT).toBe(200)
    expect(isTruncated(200)).toBe(true)
    expect(isTruncated(199)).toBe(false)
    expect(isTruncated(0)).toBe(false)
  })
})

describe('reorder to the ends (Galeri "En başa" / "En sona")', () => {
  const list = [
    { id: 1, _media_media_order: 'a0' },
    { id: 2, _media_media_order: 'a1' },
    { id: 3, _media_media_order: 'a2' },
  ]
  it('moves the last item before the first, and the first item after the last', () => {
    expect(reorder(list, 2, 0)!.next.map((d) => d.id)).toEqual([3, 1, 2])
    expect(reorder(list, 0, 2)!.next.map((d) => d.id)).toEqual([2, 3, 1])
  })
  it('is a no-op for "En başa" on the first item', () => {
    expect(reorder(list, 0, 0)).toBeNull()
  })
})

describe('statusCounts + initialFilter (Galeri filter chips)', () => {
  // Two pending (one still waiting for AI, one with alt text), one approved, one hidden.
  const list = [
    { status: 'pending' as const },
    { status: 'pending' as const, alt: 'Ahşap pergola' },
    { status: 'approved' as const },
    { status: 'hidden' as const },
  ]
  it('counts every pending photo, including those the AI is still preparing', () => {
    expect(statusCounts(list)).toEqual({ pending: 2, approved: 1, hidden: 1, all: 4 })
  })
  it('treats a missing status as pending (the collection default)', () => {
    expect(statusCounts([{}])).toEqual({ pending: 1, approved: 0, hidden: 0, all: 1 })
  })
  it('opens on "Onay bekliyor" when something waits, else on "Tümü"', () => {
    expect(initialFilter({ pending: 2, approved: 1, hidden: 1, all: 4 })).toBe('pending')
    expect(initialFilter({ pending: 0, approved: 3, hidden: 0, all: 3 })).toBe('all')
  })
})
