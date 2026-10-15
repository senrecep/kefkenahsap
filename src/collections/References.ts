import type { CollectionConfig } from 'payload'

import { hiddenFromEditor, isStaff } from '@/access'
import { revalidateAfterChange, revalidateAfterDelete } from '@/hooks/revalidate'

export const References: CollectionConfig = {
  slug: 'references',
  labels: { singular: 'Referans', plural: 'Referanslar' },
  admin: { hidden: hiddenFromEditor, useAsTitle: 'name', defaultColumns: ['name', 'location'], group: 'İçerik', hideAPIURL: true },
  hooks: { afterChange: [revalidateAfterChange('references')], afterDelete: [revalidateAfterDelete('references')] },
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
      // No permission → never served, even if a logo is still attached.
      access: { read: ({ req, siblingData }) => Boolean(req.user) || Boolean(siblingData?.logoPermission) },
    },
    { name: 'logoPermission', type: 'checkbox', label: 'Logo kullanım izni alındı' },
  ],
}
