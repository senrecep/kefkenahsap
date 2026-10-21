import {
  BoldFeature,
  FixedToolbarFeature,
  HeadingFeature,
  ItalicFeature,
  LinkFeature,
  OrderedListFeature,
  ParagraphFeature,
  UnderlineFeature,
  UnorderedListFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import type { CollectionBeforeChangeHook, CollectionConfig, FieldAccess, Where } from 'payload'
import { SystemDateTimeProvider } from 'tsentials/time'

import { isStaff } from '@/access'
import { outgoingEmailPreviewEndpoint, outgoingEmailSendEndpoint } from '@/endpoints/outgoingEmail'
import { retentionUntil } from '@/lib/leads/validate'

// Status and its timestamps are written only by the send endpoint (Local API), never through the admin form or REST.
const serverOnly: { create: FieldAccess; update: FieldAccess } = { create: () => false, update: () => false }

/** Every new document (also "Çoğalt") starts as an unsent draft with its own 2-year KVKK retention. */
const freshDraft: CollectionBeforeChangeHook = ({ data, operation }) =>
  operation === 'create'
    ? { ...data, status: 'draft', sentAt: null, error: null, retentionUntil: retentionUntil(SystemDateTimeProvider).toISOString() }
    : data

/** #254: e-mails written and sent from the admin (replies to leads). Save as draft, then "Gönder" (once). */
export const OutgoingEmails: CollectionConfig = {
  slug: 'outgoing-emails',
  labels: { singular: 'Giden E-posta', plural: 'Giden E-postalar' },
  admin: { useAsTitle: 'subject', defaultColumns: ['subject', 'to', 'status', 'sentAt'], group: 'Talepler', hideAPIURL: true },
  // A sent e-mail stays exactly what was sent: only drafts can be edited.
  access: { read: isStaff, create: isStaff, update: (args) => isStaff(args) && ({ status: { equals: 'draft' } } satisfies Where), delete: isStaff },
  hooks: { beforeChange: [freshDraft] },
  endpoints: [outgoingEmailSendEndpoint, outgoingEmailPreviewEndpoint],
  fields: [
    { name: 'prefill', type: 'ui', admin: { components: { Field: '/components/admin/OutgoingEmail#LeadPrefill' } } },
    { type: 'row', fields: [
      { name: 'to', type: 'email', required: true, label: 'Alıcı e-posta' },
      { name: 'toName', type: 'text', label: 'Alıcı adı' },
    ] },
    { name: 'subject', type: 'text', required: true, label: 'Konu' },
    {
      name: 'body',
      type: 'richText',
      required: true,
      label: 'Metin',
      admin: { description: 'Selamlamayı da siz yazın. İmza (ad, telefon, e-posta) otomatik eklenir.' },
      editor: lexicalEditor({
        features: () => [
          ParagraphFeature(),
          HeadingFeature({ enabledHeadingSizes: ['h2', 'h3'] }),
          BoldFeature(),
          ItalicFeature(),
          UnderlineFeature(),
          UnorderedListFeature(),
          OrderedListFeature(),
          // No internal links: an e-mail needs a full address (https://, mailto:, tel:).
          LinkFeature({ enabledCollections: [] }),
          FixedToolbarFeature(),
        ],
      }),
    },
    { name: 'lead', type: 'relationship', relationTo: 'leads', label: 'İlgili talep', admin: { position: 'sidebar' } },
    { name: 'actions', type: 'ui', admin: { position: 'sidebar', components: { Field: '/components/admin/OutgoingEmail#OutgoingEmailActions' } } },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      label: 'Durum',
      options: [
        { label: 'Taslak', value: 'draft' },
        { label: 'Gönderildi', value: 'sent' },
        { label: 'Hata', value: 'failed' },
      ],
      access: serverOnly,
      admin: { readOnly: true, position: 'sidebar' },
    },
    { name: 'sentAt', type: 'date', label: 'Gönderim zamanı', access: serverOnly, admin: { readOnly: true, position: 'sidebar', date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'error', type: 'text', label: 'Hata', access: serverOnly, admin: { readOnly: true, position: 'sidebar', condition: (data) => Boolean(data?.error) } },
    { name: 'retentionUntil', type: 'date', label: 'Silinme tarihi (KVKK)', index: true, access: serverOnly, admin: { readOnly: true, position: 'sidebar' } },
  ],
}
