import type { CollectionConfig } from 'payload'

import { hiddenFromEditor, isStaff, publishedOrStaff } from '@/access'
import { slugFrom, validSlug } from '@/hooks/slug'
import { revalidateAfterChange, revalidateAfterDelete } from '@/hooks/revalidate'
import { aiTranslateField, localeStatusField } from './aiFields'
import { seoField } from './seoField'

/** Simple content pages: Hakkımızda, KVKK, Çerez Politikası, Süreç. */
export const Pages: CollectionConfig = {
  slug: 'pages',
  labels: { singular: 'Sayfa', plural: 'Sayfalar' },
  admin: {
    hidden: hiddenFromEditor,
    useAsTitle: 'title',
    defaultColumns: ['title', '_status', 'updatedAt'],
    hideAPIURL: true,
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
    localeStatusField,
    aiTranslateField,
    { name: 'slug', type: 'text', localized: true, unique: true, index: true, hooks: { beforeValidate: [slugFrom('title')] }, validate: validSlug, admin: { position: 'sidebar' } },
    { name: 'body', type: 'richText', localized: true, label: 'İçerik' },
    seoField(),
  ],
}
