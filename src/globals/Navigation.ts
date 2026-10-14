import type { Field, GlobalConfig } from 'payload'

import { hiddenFromEditor, isStaff } from '@/access'
import { validateHref } from '@/lib/http/safe-href'
import { revalidateGlobal } from '@/hooks/revalidate'

const link: Field[] = [
  { name: 'label', type: 'text', localized: true, required: true },
  { name: 'href', type: 'text', required: true, validate: validateHref, admin: { description: 'Dil öneki olmadan, ör. /referanslar' } },
]

export const Navigation: GlobalConfig = {
  slug: 'navigation',
  label: 'Menüler',
  admin: { hidden: hiddenFromEditor, group: 'Yönetim' },
  hooks: { afterChange: [revalidateGlobal('site')] },
  access: { read: () => true, update: isStaff },
  fields: [
    { name: 'header', type: 'array', label: 'Üst menü', fields: link },
    { name: 'footer', type: 'array', label: 'Alt menü', fields: link },
  ],
}
