import type { CollectionConfig } from 'payload'

import { isStaff, publishedOrStaff } from '@/access'
import { slugFrom, validSlug } from '@/hooks/slug'
import { RESERVED_CATEGORY_SLUGS } from '@/lib/slug'
import { revalidateAfterChange, revalidateAfterDelete } from '@/hooks/revalidate'
import { aiTranslateField, localeStatusField } from './aiFields'
import { seoField } from './seoField'

export const Categories: CollectionConfig = {
  slug: 'categories',
  labels: { singular: 'Kategori', plural: 'Kategoriler' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', '_status', 'updatedAt'],
    listSearchableFields: ['name', 'slug'],
    hideAPIURL: true,
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
    localeStatusField,
    aiTranslateField,
    {
      name: 'slug',
      type: 'text',
      localized: true,
      unique: true,
      index: true,
      hooks: { beforeValidate: [slugFrom('name')] },
      validate: (v: unknown) => (typeof v === 'string' && RESERVED_CATEGORY_SLUGS.has(v) ? 'Bu adres sitede başka bir sayfaya ait; farklı bir slug seçin.' : validSlug(v)),
      admin: { position: 'sidebar', description: 'Boş bırakılırsa addan üretilir.' },
    },
    {
      // Unnamed tabs are layout only: the columns stay where they were (no migration).
      type: 'tabs',
      tabs: [
        {
          label: 'Metin',
          fields: [
            { name: 'shortDesc', type: 'textarea', localized: true, label: 'Kısa açıklama (cevap-önce giriş)' },
            { name: 'body', type: 'richText', localized: true, label: 'Açıklama (300–600 kelime)' },
            {
              name: 'faq',
              type: 'array',
              label: 'Sık sorulan sorular',
              labels: { singular: 'Soru', plural: 'Sorular' },
              localized: true,
              fields: [
                { name: 'q', type: 'text', required: true, label: 'Soru' },
                { name: 'a', type: 'textarea', required: true, label: 'Cevap' },
              ],
            },
          ],
        },
        {
          label: 'Görseller',
          fields: [
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
          ],
        },
        {
          label: 'Fiyat',
          fields: [
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
                  { name: 'currency', type: 'select', label: 'Para birimi', defaultValue: 'TRY', options: ['TRY', 'EUR', 'USD'] },
                ] },
                { name: 'note', type: 'textarea', localized: true, label: 'Not (fiyatı ne belirler?)' },
                { name: 'updatedAt', type: 'date', label: 'Fiyat güncelleme tarihi' },
              ],
            },
          ],
        },
        { label: 'SEO', fields: [seoField(true)] },
      ],
    },
  ],
}
