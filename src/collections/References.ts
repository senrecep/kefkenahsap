import type { CollectionConfig } from 'payload'

import { isStaff } from '@/access'

export const References: CollectionConfig = {
  slug: 'references',
  labels: { singular: 'Referans', plural: 'Referanslar' },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'location'], group: 'İçerik' },
  access: { read: () => true, create: isStaff, update: isStaff, delete: isStaff },
  orderable: true,
  fields: [
    { name: 'name', type: 'text', required: true, label: 'Ad' },
    { name: 'location', type: 'text', localized: true, label: 'Konum' },
    { name: 'projects', type: 'join', collection: 'projects', on: 'reference', label: 'Projeler' },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      label: 'Logo (yalnızca izin varsa)',
      admin: { condition: (d) => Boolean(d?.logoPermission) },
    },
    { name: 'logoPermission', type: 'checkbox', label: 'Logo kullanım izni alındı' },
  ],
}
