'use client'

import { useDocumentInfo, useFormFields, useFormModified } from '@payloadcms/ui'
import { useState } from 'react'

import { localesStatus } from '@/lib/media/galeri'
import type { I18nSync } from '@/lib/media/i18nSync'
import './ai.css'

const CONFIRM = 'Başlık, alt metin ve açıklama Türkçe metinden diğer tüm dillere yeniden çevrilecek. Elle düzenlenmiş çeviriler de değişir. Devam edilsin mi?'

/**
 * #203: the other-languages state of one photo and "Diğer dillere yeniden çevir" (POST /api/ai/translate-media), which
 * overwrites every non-TR text after a confirm. Used on the Galeri card and in the media edit view.
 */
export function MediaLocalesSync(props: {
  id: number | string
  sync: I18nSync | null | undefined
  /** Why the button cannot run now (e.g. unsaved changes); shown instead of running. */
  blocked?: string | null
  buttonClassName: string
  statusClassName: string
  onDone: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const status = localesStatus(props.sync)

  async function retranslate() {
    if (!window.confirm(CONFIRM)) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/ai/translate-media', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: props.id }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) return setError(body.error || 'Çeviri yapılamadı. Tekrar deneyin.')
      props.onDone()
    } catch {
      setError('Bağlantı kurulamadı. İnternetinizi kontrol edip tekrar deneyin.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <p className={props.statusClassName} data-tone={status.tone} aria-live="polite">
        {busy ? 'Diğer diller çevriliyor…' : status.label}
      </p>
      {props.blocked && <p className="ai-action__hint">{props.blocked}</p>}
      <button type="button" className={props.buttonClassName} onClick={() => void retranslate()} disabled={busy || Boolean(props.blocked)}>
        Diğer dillere yeniden çevir
      </button>
      {error && (
        <p className="ai-action__error" role="alert">
          {error}
        </p>
      )}
    </>
  )
}

/** The media edit view's panel (ui field `localesSync`); reloads after a run so the form shows the new texts. */
export function MediaLocalesSyncField() {
  const { id } = useDocumentInfo()
  const modified = useFormModified()
  const sync = useFormFields(([fields]) => fields.i18nSync?.value) as I18nSync | null | undefined
  if (!id) return null
  return (
    <div className="ai-action">
      <span className="ai-action__label">Diğer diller</span>
      <MediaLocalesSync
        id={id}
        sync={sync}
        blocked={modified ? 'Kaydedilmemiş değişiklikler var; önce kaydedin.' : null}
        buttonClassName="ai-btn"
        statusClassName="ai-action__hint"
        onDone={() => window.location.reload()}
      />
    </div>
  )
}
