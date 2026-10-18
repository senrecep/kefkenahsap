import { BlocksFeature, EXPERIMENTAL_TableFeature, FixedToolbarFeature, HeadingFeature, lexicalEditor, type FeatureProviderServer } from '@payloadcms/richtext-lexical'
import type { Block, CollectionConfig } from 'payload'

import { isStaff, publishedOrStaff } from '@/access'
import { slugFrom, validSlug } from '@/hooks/slug'
import { revalidateAfterChange, revalidateAfterDelete } from '@/hooks/revalidate'
import { type Locale, routing } from '@/i18n/routing'
import { aiDraftField, aiTranslateField, localeStatusField } from './aiFields'
import { seoField } from './seoField'

// #60: the 3D wood samples, placed by the editor anywhere in a guide body. Fixed content, so no fields; the page
// renders it from src/lib/wood/samples.ts.
export const WoodSamplesBlock: Block = {
  slug: 'woodSamples',
  labels: { singular: 'Ahşap numuneleri (3D)', plural: 'Ahşap numuneleri (3D)' },
  fields: [],
}

// Guides compare wood species in tables (PLAN §7), so their body adds the table feature; headings are H2/H3 only
// (H1 is the title, the TOC lists H2s). The seed loader and e2e reuse this list.
export const guideBodyFeatures = ({ defaultFeatures }: { defaultFeatures: FeatureProviderServer[] }) => [
  ...defaultFeatures.filter((f) => f.key !== 'heading'),
  HeadingFeature({ enabledHeadingSizes: ['h2', 'h3'] }),
  EXPERIMENTAL_TableFeature(),
  BlocksFeature({ blocks: [WoodSamplesBlock] }),
  FixedToolbarFeature(),
]

/** Rehber yazıları (/tr/rehber/<slug>, /en/guides/<slug>). With `showAuthor`, the author box (and later JSON-LD author) come from siteSettings.founder. */
export const Guides: CollectionConfig = {
  slug: 'guides',
  labels: { singular: 'Yazı', plural: 'Yazılar' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', '_status', 'updatedAt'],
    listSearchableFields: ['title', 'slug'],
    hideAPIURL: true,
    group: 'İçerik',
    livePreview: {
      url: ({ data, locale }) => {
        const code = locale?.code ?? 'tr'
        const segment = routing.pathnames['/rehber'][code as Locale] ?? '/rehber'
        return `${process.env.NEXT_PUBLIC_SITE_URL}/${code}${segment}/${data?.slug ?? ''}?preview=1`
      },
    },
  },
  hooks: { afterChange: [revalidateAfterChange('guides')], afterDelete: [revalidateAfterDelete('guides')] },
  access: { read: publishedOrStaff, create: isStaff, update: isStaff, delete: isStaff },
  versions: { drafts: true },
  fields: [
    { name: 'title', type: 'text', localized: true, required: true, label: 'Başlık' },
    localeStatusField,
    aiTranslateField,
    {
      name: 'slug',
      type: 'text',
      localized: true,
      unique: true,
      index: true,
      hooks: { beforeValidate: [slugFrom('title')] },
      validate: validSlug,
      admin: { position: 'sidebar', description: 'Boş bırakılırsa başlıktan üretilir.' },
    },
    {
      name: 'showAuthor',
      type: 'checkbox',
      defaultValue: false,
      label: 'Yazar kutusunu göster',
      admin: { position: 'sidebar', description: 'Açıksa yazının altında kurucunun adı (Site Bilgileri › Kurucu) yazar olarak görünür.' },
    },
    { name: 'relatedCategories', type: 'relationship', relationTo: 'categories', hasMany: true, label: 'İlgili hizmetler', admin: { position: 'sidebar' } },
    {
      // Unnamed tabs are layout only: the columns stay where they were (no migration).
      type: 'tabs',
      tabs: [
        {
          label: 'Metin',
          fields: [
            { name: 'excerpt', type: 'textarea', localized: true, label: 'Kısa cevap (ilk paragraf, en çok 150 kelime)' },
            { name: 'body', type: 'richText', localized: true, label: 'Yazı', editor: lexicalEditor({ features: guideBodyFeatures }) },
            aiDraftField,
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
            {
              name: 'cover',
              type: 'upload',
              relationTo: 'media',
              label: 'Kapak fotoğrafı',
              admin: { description: 'Yazının başında ve rehber listesinde görünür. Boşsa listede ilk ilgili hizmetin fotoğrafı kullanılır.' },
            },
          ],
        },
        { label: 'SEO', fields: [seoField()] },
      ],
    },
  ],
}
