'use client'

import { useDocumentInfo, useFormModified } from '@payloadcms/ui'
import { useState } from 'react'

import './ai.css'

type State = { kind: 'idle' } | { kind: 'busy' } | { kind: 'done'; message: string } | { kind: 'error'; message: string }

/** "AI ile çevir": fills the empty languages of this record from the filled one and saves them as a draft. */
export function AiTranslateButton() {
  const { id, collectionSlug } = useDocumentInfo()
  const modified = useFormModified()
  const [state, setState] = useState<State>({ kind: 'idle' })

  async function translate() {
    setState({ kind: 'busy' })
    try {
      const res = await fetch('/api/ai/translate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: collectionSlug, id }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) return setState({ kind: 'error', message: body.error || 'Çeviri yapılamadı. Tekrar deneyin.' })
      const langs = (body.locales as string[]).map((l) => l.toUpperCase()).join(', ')
      setState({ kind: 'done', message: `${langs} çevirisi taslak olarak kaydedildi. Bir sonraki Yayınla bu dilleri de yayınlar; önce kontrol edin. Sayfa yenileniyor…` })
      // Reload so the form shows the new draft; nothing is published until someone presses Yayınla.
      setTimeout(() => window.location.reload(), 4000)
    } catch {
      setState({ kind: 'error', message: 'Bağlantı kurulamadı. İnternetinizi kontrol edip tekrar deneyin.' })
    }
  }

  const blocked = !id ? 'Önce kaydedin; çeviri kayıtlı içerikten yapılır.' : modified ? 'Kaydedilmemiş değişiklikler var; önce kaydedin.' : null
  return (
    <div className="ai-action">
      <button type="button" className="ai-btn" onClick={translate} disabled={Boolean(blocked) || state.kind === 'busy' || state.kind === 'done'}>
        {state.kind === 'busy' ? 'Çevriliyor…' : 'AI ile çevir'}
      </button>
      <p className="ai-action__hint">{blocked ?? 'Boş dilleri doldurur, taslak olarak kaydeder. Dolu alanlara dokunmaz. Yayınla tüm dilleri birlikte yayınlar.'}</p>
      <p className="ai-action__status" aria-live="polite">
        {state.kind === 'busy' && 'Çeviri hazırlanıyor, bu bir dakika kadar sürebilir.'}
        {state.kind === 'done' && state.message}
      </p>
      {state.kind === 'error' && (
        <p className="ai-action__error" role="alert">
          {state.message}
        </p>
      )}
    </div>
  )
}
