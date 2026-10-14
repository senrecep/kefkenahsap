import type { CollectionConfig } from 'payload'

import { isStaff } from '@/access'
import { slugFrom } from '@/hooks/slug'
import { revalidateAfterChange, revalidateAfterDelete } from '@/hooks/revalidate'

export const Tags: CollectionConfig = {
  slug: 'tags',
  labels: { singular: 'Etiket', plural: 'Etiketler' },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'axis'], group: 'İçerik' },
  hooks: { afterChange: [revalidateAfterChange('tags', 'media')], afterDelete: [revalidateAfterDelete('tags', 'media')] },
  access: { read: () => true, create: isStaff, update: isStaff, delete: isStaff },
  fields: [
    { name: 'name', type: 'text', localized: true, required: true, label: 'Ad' },
    { name: 'slug', type: 'text', localized: true, unique: true, index: true, hooks: { beforeValidate: [slugFrom('name')] } },
    {
      name: 'axis',
      type: 'select',
      required: true,
      label: 'Eksen',
      options: [
        { label: 'Ahşap türü', value: 'wood' },
        { label: 'Mekan', value: 'setting' },
        { label: 'Renk / finish', value: 'finish' },
        { label: 'Aşama (öncesi/sonrası/süreç/detay)', value: 'stage' },
      ],
    },
    { name: 'description', type: 'textarea', localized: true, label: 'Açıklama' },
  ],
}
