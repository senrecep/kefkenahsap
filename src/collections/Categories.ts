import type { CollectionConfig } from 'payload'

import { isStaff, publishedOrStaff } from '@/access'
import { slugFrom } from '@/hooks/slug'
import { routing } from '@/i18n/routing'

// Fixed route segments (TR internal + translated public paths): a category slug may not shadow them.
const RESERVED = new Set([
  ...Object.entries(routing.pathnames).flatMap(([internal, p]) => [internal, ...(typeof p === 'string' ? [] : Object.values(p))].map((x) => x.split('/')[1]!)),
  'admin',
  'api',
  'wp-content',
])
import { revalidateAfterChange, revalidateAfterDelete } from '@/hooks/revalidate'
import { aiTranslateField } from './aiFields'

export const Categories: CollectionConfig = {
  slug: 'categories',
  labels: { singular: 'Kategori', plural: 'Kategoriler' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', '_status'],
    group: 'İçerik',
    livePreview: {
      url: ({ data, locale }) =>
        `${process.env.NEXT_PUBLIC_SITE_URL}/${locale?.code ?? 'tr'}/${data?.slug ?? ''}?preview=1`,
    },
  },
  hooks: { afterChange: [revalidateAfterChange('categories', 'media')], afterDelete: [revalidateAfterDelete('categories', 'media')] },
  access: { read: publishedOrStaff, create: isStaff, update: isStaff, delete: isStaff },
  orderable: true,
  versions: { drafts: true },
  fields: [
    { name: 'name', type: 'text', localized: true, required: true, label: 'Ad' },
    aiTranslateField,
    {
      name: 'slug',
      type: 'text',
      localized: true,
      unique: true,
      index: true,
      hooks: { beforeValidate: [slugFrom('name')] },
      validate: (v: unknown) => (typeof v === 'string' && RESERVED.has(v) ? 'Bu adres sitede başka bir sayfaya ait; farklı bir slug seçin.' : true),
      admin: { position: 'sidebar', description: 'Boş bırakılırsa addan üretilir.' },
    },
    { name: 'shortDesc', type: 'textarea', localized: true, label: 'Kısa açıklama (cevap-önce giriş)' },
    { name: 'body', type: 'richText', localized: true, label: 'Açıklama (300–600 kelime)' },
    {
      name: 'faq',
      type: 'array',
      label: 'Sık sorulan sorular',
      localized: true,
      fields: [
        { name: 'q', type: 'text', required: true, label: 'Soru' },
        { name: 'a', type: 'textarea', required: true, label: 'Cevap' },
      ],
    },
    {
      name: 'priceGuide',
      type: 'group',
      label: 'Fiyat rehberi (boşsa gösterilmez)',
      fields: [
        { type: 'row', fields: [
          { name: 'min', type: 'number', label: 'En az' },
          { name: 'max', type: 'number', label: 'En çok' },
          { name: 'unit', type: 'select', label: 'Birim', options: [
            { label: 'm²', value: 'm2' }, { label: 'metre', value: 'm' }, { label: 'adet', value: 'piece' },
          ] },
          { name: 'currency', type: 'select', defaultValue: 'TRY', options: ['TRY', 'EUR', 'USD'] },
        ] },
        { name: 'note', type: 'textarea', localized: true, label: 'Not (fiyatı ne belirler?)' },
        { name: 'updatedAt', type: 'date', label: 'Fiyat güncelleme tarihi' },
      ],
    },
    { name: 'cover', type: 'upload', relationTo: 'media', label: 'Kapak görseli' },
    {
      name: 'media',
      type: 'join',
      collection: 'media',
      on: 'category',
      orderable: true,
      defaultLimit: 200,
      label: 'Görseller (sürükleyerek sıralayın)',
    },
    {
      name: 'seo',
      type: 'group',
      label: 'SEO',
      fields: [
        { name: 'title', type: 'text', localized: true },
        { name: 'description', type: 'textarea', localized: true },
        { name: 'ogImage', type: 'upload', relationTo: 'media' },
      ],
    },
  ],
}
