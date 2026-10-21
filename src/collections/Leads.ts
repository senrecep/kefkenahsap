import type { CollectionAfterChangeHook, CollectionBeforeChangeHook, CollectionConfig } from 'payload'
import { SystemDateTimeProvider } from 'tsentials/time'

import { isStaff } from '@/access'
import { leadEmail } from '@/lib/leads/email'
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
  try {
    await req.payload.sendEmail({
      to,
      ...leadEmail(doc, process.env.NEXT_PUBLIC_SITE_URL ?? ''),
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
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'phone', 'service', 'status', 'createdAt'], group: 'Talepler', hideAPIURL: true },
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
    { name: 'consentKvkk', type: 'checkbox', required: true, label: 'Aydınlatma metni okundu', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'consentAt', type: 'date', label: 'Gönderim zamanı', admin: { readOnly: true, position: 'sidebar', date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'consentTextVersion', type: 'text', label: 'Okunan metin sürümü', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'locale', type: 'text', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'sourcePage', type: 'text', label: 'Geldiği sayfa', admin: { readOnly: true } },
    { name: 'utm', type: 'json', admin: { readOnly: true } },
    { name: 'retentionUntil', type: 'date', label: 'Silinme tarihi (KVKK)', index: true, admin: { readOnly: true, position: 'sidebar' } },
  ],
}
