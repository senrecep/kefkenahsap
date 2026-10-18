'use client'

import { CheckboxInput } from '@payloadcms/ui'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { Media } from '@/payload-types'
import {
  aiReview,
  fitWithin,
  initialFilter,
  isTruncated,
  MEDIA_LIMIT,
  mediaBadge,
  reorder,
  type StatusFilter,
  statusCounts,
} from '@/lib/media/galeri'
import type { I18nSync } from '@/lib/media/i18nSync'
import type { TagRef } from '@/lib/media/taxonomy'
import { MediaLocalesSync } from './ai/MediaLocalesSync'
import './galeri.css'

type Option = { id: number; name: string }
type Item = Pick<Media, 'id' | 'status' | 'title' | 'alt' | 'aiSuggestion' | 'i18nSync' | 'tags' | 'url' | 'filename' | 'sizes' | '_media_media_order'>
type QueueEntry = { key: string; name: string; state: 'waiting' | 'working' | 'done' | 'error'; message?: string }

const MAX_EDGE = 2560
const percent = new Intl.NumberFormat('tr', { style: 'percent' })
const STORE_KEY = 'galeri.secim'
const NETWORK_ERROR = 'Bağlantı kurulamadı. İnternetinizi kontrol edip tekrar deneyin.'
const FILTERS: [StatusFilter, string, string][] = [
  ['pending', 'Onay bekliyor', 'Onay bekleyen fotoğraf yok.'],
  ['approved', 'Yayında', 'Yayında fotoğraf yok.'],
  ['hidden', 'Gizli', 'Gizli fotoğraf yok.'],
  ['all', 'Tümü', ''],
]

/** fetch + Payload error unwrapping; throws an Error with a Turkish, user-facing message. */
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, { credentials: 'include', ...init })
  } catch {
    throw new Error(NETWORK_ERROR)
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body?.errors?.[0]?.message || body?.error || 'İşlem tamamlanamadı. Tekrar deneyin.')
  return body as T
}

const toBlob = (canvas: HTMLCanvasElement, type: string) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9))

