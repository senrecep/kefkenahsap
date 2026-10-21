'use client'

import { useDocumentInfo, useField, useForm, useFormFields, useFormModified } from '@payloadcms/ui'
import { useSearchParams } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'

import { fillTemplate, unfilledFields, type PlaceholderLead } from '@/lib/email/placeholders'
import type { EmailTemplate, Lead } from '@/payload-types'

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

const validId = (v: string | null | undefined) => (v && /^[1-9]\d*$/.test(v) ? v : undefined)
const getJson = <T,>(url: string): Promise<T | null> =>
  fetch(url, { credentials: 'include' })
    .then((r) => (r.ok ? (r.json() as Promise<T>) : null))
    .catch(() => null)
const fetchLead = (id: string | number | undefined) => (id ? getJson<Lead>(`/api/leads/${id}?depth=0`) : Promise.resolve(null))
const fetchTemplate = (id: string | undefined) => (id ? getJson<EmailTemplate>(`/api/email-templates/${id}?depth=0`) : Promise.resolve(null))

/**
 * Sets the subject and the rich-text body from a template filled with the lead's data (#256). The Lexical editor only
 * re-reads its value when the field's initialValue changes, so both are set; then the form counts as modified.
 */
function useApplyTemplate() {
  const { dispatchFields, setModified } = useForm()
  const subject = useField<string>({ path: 'subject' })
  return (t: EmailTemplate, lead: PlaceholderLead | null) => {
    const filled = fillTemplate({ subject: t.subject, body: t.body }, lead ?? undefined)
    subject.setValue(filled.subject)
    dispatchFields({ type: 'UPDATE', path: 'body', value: filled.body, initialValue: filled.body })
    setModified(true)
  }
}

/**
 * Create view opened with `?lead=<id>`: fills the empty recipient, name, subject and lead link from that lead.
 * With `&template=<id>` (#256) the subject and body come from that template, filled with the lead's data.
 */
export function LeadPrefill() {
  const { id } = useDocumentInfo()
  const params = useSearchParams()
  const leadId = validId(params.get('lead'))
  const templateId = validId(params.get('template'))
  const to = useField<string>({ path: 'to' })
  const toName = useField<string>({ path: 'toName' })
  const subject = useField<string>({ path: 'subject' })
  const lead = useField<number>({ path: 'lead' })
  const apply = useApplyTemplate()
  const done = useRef(false)

  useEffect(() => {
    if (id || done.current || (!leadId && !templateId)) return
    done.current = true
    void Promise.all([fetchLead(leadId), fetchTemplate(templateId)]).then(([l, t]) => {
      if (l) {
        if (!to.value && l.email) to.setValue(l.email)
        if (!toName.value && l.name) toName.setValue(l.name)
        if (!lead.value) lead.setValue(l.id)
      }
      if (t) apply(t, l)
      else if (l && !subject.value) subject.setValue(l.service ? `Talebiniz hakkında — ${l.service}` : 'Talebiniz hakkında')
    })
  }, [id, leadId, templateId, to, toName, subject, lead, apply])

  return null
}

type Body = { root?: { children?: { type?: string; children?: unknown[] }[] } } | null | undefined
/** An untouched editor holds one empty paragraph. */
const isEmptyBody = (b: Body) => !(b?.root?.children ?? []).some((n) => n.type !== 'paragraph' || (n.children?.length ?? 0) > 0)

/** "Şablon seç" (#256): drafts only. Fills subject + body from a template with the linked lead's data. */
export function TemplatePicker() {
  const { id } = useDocumentInfo()
  const status = useFormFields(([fields]) => fields.status?.value)
  const body = useFormFields(([fields]) => fields.body?.value) as Body
  const leadValue = useFormFields(([fields]) => fields.lead?.value) as number | { id: number } | null | undefined
  const apply = useApplyTemplate()
  const [templates, setTemplates] = useState<EmailTemplate[] | null>(null)
  const [busy, setBusy] = useState(false)
  const selectId = useId()
  const editable = !id || status === 'draft'

  useEffect(() => {
    if (!editable) return
    void getJson<{ docs: EmailTemplate[] }>('/api/email-templates?sort=order&limit=100&depth=0').then((r) => setTemplates(r?.docs ?? []))
  }, [editable])

  if (!editable || !templates?.length) return null

  async function choose(value: string) {
    const t = templates?.find((x) => String(x.id) === value)
    if (!t) return
    if (!isEmptyBody(body) && !window.confirm(`Konu ve metin "${t.name}" şablonuyla değiştirilecek. Yazdıklarınız silinir. Devam edilsin mi?`)) return
    setBusy(true)
    const leadId = typeof leadValue === 'object' ? leadValue?.id : leadValue
    apply(t, await fetchLead(leadId ?? undefined))
    setBusy(false)
  }

  return (
    <div className="ai-action">
      <label htmlFor={selectId} className="ai-chain__label">
        Şablondan başla
      </label>
      <select id={selectId} className="ai-btn" value="" disabled={busy} onChange={(e) => void choose(e.target.value)}>
        <option value="">Şablon seç…</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.description ? `${t.name} — ${t.description}` : t.name}
          </option>
        ))}
      </select>
      <p className="ai-action__hint">{'{ad}, {hizmet}, {konum} ilgili talepten dolar; [köşeli parantezli] yerleri siz doldurun.'}</p>
    </div>
  )
}

type State = { kind: 'idle' } | { kind: 'busy' } | { kind: 'done' } | { kind: 'error'; message: string }

/** Sidebar of an outgoing e-mail: "Önizle" (new tab) and "Gönder" (with a confirm step, drafts only). */
export function OutgoingEmailActions() {
  const { id } = useDocumentInfo()
  const modified = useFormModified()
  const status = useFormFields(([fields]) => fields.status?.value)
  const to = useFormFields(([fields]) => fields.to?.value)
  const subject = useFormFields(([fields]) => fields.subject?.value)
  const body = useFormFields(([fields]) => fields.body?.value)
  const [state, setState] = useState<State>({ kind: 'idle' })

  async function send() {
    // #256: template parts still to fill by hand ([tarih]) or placeholders without a value ({ad} → [ad]).
    const unfilled = unfilledFields(String(subject ?? ''), body)
    if (unfilled.length && !window.confirm(`Doldurulmamış alanlar var: ${unfilled.join(', ')}\nYine de gönderilsin mi?`)) return
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
