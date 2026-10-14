import type { Field, GlobalConfig } from 'payload'

import { isStaff } from '@/access'

const link: Field[] = [
  { name: 'label', type: 'text', localized: true, required: true },
  { name: 'href', type: 'text', required: true, admin: { description: 'Dil öneki olmadan, ör. /referanslar' } },
]

export const Navigation: GlobalConfig = {
  slug: 'navigation',
  label: 'Menüler',
  admin: { group: 'Yönetim' },
  access: { read: () => true, update: isStaff },
  fields: [
    { name: 'header', type: 'array', label: 'Üst menü', fields: link },
    { name: 'footer', type: 'array', label: 'Alt menü', fields: link },
  ],
}