/** Downscale to ≤2560px and re-encode; drawing through a canvas drops EXIF (GPS included). */
async function prepare(file: File): Promise<File> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('Bu fotoğraf açılamadı. Başka bir fotoğraf seçin.')
  }
  const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_EDGE)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  // Safari cannot encode WebP and silently returns PNG; JPEG keeps the upload small there.
  let blob = await toBlob(canvas, 'image/webp')
  if (blob?.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg')
  if (!blob) throw new Error('Fotoğraf hazırlanamadı. Tekrar deneyin.')
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'foto'}.${ext}`, { type: blob.type })
}

function readStored(): { category?: number; project?: number } {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function GaleriClient({ categories, projects, tags }: { categories: Option[]; projects: Option[]; tags: TagRef[] }) {
  const [category, setCategory] = useState<number | undefined>(categories[0]?.id)
  const [project, setProject] = useState<number | undefined>()
  // #169: uploads get the site watermark unless the editor opts out for this batch.
  const [skipWatermark, setSkipWatermark] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [queue, setQueue] = useState<QueueEntry[]>([])
  const [editing, setEditing] = useState<number | null>(null)
  const [cardError, setCardError] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState<number | null>(null)
  const [moving, setMoving] = useState(false)
  // Read synchronously: a second tap can land before React re-renders with `moving` set.
  const movingRef = useRef(false)
  const [filter, setFilter] = useState<StatusFilter>('all')
  // Photos changed under the current filter stay in view until the filter changes (no card vanishes on "Onayla").
  const [kept, setKept] = useState<ReadonlySet<number>>(new Set())
  const [sorting, setSorting] = useState(false)
  const dragFrom = useRef<number | null>(null)
  const thumbs = useRef(new Map<number, HTMLButtonElement>())
  // Files picked while a run is in progress join the same strictly sequential run.
  const pending = useRef<{ file: File; key: string; target: { category: number; project?: number } }[]>([])
  const uploading = useRef(false)
  // The upload loop outlives re-renders; it reads the current category from a ref.
  const categoryRef = useRef(category)
  useEffect(() => {
    categoryRef.current = category
  }, [category])

  // Restore the last choice after hydration (localStorage is client-only).
  useEffect(() => {
    const stored = readStored()
    if (categories.some((c) => c.id === stored.category)) setCategory(stored.category)
    if (projects.some((p) => p.id === stored.project)) setProject(stored.project)
  }, [categories, projects])

  // Saved on user change only: a mount-time write would clobber the stored choice before it is restored.
  function choose(next: { category?: number; project?: number }) {
    setCategory(next.category)
    setProject(next.project)
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(next))
    } catch {
      // Private mode / blocked storage: remembering the choice is a convenience only.
    }
  }

  const load = useCallback(async (id: number) => {
    const qs = `where[category][equals]=${id}&sort=_media_media_order&limit=${MEDIA_LIMIT}&depth=0&locale=tr`
    const { docs } = await api<{ docs: Item[] }>(`/api/media?${qs}`)
    return docs
  }, [])

  useEffect(() => {
    if (!category) return
    let live = true
    setLoading(true)
    setLoadError('')
    load(category)
      .then((docs) => {
        if (!live) return
        setItems(docs)
        // Chosen once per category load; later edits must not switch the view under the user.
        setFilter(initialFilter(statusCounts(docs)))
        setKept(new Set())
        setSorting(false)
      })
      .catch((e: Error) => live && setLoadError(e.message))
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [category, load])

  function showFilter(next: StatusFilter) {
    setFilter(next)
    setKept(new Set())
  }

  const setEntry = (key: string, patch: Partial<QueueEntry>) =>
    setQueue((q) => q.map((e) => (e.key === key ? { ...e, ...patch } : e)))

  async function upload(files: FileList | null) {
    if (!files?.length || !category) return
    const target = { category, project, ...(skipWatermark && { skipWatermark }) }
    const entries = Array.from(files).map((file, i) => ({ file, key: `${Date.now()}-${i}`, target }))
    setQueue((q) => [
      ...(uploading.current ? q : q.filter((e) => e.state !== 'done')),
      ...entries.map(({ key, file }) => ({ key, name: file.name, state: 'waiting' as const })),
    ])
    pending.current.push(...entries)
    if (uploading.current) return
    uploading.current = true
    // One at a time keeps phones responsive and memory bounded.
    for (let next = pending.current.shift(); next; next = pending.current.shift()) {
      const { file, key, target } = next
      setEntry(key, { state: 'working' })
      try {
        const form = new FormData()
        form.append('file', await prepare(file))
        form.append('_payload', JSON.stringify(target))
        const { doc } = await api<{ doc: Item }>('/api/media?depth=0&locale=tr', { method: 'POST', body: form })
        setEntry(key, { state: 'done' })
        if (target.category === categoryRef.current) setItems((list) => [...list, doc])
      } catch (e) {
        setEntry(key, { state: 'error', message: (e as Error).message })
      }
    }
    uploading.current = false
  }

  function closeEditor(id: number) {
    setEditing(null)
    thumbs.current.get(id)?.focus()
  }

  async function patch(id: number, data: Partial<Pick<Media, 'status' | 'title' | 'alt'>>) {
    setBusy(id)
    setCardError(({ [id]: _, ...rest }) => rest)
    try {
      const { doc } = await api<{ doc: Item }>(`/api/media/${id}?depth=0&locale=tr`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      setItems((list) => list.map((m) => (m.id === id ? doc : m)))
      setKept((ids) => new Set(ids).add(id))
      return true
    } catch (e) {
      setCardError((errs) => ({ ...errs, [id]: (e as Error).message }))
      // Approval fails without Turkish alt text: open the editor right away.
      if (data.status === 'approved') setEditing(id)
      return false
    } finally {
      setBusy(null)
    }
  }

  /** #203: re-reads one photo after "Diğer dillere yeniden çevir", so its card shows the new language state. */
  async function refresh(id: number) {
    try {
      const doc = await api<Item>(`/api/media/${id}?depth=0&locale=tr`)
      setItems((list) => list.map((m) => (m.id === id ? doc : m)))
    } catch (e) {
      setCardError((errs) => ({ ...errs, [id]: (e as Error).message }))
    }
  }

  async function move(from: number, to: number) {
    const r = reorder(items, from, to)
    if (!r || movingRef.current || !category) return
    const before = items
    setItems(r.next)
    movingRef.current = true
    setMoving(true)
    const fail = (message: string) => {
      setItems(before)
      setCardError((errs) => ({ ...errs, [r.request.id]: `Sıra değiştirilemedi. ${message}` }))
    }
    try {
      const send = () =>
        api<{ message?: string }>('/api/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            collectionSlug: 'media',
            docsToMove: [r.request.id],
            newKeyWillBe: r.request.newKeyWillBe,
            orderableFieldName: '_media_media_order',
            target: r.request.target,
          }),
        })
      // A target without an order key makes Payload assign keys ("initial migration") instead of moving.
      if ((await send()).message === 'initial migration') {
        const fresh = await load(category)
        const again = reorder(fresh, fresh.findIndex((d) => d.id === r.request.id), fresh.findIndex((d) => d.id === r.request.target.id))
        if (!again) return fail('Liste değişmiş; sayfayı yenileyip tekrar deneyin.')
        Object.assign(r.request, again.request)
        await send()
      }
    } catch (e) {
      fail((e as Error).message)
      movingRef.current = false
      setMoving(false)
      return
    }
    // Saved. Fresh order keys arrive before the next move is allowed; the next move builds on them.
    // A failed refresh keeps the optimistic list (the move itself is saved), and a refresh for a category
    // the user has left since must not replace the one on screen.
    try {
      const fresh = await load(category)
      if (categoryRef.current === category) setItems(fresh)
    } catch {
      // Stale keys only; the shown order is the saved one.
    } finally {
      movingRef.current = false
      setMoving(false)
    }
  }

  if (!categories.length)
    return (
      <div className="galeri">
        <h1 className="galeri__title">Galeri</h1>
        <p className="galeri__note">
          Fotoğraf eklemek için önce bir kategori oluşturun.{' '}
          <Link href="/admin/collections/categories/create">Kategori ekle</Link>
        </p>
      </div>
    )

  const activeQueue = queue.filter((e) => e.state !== 'done')
  const doneCount = queue.filter((e) => e.state === 'done').length
  const counts = statusCounts(items)
  const truncated = isTruncated(items.length)
  const visible = items
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => filter === 'all' || (m.status ?? 'pending') === filter || kept.has(m.id))
  // Order is about the whole category: moving within a filtered subset would jump over hidden neighbours.
  const canMove = filter === 'all'
  const dragProps = (m: Item, i: number) => ({
    draggable: canMove && !moving && editing !== m.id,
    onDragStart: (e: React.DragEvent) => {
      // Firefox only starts a drag when data is set.
      e.dataTransfer.setData('text/plain', String(m.id))
      e.dataTransfer.effectAllowed = 'move'
      dragFrom.current = i
    },
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      if (dragFrom.current !== null) void move(dragFrom.current, i)
      dragFrom.current = null
    },
  })
  const nameOf = (m: Item) => m.title || m.filename || `Görsel ${m.id}`

  return (
    <div className="galeri">
      {/* Galeri edits Turkish texts only; the content-language switcher would suggest otherwise. */}
      <style>{'.localizer{display:none}'}</style>
      <h1 className="galeri__title">Galeri</h1>

      <div className="galeri__pickers">
        <label className="galeri__field">
          <span>Kategori</span>
          <select value={category ?? ''} onChange={(e) => choose({ category: Number(e.target.value), project })}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="galeri__field">
          <span>Proje (isteğe bağlı)</span>
          <select value={project ?? ''} onChange={(e) => choose({ category, project: e.target.value ? Number(e.target.value) : undefined })}>
            <option value="">Proje yok</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Payload's checkbox: same look as the Görseller form, and custom.scss gives it the 48px tap area. */}
      <div className="galeri__check">
        <CheckboxInput id="galeri-skip-watermark" checked={skipWatermark} onToggle={(e) => setSkipWatermark(e.target.checked)} label="Filigran ekleme" />
        <small>İşaretliyken yüklenen fotoğraflara &quot;kefkenahsap.com&quot; yazısı basılmaz.</small>
      </div>

      <label className="galeri__add">
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => {
            void upload(e.target.files)
            e.target.value = ''
          }}
        />
        <span aria-hidden="true">＋</span> Fotoğraf ekle
      </label>

      {/* Always mounted so screen readers announce updates. */}
      <section className="galeri__queue" aria-live="polite" aria-label="Yükleme durumu">
        {queue.length > 0 && (
          <>
            {doneCount > 0 && (
              <p className="galeri__queue-ok">
                {doneCount} fotoğraf yüklendi. <span>Yayına almak için “Onay bekliyor” listesinden onaylayın.</span>
              </p>
            )}
            <ul>
              {activeQueue.map((e) => (
                <li key={e.key} data-state={e.state}>
                  <span className="galeri__queue-name">{e.name}</span>
                  <span>
                    {e.state === 'waiting' && 'Sırada'}
                    {e.state === 'working' && 'Yükleniyor…'}
                    {e.state === 'error' && `Yüklenemedi: ${e.message}`}
                  </span>
                </li>
              ))}
            </ul>
            {activeQueue.length === 0 && (
              <div className="galeri__actions">
                {doneCount > 0 && (
                  <button
                    type="button"
                    className="galeri__btn galeri__btn--primary"
                    onClick={() => {
                      showFilter('pending')
                      setSorting(false)
                      setQueue([])
                    }}
                  >
                    Onay bekleyenleri göster
                  </button>
                )}
                <button type="button" className="galeri__btn" onClick={() => setQueue([])}>
                  Tamam
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {loadError && <p className="galeri__error">{loadError}</p>}
      {loading && <p className="galeri__note">Fotoğraflar yükleniyor…</p>}
      {isTruncated(items.length) && <p className="galeri__note">Yalnızca ilk {MEDIA_LIMIT} fotoğraf listeleniyor.</p>}
      {!loading && !loadError && items.length === 0 && <p className="galeri__note">Bu kategoride henüz fotoğraf yok.</p>}

      {items.length > 0 && !sorting && (
        <div className="galeri__toolbar">
          <div className="galeri__chips" role="group" aria-label="Duruma göre göster">
            {FILTERS.map(([key, label]) => (
              <button key={key} type="button" className="galeri__chip" aria-pressed={filter === key} onClick={() => showFilter(key)}>
                {label} <span className="galeri__count">{counts[key]}</span>
              </button>
            ))}
          </div>
          {items.length > 1 && (
            <button type="button" className="galeri__btn galeri__sort-toggle" onClick={() => setSorting(true)}>
              Sırala
            </button>
          )}
        </div>
      )}

      {sorting ? (
        <section className="galeri__sorting" aria-labelledby="galeri-sort-title">
          <div className="galeri__toolbar">
            <h2 id="galeri-sort-title" className="galeri__subtitle">
              Sıralama
            </h2>
            <button type="button" className="galeri__btn galeri__btn--primary galeri__sort-toggle" onClick={() => setSorting(false)}>
              Bitti
            </button>
          </div>
          <p className="galeri__note">
            Fotoğraflar sitede bu sırayla görünür. Her değişiklik hemen kaydedilir.
            {truncated && ` Liste ilk ${MEDIA_LIMIT} fotoğrafı gösterdiği için “En sona” kapalı.`}
          </p>
          <ol className="galeri__sortlist">
            {items.map((m, i) => {
              const label = nameOf(m)
              const badge = mediaBadge(m)
              const src = m.sizes?.w320?.url || m.url || ''
              const last = items.length - 1
              return (
                <li key={m.id} className="galeri__row" data-id={m.id} {...dragProps(m, i)}>
                  {src ? <img src={src} alt="" loading="lazy" decoding="async" /> : <span className="galeri__row-blank" />}
                  <div className="galeri__row-text">
                    <p className="galeri__name">
                      <span className="galeri__pos">{i + 1}.</span> {label}
                    </p>
                    <span className="galeri__badge galeri__badge--inline" data-tone={badge.tone}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="galeri__row-actions">
                    <button type="button" className="galeri__btn" aria-disabled={i === 0 || moving} onClick={() => void move(i, 0)} aria-label={`En başa al: ${label}`}>
                      En başa
                    </button>
                    <button type="button" className="galeri__btn galeri__btn--icon" aria-disabled={i === 0 || moving} onClick={() => void move(i, i - 1)} aria-label={`${label}: yukarı taşı`}>
                      ↑
                    </button>
                    <button type="button" className="galeri__btn galeri__btn--icon" aria-disabled={i === last || moving} onClick={() => void move(i, i + 1)} aria-label={`${label}: aşağı taşı`}>
                      ↓
                    </button>
                    <button
                      type="button"
                      className="galeri__btn"
                      // Truncated list: its last row is not the category's last photo.
                      aria-disabled={i === last || moving || truncated}
                      onClick={() => !truncated && void move(i, last)}
                      aria-label={`En sona al: ${label}`}
                    >
                      En sona
                    </button>
                  </div>
                  {cardError[m.id] && (
                    <p className="galeri__error" role="alert">
                      {cardError[m.id]}
                    </p>
                  )}
                </li>
              )
            })}
          </ol>
        </section>
      ) : (
        <>
          {items.length > 0 && visible.length === 0 && (
            <div className="galeri__empty">
              <p className="galeri__note">{FILTERS.find(([key]) => key === filter)?.[2]}</p>
              <button type="button" className="galeri__btn" onClick={() => showFilter('all')}>
                Tüm fotoğrafları göster
              </button>
            </div>
          )}
          <ol className="galeri__grid">
            {visible.map(({ m, i }) => {
              const badge = mediaBadge(m)
              const src = m.sizes?.w640?.url || m.url || ''
              const label = nameOf(m)
              return (
                <li key={m.id} className="galeri__card" data-id={m.id} {...dragProps(m, i)}>
                  <button
                    type="button"
                    className="galeri__thumb"
                    ref={(el) => {
                      if (el) thumbs.current.set(m.id, el)
                      else thumbs.current.delete(m.id)
                    }}
                    onClick={() => setEditing(editing === m.id ? null : m.id)}
                    aria-expanded={editing === m.id}
                    aria-label={`${label}, ${badge.label}: metni düzenle`}
                  >
                    {/* Already-resized CDN renditions; next/image would re-proxy them. */}
                    {src && <img src={src} alt="" loading="lazy" decoding="async" />}
                    <span className="galeri__badge" data-tone={badge.tone}>
                      {badge.label}
                    </span>
                  </button>

                  <div className="galeri__text">
                    <p className="galeri__name">{label}</p>
                    <p className={m.alt ? 'galeri__alt' : 'galeri__alt galeri__alt--empty'}>{m.alt || 'Alt metin yok'}</p>
                  </div>

                  {m.status !== 'approved' && <AiFacts review={aiReview(m, tags)} />}

                  <div className="galeri__langs">
                    <MediaLocalesSync
                      id={m.id}
                      sync={m.i18nSync as I18nSync | null}
                      // The editor may hold unsaved TR text: translating now would use the saved one.
                      blocked={editing === m.id ? 'Önce metni kaydedin ya da vazgeçin.' : null}
                      buttonClassName="galeri__btn"
                      statusClassName="galeri__langs-status"
                      onDone={() => void refresh(m.id)}
                    />
                  </div>

                  {cardError[m.id] && (
                    <p className="galeri__error" role="alert">
                      {cardError[m.id]}
                    </p>
                  )}

                  {editing === m.id && (
                    <Editor
                      item={m}
                      busy={busy === m.id}
                      onCancel={() => closeEditor(m.id)}
                      onSave={async (data) => {
                        if (await patch(m.id, data)) closeEditor(m.id)
                      }}
                    />
                  )}

                  <div className="galeri__actions">
                    {m.status !== 'approved' && (
                      <button
                        type="button"
                        className="galeri__btn galeri__btn--primary"
                        disabled={busy === m.id}
                        onClick={() => void patch(m.id, { status: 'approved' })}
                      >
                        Onayla
                      </button>
                    )}
                    {m.status !== 'hidden' && (
                      <button type="button" className="galeri__btn" disabled={busy === m.id} onClick={() => void patch(m.id, { status: 'hidden' })}>
                        Gizle
                      </button>
                    )}
                    <Link className="galeri__btn" href={`/admin/collections/media/${m.id}`}>
                      Düzenle
                    </Link>
                    {canMove && (
                      <>
                        <button
                          type="button"
                          className="galeri__btn galeri__btn--icon"
                          aria-disabled={i === 0 || moving}
                          onClick={() => void move(i, i - 1)}
                          aria-label={`${label}: yukarı taşı`}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="galeri__btn galeri__btn--icon"
                          aria-disabled={i === items.length - 1 || moving}
                          onClick={() => void move(i, i + 1)}
                          aria-label={`${label}: aşağı taşı`}
                        >
                          ↓
                        </button>
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </>
      )}
    </div>
  )
}

/** #192: the AI's confidence and category check, flagged when doubtful, and the tags "Onayla" will attach. */
function AiFacts({ review }: { review: ReturnType<typeof aiReview> }) {
  if (!review) return null
  const low = review.confidence !== undefined && review.confidence < 0.5
  return (
    <div className="galeri__ai" data-doubtful={review.doubtful || undefined}>
      {review.doubtful && (
        <p className="galeri__ai-flag">
          <strong>Kontrol edin:</strong>{' '}
          {[low && 'AI bu fotoğraftan emin değil.', review.categoryAgrees === false && 'Fotoğraf bu kategoriye uymuyor olabilir.'].filter(Boolean).join(' ')}
        </p>
      )}
      <dl className="galeri__ai-facts">
        {review.confidence !== undefined && (
          <div>
            <dt>AI güveni:</dt>
            <dd>
              {percent.format(review.confidence)}
              {low && ' (düşük)'}
            </dd>
          </div>
        )}
        {review.categoryAgrees !== undefined && (
          <div>
            <dt>Kategoriye uyuyor:</dt>
            <dd>{review.categoryAgrees ? 'Evet' : 'Hayır'}</dd>
          </div>
        )}
        <div>
          <dt>Onaylayınca eklenecek etiketler:</dt>
          <dd>{review.addTags.length ? review.addTags.join(', ') : 'Yok'}</dd>
        </div>
      </dl>
    </div>
  )
}

function Editor({
  item,
  busy,
  onCancel,
  onSave,
}: {
  item: Item
  busy: boolean
  onCancel: () => void
  onSave: (data: { title: string; alt: string; status?: 'approved' }) => Promise<void>
}) {
  const [title, setTitle] = useState(item.title ?? '')
  const [alt, setAlt] = useState(item.alt ?? '')
  const first = useRef<HTMLInputElement>(null)
  useEffect(() => first.current?.focus(), [])
  return (
    <form
      className="galeri__editor"
      onSubmit={(e) => {
        e.preventDefault()
        void onSave({ title, alt })
      }}
    >
      <label className="galeri__field">
        <span>Başlık</span>
        <input ref={first} value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="galeri__field">
        <span>Alt metin (fotoğrafta ne görünüyor?)</span>
        <textarea value={alt} maxLength={125} rows={3} onChange={(e) => setAlt(e.target.value)} />
        <small>{alt.length} / 125</small>
      </label>
      <div className="galeri__actions">
        {item.status !== 'approved' && (
          <button
            type="button"
            className="galeri__btn galeri__btn--primary"
            disabled={busy}
            onClick={() => void onSave({ title, alt, status: 'approved' })}
          >
            Kaydet ve onayla
          </button>
        )}
        <button type="submit" className="galeri__btn" disabled={busy}>
          Kaydet
        </button>
        <button type="button" className="galeri__btn" onClick={onCancel}>
          Vazgeç
        </button>
      </div>
    </form>
  )
}
