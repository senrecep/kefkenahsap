'use client'

import { useDocumentInfo, useFormFields, useFormModified } from '@payloadcms/ui'
import { useEffect, useState } from 'react'

import { localesStatus } from '@/lib/media/galeri'
import type { I18nSync } from '@/lib/media/i18nSync'
import './ai.css'

// While a translation is pending: re-read the photo's state every 10 s for at most 3 min, only while the tab is visible.
const POLL_MS = 10_000
const POLL_FOR_MS = 3 * 60_000
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
  // The state read by polling; a new state from the parent (save, refresh) replaces it.
  const [polled, setPolled] = useState<{ base: I18nSync | null | undefined; sync: I18nSync | null }>()
  const sync = polled && polled.base === props.sync ? polled.sync : props.sync
  const pending = Boolean(sync?.pending?.length)
  // Polling stopped (3 min) while still pending: for this parent state only.
  const [gaveUp, setGaveUp] = useState<I18nSync | null | undefined | false>(false)
  const status = localesStatus(sync)
  const label = pending && gaveUp === props.sync ? `${status.label} Durum için sayfayı yenileyin.` : status.label

  useEffect(() => {
    if (!pending) return
    const base = props.sync
    const started = Date.now()
    const timer = setInterval(async () => {
      if (Date.now() - started > POLL_FOR_MS) {
        clearInterval(timer)
        return setGaveUp(base)
      }
      if (document.visibilityState !== 'visible') return
      try {
        const res = await fetch(`/api/media/${props.id}?depth=0&locale=tr&select[i18nSync]=true`, { credentials: 'include' })
        if (res.ok) setPolled({ base, sync: ((await res.json()) as { i18nSync?: I18nSync | null }).i18nSync ?? null })
      } catch {
        // Offline for a moment: the next tick tries again.
      }
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [pending, props.id, props.sync])

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
      {/* One sentence, read whole when it changes; it only changes for the photo being edited or translated. */}
      <p className={props.statusClassName} data-tone={status.tone} aria-live="polite" aria-atomic="true">
        {busy ? 'Diğer diller çevriliyor…' : label}
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
