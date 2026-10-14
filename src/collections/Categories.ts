import type { CollectionConfig } from 'payload'

export const Categories: CollectionConfig = {
  slug: 'categories',
  admin: {
    useAsTitle: 'name',
    livePreview: {
      url: ({ data, locale }) =>
        `${process.env.NEXT_PUBLIC_SITE_URL}/${locale?.code ?? 'tr'}/${data?.slug ?? ''}?preview=1`,
    },
  },
  // Drafts stay private: anonymous readers only see published documents.
  access: { read: ({ req }) => (req.user ? true : { _status: { equals: 'published' } }) },
  orderable: true,
  versions: { drafts: true },
  fields: [
    { name: 'name', type: 'text', localized: true, required: true },
    { name: 'body', type: 'richText', localized: true },
    { name: 'slug', type: 'text', localized: true, unique: true, index: true },
    {
      name: 'media',
      type: 'join',
      collection: 'media',
      on: 'category',
      orderable: true,
      defaultLimit: 200,
    },
  ],
}
