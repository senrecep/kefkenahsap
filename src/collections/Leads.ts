import type { CollectionAfterChangeHook, CollectionBeforeChangeHook, CollectionConfig } from 'payload'
import { SystemDateTimeProvider } from 'tsentials/time'

import { isStaff } from '@/access'
import { retentionUntil } from '@/lib/leads/validate'

// Server-side only: retention date and the moment consent was given are never taken from client input.
const setRetention: CollectionBeforeChangeHook = ({ data, operation }) =>
  operation === 'create'
    ? { ...data, retentionUntil: retentionUntil(SystemDateTimeProvider).toISOString(), consentAt: SystemDateTimeProvider.utcNow().toISOString() }
    : data

/** New lead → e-mail to the business (best effort: a mail failure never loses the lead). */
const notify: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  const to = process.env.LEADS_NOTIFY_EMAIL
  if (operation !== 'create' || !to) return doc
  // Without Resend, Payload's fallback mailer prints the whole e-mail (personal data) to the log.
  if (!process.env.RESEND_API_KEY) {
    req.payload.logger.warn({ lead: doc.id }, 'lead notification skipped: RESEND_API_KEY is not set')
    return doc
  }
  const lines = [
    ['Ad', doc.name],
    ['Telefon', doc.phone],
    ['E-posta', doc.email],
    ['Hizmet', doc.service],
    ['Konum', [doc.district, doc.city].filter(Boolean).join(', ')],
    ['Mesaj', doc.message],
    ['Sayfa', doc.sourcePage],
    ['Fotoğraf', doc.photos?.length ? `${doc.photos.length} adet (panelde)` : ''],
  ].filter(([, v]) => v)
  const esc = (s: string) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
  try {
    await req.payload.sendEmail({
      to,
      subject: `Yeni talep #${doc.id}${doc.service ? ` — ${doc.service}` : ''}`,
      html:
        `<p>Siteden yeni bir talep geldi.</p><table>${lines.map(([k, v]) => `<tr><td><b>${k}</b></td><td>${esc(String(v))}</td></tr>`).join('')}</table>` +
        `<p><a href="${process.env.NEXT_PUBLIC_SITE_URL}/admin/collections/leads/${doc.id}">Talebi panelde aç</a></p>`,
    })
  } catch (err) {
    const e = err as Error
    req.payload.logger.error({ err: { name: e?.name, message: e?.message }, lead: doc.id }, 'lead notification failed')
  }
  return doc
}

export const Leads: CollectionConfig = {
  slug: 'leads',
  labels: { singular: 'Talep', plural: 'Talepler' },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'phone', 'service', 'status', 'createdAt'], group: 'Talepler' },
  // Public submissions go through the validated, Turnstile-protected form action (#41), never the REST API.
  access: { read: isStaff, create: isStaff, update: isStaff, delete: isStaff },
  hooks: { beforeChange: [setRetention], afterChange: [notify] },
  fields: [
    { type: 'row', fields: [
      { name: 'name', type: 'text', required: true, label: 'Ad soyad' },
      { name: 'phone', type: 'text', required: true, label: 'Telefon' },
      { name: 'email', type: 'email', label: 'E-posta' },
    ] },
    { type: 'row', fields: [
      { name: 'service', type: 'text', label: 'Hizmet' },
      { name: 'city', type: 'text', label: 'İl' },
      { name: 'district', type: 'text', label: 'İlçe' },
    ] },
    { name: 'message', type: 'textarea', label: 'Mesaj' },
    { name: 'photos', type: 'upload', relationTo: 'lead-photos', hasMany: true, label: 'Fotoğraflar' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'new',
      label: 'Durum',
      options: [
        { label: 'Yeni', value: 'new' },
        { label: 'Arandı / yazıldı', value: 'contacted' },
        { label: 'Kapandı', value: 'closed' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'consentKvkk', type: 'checkbox', required: true, label: 'KVKK onayı', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'consentAt', type: 'date', label: 'Onay zamanı', admin: { readOnly: true, position: 'sidebar', date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'consentTextVersion', type: 'text', label: 'Onaylanan metin sürümü', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'locale', type: 'text', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'sourcePage', type: 'text', label: 'Geldiği sayfa', admin: { readOnly: true } },
    { name: 'utm', type: 'json', admin: { readOnly: true } },
    { name: 'retentionUntil', type: 'date', label: 'Silinme tarihi (KVKK)', index: true, admin: { readOnly: true, position: 'sidebar' } },
  ],
}
