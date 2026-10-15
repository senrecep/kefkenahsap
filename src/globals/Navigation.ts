import type { Field, GlobalConfig } from 'payload'

import { hiddenFromEditor, isStaff } from '@/access'
import { validateHref } from '@/lib/http/safe-href'
import { revalidateGlobal } from '@/hooks/revalidate'

const link: Field[] = [
  { name: 'label', type: 'text', localized: true, required: true, label: 'Menüdeki yazı' },
  { name: 'href', type: 'text', required: true, validate: validateHref, label: 'Adres', admin: { description: 'Dil öneki olmadan, ör. /referanslar' } },
]

export const Navigation: GlobalConfig = {
  slug: 'navigation',
  label: 'Menüler',
  admin: { hidden: hiddenFromEditor, group: 'Yönetim', hideAPIURL: true },
  hooks: { afterChange: [revalidateGlobal('site')] },
  access: { read: () => true, update: isStaff },
  fields: [
    { name: 'header', type: 'array', label: 'Üst menü', labels: { singular: 'Bağlantı', plural: 'Bağlantılar' }, fields: link },
    { name: 'footer', type: 'array', label: 'Alt menü', labels: { singular: 'Bağlantı', plural: 'Bağlantılar' }, fields: link },
  ],
}
