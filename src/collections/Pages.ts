import type { CollectionConfig } from 'payload'

import { hiddenFromEditor, isStaff, publishedOrStaff } from '@/access'
import { slugFrom } from '@/hooks/slug'
import { revalidateAfterChange, revalidateAfterDelete } from '@/hooks/revalidate'

/** Simple content pages: Hakkımızda, KVKK, Çerez Politikası, Süreç. */
export const Pages: CollectionConfig = {
  slug: 'pages',
  labels: { singular: 'Sayfa', plural: 'Sayfalar' },
  admin: {
    hidden: hiddenFromEditor,
    useAsTitle: 'title',
    group: 'İçerik',
    livePreview: {
      url: ({ data, locale }) =>
        `${process.env.NEXT_PUBLIC_SITE_URL}/${locale?.code ?? 'tr'}/${data?.slug ?? ''}?preview=1`,
    },
  },
  hooks: { afterChange: [revalidateAfterChange('pages')], afterDelete: [revalidateAfterDelete('pages')] },
  access: { read: publishedOrStaff, create: isStaff, update: isStaff, delete: isStaff },
  versions: { drafts: true },
  fields: [
    { name: 'title', type: 'text', localized: true, required: true, label: 'Başlık' },
    { name: 'slug', type: 'text', localized: true, unique: true, index: true, hooks: { beforeValidate: [slugFrom('title')] }, admin: { position: 'sidebar' } },
    { name: 'body', type: 'richText', localized: true, label: 'İçerik' },
    {
      name: 'seo',
      type: 'group',
      fields: [
        { name: 'title', type: 'text', localized: true },
        { name: 'description', type: 'textarea', localized: true },
      ],
    },
  ],
}
