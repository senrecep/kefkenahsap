'use client'

import { useDocumentInfo, useFormFields, useFormModified } from '@payloadcms/ui'
import { useEffect, useId, useState } from 'react'

import './ai.css'

type State = { kind: 'idle' } | { kind: 'busy' } | { kind: 'done' } | { kind: 'error'; message: string }
type Photo = { id: number; label: string }

const idsOf = (v: unknown): number[] =>
  (Array.isArray(v) ? v : v == null ? [] : [v])
    .map((x) => (typeof x === 'object' && x ? (x as { id?: number }).id : x))
    .filter((x): x is number => typeof x === 'number')

/** "AI ile taslak": the editor's notes (+ captions of chosen photos) → a draft of the empty body/story. Never publishes. */
export function AiDraftButton() {
  const { id, collectionSlug } = useDocumentInfo()
  const modified = useFormModified()
  const galleryIds = useFormFields(([fields]) => idsOf(fields.gallery?.value).concat(idsOf(fields.cover?.value)).join(','))
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [chosen, setChosen] = useState<number[]>([])
  const [state, setState] = useState<State>({ kind: 'idle' })
  const notesId = useId()

  // Project photos with a caption: the caption is all the model sees of a photo.
  useEffect(() => {
    if (!galleryIds) return
    const unique = [...new Set(galleryIds.split(','))].slice(0, 50)
    const q = new URLSearchParams({ depth: '0', locale: 'tr', limit: '50', 'where[id][in]': unique.join(',') })
    fetch(`/api/media?${q}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { docs: [] }))
      .then((b: { docs: { id: number; caption?: string | null }[] }) =>
        setPhotos(b.docs.filter((m) => m.caption?.trim()).map((m) => ({ id: m.id, label: m.caption!.trim() }))),
      )
      .catch(() => setPhotos([]))
  }, [galleryIds])

  async function draft() {
    setState({ kind: 'busy' })
    try {
      const res = await fetch('/api/ai/draft', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: collectionSlug, id, notes, mediaIds: chosen }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) return setState({ kind: 'error', message: body.error || 'Taslak yazılamadı. Tekrar deneyin.' })
      setState({ kind: 'done' })
      setTimeout(() => window.location.reload(), 1200)
    } catch {
      setState({ kind: 'error', message: 'Bağlantı kurulamadı. İnternetinizi kontrol edip tekrar deneyin.' })
    }
  }

  const blocked = !id ? 'Önce başlığı yazıp kaydedin.' : modified ? 'Kaydedilmemiş değişiklikler var; önce kaydedin.' : null
  const what = collectionSlug === 'projects' ? 'hikayeyi' : 'yazıyı'
  return (
    <div className="ai-action">
      <label className="ai-action__label" htmlFor={notesId}>
        AI ile taslak: notlar
      </label>
      <textarea
        id={notesId}
        className="ai-action__notes"
        rows={6}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={'Her satıra bir madde:\n- Riva, bahçe\n- iroko deck, 40 m²\n- 3 haftada bitti'}
      />
      {photos.length > 0 && (
        <fieldset className="ai-action__photos">
          <legend>Fotoğraf açıklamalarını da kullan</legend>
          {photos.map((p) => (
            <label key={p.id} className="ai-action__photo">
              <input
                type="checkbox"
                checked={chosen.includes(p.id)}
                onChange={(e) => setChosen(e.target.checked ? [...chosen, p.id] : chosen.filter((c) => c !== p.id))}
              />
              {p.label}
            </label>
          ))}
        </fieldset>
      )}
      <button type="button" className="ai-btn" onClick={draft} disabled={Boolean(blocked) || !notes.trim() || state.kind === 'busy' || state.kind === 'done'}>
        {state.kind === 'busy' ? 'Yazılıyor…' : 'AI ile taslak'}
      </button>
      <p className="ai-action__hint">
        {blocked ?? `Yalnızca notlarınızdaki ve Site Bilgileri'ndeki bilgilerle boş ${what} taslak olarak yazar. Yayınlamaz.`}
      </p>
      <p className="ai-action__status" aria-live="polite">
        {state.kind === 'busy' && 'Taslak hazırlanıyor, bu bir dakika kadar sürebilir.'}
        {state.kind === 'done' && 'Taslak kaydedildi. Okuyup düzeltin, hazır olunca siz yayınlayın. Sayfa yenileniyor…'}
      </p>
      {state.kind === 'error' && (
        <p className="ai-action__error" role="alert">
          {state.message}
        </p>
      )}
    </div>
  )
}
