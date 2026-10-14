import { EXPERIMENTAL_TableFeature, lexicalEditor, type FeatureProviderServer } from '@payloadcms/richtext-lexical'
import type { CollectionConfig } from 'payload'

import { isStaff, publishedOrStaff } from '@/access'
import { slugFrom } from '@/hooks/slug'
import { revalidateAfterChange, revalidateAfterDelete } from '@/hooks/revalidate'

// Guides compare wood species in tables (PLAN §7), so their body adds the table feature; the seed loader reuses it.
export const guideBodyFeatures = ({ defaultFeatures }: { defaultFeatures: FeatureProviderServer[] }) => [...defaultFeatures, EXPERIMENTAL_TableFeature()]

/** Rehber yazıları (/tr/rehber/<slug>, /en/guides/<slug>). Author box and JSON-LD author come from siteSettings.founder. */
export const Guides: CollectionConfig = {
  slug: 'guides',
  labels: { singular: 'Yazı', plural: 'Yazılar' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'updatedAt', '_status'],
    group: 'İçerik',
    livePreview: {
      url: ({ data, locale }) => {
        const code = locale?.code ?? 'tr'
        return `${process.env.NEXT_PUBLIC_SITE_URL}/${code}/${code === 'tr' ? 'rehber' : 'guides'}/${data?.slug ?? ''}?preview=1`
      },
    },
  },
  hooks: { afterChange: [revalidateAfterChange('guides')], afterDelete: [revalidateAfterDelete('guides')] },
  access: { read: publishedOrStaff, create: isStaff, update: isStaff, delete: isStaff },
  versions: { drafts: true },
  fields: [
    { name: 'title', type: 'text', localized: true, required: true, label: 'Başlık' },
    {
      name: 'slug',
      type: 'text',
      localized: true,
      unique: true,
      index: true,
      hooks: { beforeValidate: [slugFrom('title')] },
      admin: { position: 'sidebar', description: 'Boş bırakılırsa başlıktan üretilir.' },
    },
    { name: 'excerpt', type: 'textarea', localized: true, label: 'Kısa cevap (ilk paragraf, en çok 150 kelime)' },
    { name: 'body', type: 'richText', localized: true, label: 'Yazı', editor: lexicalEditor({ features: guideBodyFeatures }) },
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
    { name: 'relatedCategories', type: 'relationship', relationTo: 'categories', hasMany: true, label: 'İlgili hizmetler', admin: { position: 'sidebar' } },
    {
      name: 'seo',
      type: 'group',
      label: 'SEO',
      fields: [
        { name: 'title', type: 'text', localized: true },
        { name: 'description', type: 'textarea', localized: true },
      ],
    },
  ],
}
