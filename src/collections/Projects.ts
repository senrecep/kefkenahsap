import type { CollectionConfig, FieldAccess } from 'payload'

import { isStaff, publishedOrStaff } from '@/access'
import { slugFrom } from '@/hooks/slug'
import { revalidateAfterChange, revalidateAfterDelete } from '@/hooks/revalidate'
import { aiDraftField, aiTranslateField } from './aiFields'

// Testimonial text is readable by the public only with recorded consent (API and frontend alike).
const consentedOrStaff: FieldAccess = ({ req, siblingData }) => Boolean(req.user) || Boolean(siblingData?.consentGiven)

export const Projects: CollectionConfig = {
  slug: 'projects',
  labels: { singular: 'Proje', plural: 'Projeler' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'city', 'year', '_status'],
    group: 'İçerik',
    livePreview: {
      url: ({ data, locale }) => {
        const code = locale?.code ?? 'tr'
        const base = code === 'tr' ? 'projeler' : 'projects'
        return `${process.env.NEXT_PUBLIC_SITE_URL}/${code}/${base}/${data?.slug ?? ''}?preview=1`
      },
    },
  },
  hooks: { afterChange: [revalidateAfterChange('projects', 'references')], afterDelete: [revalidateAfterDelete('projects', 'references')] },
  access: { read: publishedOrStaff, create: isStaff, update: isStaff, delete: isStaff },
  versions: { drafts: true },
  fields: [
    { name: 'title', type: 'text', localized: true, required: true, label: 'Başlık' },
    aiTranslateField,
    aiDraftField,
    {
      name: 'slug',
      type: 'text',
      localized: true,
      unique: true,
      index: true,
      hooks: { beforeValidate: [slugFrom('title')] },
      admin: { position: 'sidebar' },
    },
    { name: 'featured', type: 'checkbox', label: 'Öne çıkan', admin: { position: 'sidebar' } },
    { name: 'categories', type: 'relationship', relationTo: 'categories', hasMany: true, label: 'Kategoriler' },
    { name: 'tags', type: 'relationship', relationTo: 'tags', hasMany: true, label: 'Etiketler' },
    { name: 'cover', type: 'upload', relationTo: 'media', label: 'Kapak' },
    { name: 'gallery', type: 'upload', relationTo: 'media', hasMany: true, label: 'Galeri (sürükleyerek sıralayın)' },
    { name: 'story', type: 'richText', localized: true, label: 'Hikaye (kısa)' },
    {
      type: 'collapsible',
      label: 'Proje künyesi',
      fields: [
        { type: 'row', fields: [
          { name: 'city', type: 'text', label: 'İl' },
          { name: 'district', type: 'text', label: 'İlçe' },
          { name: 'region', type: 'relationship', relationTo: 'regions', label: 'Bölge' },
          { name: 'year', type: 'number', label: 'Yıl', min: 1980, max: 2100 },
        ] },
        { type: 'row', fields: [
          { name: 'areaValue', type: 'number', label: 'Alan / uzunluk' },
          { name: 'areaUnit', type: 'select', label: 'Birim', options: [
            { label: 'm²', value: 'm2' }, { label: 'metre', value: 'm' }, { label: 'adet', value: 'piece' },
          ] },
          { name: 'duration', type: 'text', localized: true, label: 'Süre (ör. 3 hafta)' },
        ] },
        { name: 'woodSpecies', type: 'relationship', relationTo: 'tags', hasMany: true, label: 'Ahşap türü',
          filterOptions: { axis: { equals: 'wood' } } },
        { name: 'finish', type: 'text', localized: true, label: 'Finish / renk' },
        {
          name: 'mapPin',
          type: 'group',
          label: 'Yaklaşık konum (opsiyonel, tam adres değil)',
          fields: [{ type: 'row', fields: [{ name: 'lat', type: 'number' }, { name: 'lng', type: 'number' }] }],
        },
      ],
    },
    {
      name: 'testimonial',
      type: 'group',
      label: 'Müşteri yorumu (yalnızca izinle yayınlanır)',
      fields: [
        { name: 'quote', type: 'textarea', localized: true, access: { read: consentedOrStaff } },
        { type: 'row', fields: [
          { name: 'author', type: 'text', access: { read: consentedOrStaff } },
          { name: 'role', type: 'text', localized: true, access: { read: consentedOrStaff } },
        ] },
        { name: 'consentGiven', type: 'checkbox', label: 'Müşteri yayın izni verdi' },
      ],
    },
    { name: 'reference', type: 'relationship', relationTo: 'references', label: 'Referans' },
  ],
}
