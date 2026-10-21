'use client'

import { useDocumentInfo, useField, useFormFields, useFormModified } from '@payloadcms/ui'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import './ai/ai.css'

/** #254: new reply to a lead. Opened from the lead's "E-posta gönder" and the notification e-mail's reply button. */
export const replyToLeadHref = (leadId: number | string) => `/admin/collections/outgoing-emails/create?lead=${leadId}`

/** Lead edit view: "E-posta gönder", only when the lead left an e-mail address. */
export function LeadEmailButton() {
  const { id } = useDocumentInfo()
  const email = useFormFields(([fields]) => fields.email?.value)
  if (!id || !email) return null
  return (
    <div className="ai-action">
      <a className="ai-btn" href={replyToLeadHref(id)}>
        E-posta gönder
      </a>
    </div>
  )
}

/** Create view opened with `?lead=<id>`: fills the empty recipient, name, subject and lead link from that lead. */
export function LeadPrefill() {
  const { id } = useDocumentInfo()
  const leadId = useSearchParams().get('lead')
  const to = useField<string>({ path: 'to' })
  const toName = useField<string>({ path: 'toName' })
  const subject = useField<string>({ path: 'subject' })
  const lead = useField<number>({ path: 'lead' })
  const done = useRef(false)

  useEffect(() => {
    if (id || done.current || !leadId || !/^[1-9]\d*$/.test(leadId)) return
    done.current = true
    fetch(`/api/leads/${leadId}?depth=0`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((l: { id: number; name?: string | null; email?: string | null; service?: string | null } | null) => {
        if (!l) return
        if (!to.value && l.email) to.setValue(l.email)
        if (!toName.value && l.name) toName.setValue(l.name)
        if (!subject.value) subject.setValue(l.service ? `Talebiniz hakkında — ${l.service}` : 'Talebiniz hakkında')
        if (!lead.value) lead.setValue(l.id)
      })
      .catch(() => {})
  }, [id, leadId, to, toName, subject, lead])

  return null
}

type State = { kind: 'idle' } | { kind: 'busy' } | { kind: 'done' } | { kind: 'error'; message: string }

/** Sidebar of an outgoing e-mail: "Önizle" (new tab) and "Gönder" (with a confirm step, drafts only). */
export function OutgoingEmailActions() {
  const { id } = useDocumentInfo()
  const modified = useFormModified()
  const status = useFormFields(([fields]) => fields.status?.value)
  const to = useFormFields(([fields]) => fields.to?.value)
  const [state, setState] = useState<State>({ kind: 'idle' })

  async function send() {
    if (!window.confirm(`E-posta şu adrese gönderilecek: ${String(to)}\nGönderdikten sonra değiştirilemez. Gönderilsin mi?`)) return
    setState({ kind: 'busy' })
    try {
      const res = await fetch(`/api/outgoing-emails/${id}/send`, { method: 'POST', credentials: 'include' })
      const body = await res.json().catch(() => ({}))
      setState(res.ok ? { kind: 'done' } : { kind: 'error', message: body.message || 'E-posta gönderilemedi. Tekrar deneyin.' })
      // Sent, already sent or failed: the stored status changed, show it. Other errors leave the draft as it was.
      if (res.ok || res.status === 409 || res.status === 502) setTimeout(() => window.location.reload(), res.ok ? 1200 : 4000)
    } catch {
      setState({ kind: 'error', message: 'Bağlantı kurulamadı. İnternetinizi kontrol edip tekrar deneyin.' })
    }
  }

  if (!id) return <p className="ai-action__hint">Önce kaydedin; sonra önizleyip gönderebilirsiniz.</p>
  const blocked = status !== 'draft' ? 'Bu e-posta gönderildi; değiştirilemez.' : modified ? 'Kaydedilmemiş değişiklikler var; önce kaydedin.' : null
  return (
    <div className="ai-action">
      <a className="ai-btn" href={`/api/outgoing-emails/${id}/preview`} target="_blank" rel="noopener">
        Önizle
      </a>
      {status === 'draft' && (
        <button type="button" className="ai-btn" onClick={send} disabled={Boolean(blocked) || state.kind === 'busy' || state.kind === 'done'}>
          {state.kind === 'busy' ? 'Gönderiliyor…' : 'Gönder'}
        </button>
      )}
      {blocked && <p className="ai-action__hint">{blocked}</p>}
      <p className="ai-action__status" aria-live="polite">
        {state.kind === 'done' && 'Gönderildi. Sayfa yenileniyor…'}
      </p>
      {state.kind === 'error' && (
        <p className="ai-action__error" role="alert">
          {state.message}
        </p>
      )}
    </div>
  )
}
