import type { CollectionConfig } from 'payload'

import { isStaff } from '@/access'

import { emailBodyEditor } from './emailBody'

/** #256: reusable starts for outgoing e-mails ("Şablon seç"); `{ad}`, `{hizmet}`, `{konum}` are filled from the lead. */
export const EmailTemplates: CollectionConfig = {
  slug: 'email-templates',
  labels: { singular: 'E-posta Şablonu', plural: 'E-posta Şablonları' },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'description', 'order'], group: 'Talepler', hideAPIURL: true },
  defaultSort: 'order',
  access: { read: isStaff, create: isStaff, update: isStaff, delete: isStaff },
  fields: [
    { name: 'name', type: 'text', required: true, unique: true, label: 'Şablon adı' },
    { name: 'description', type: 'text', label: 'Ne zaman kullanılır' },
    {
      name: 'subject',
      type: 'text',
      required: true,
      label: 'Konu',
      admin: { description: '{ad}, {hizmet}, {konum} talepten otomatik dolar.' },
    },
    {
      name: 'body',
      type: 'richText',
      required: true,
      label: 'Metin',
      admin: {
        description: '{ad}, {hizmet}, {konum} talepten otomatik dolar; [köşeli parantezli] yerleri gönderirken siz doldurun. İmza otomatik eklenir.',
      },
      editor: emailBodyEditor,
    },
    { name: 'order', type: 'number', label: 'Sıra', admin: { position: 'sidebar', description: 'Küçük sayı listede önce gelir.' } },
  ],
}
