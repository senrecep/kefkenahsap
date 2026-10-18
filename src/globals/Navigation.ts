import type { Field, GlobalConfig } from 'payload'

import { isStaff } from '@/access'
import { validateHref } from '@/lib/http/safe-href'
import { revalidateGlobal } from '@/hooks/revalidate'

const link: Field[] = [
  { name: 'label', type: 'text', localized: true, required: true, label: 'Menüdeki yazı' },
  { name: 'href', type: 'text', required: true, validate: validateHref, label: 'Adres', admin: { description: 'Dil öneki olmadan, ör. /referanslar' } },
]

// #192: hidden from everyone in the admin: the header and footer menus are built in code (Header.tsx, Footer.tsx), so edits
// here changed nothing on the site. Kept (not dropped) so no data or migration is lost.
export const Navigation: GlobalConfig = {
  slug: 'navigation',
  label: 'Menüler',
  admin: { hidden: true, group: 'Yönetim', hideAPIURL: true },
  hooks: { afterChange: [revalidateGlobal('site')] },
  access: { read: () => true, update: isStaff },
  fields: [
    { name: 'header', type: 'array', label: 'Üst menü', labels: { singular: 'Bağlantı', plural: 'Bağlantılar' }, fields: link },
    { name: 'footer', type: 'array', label: 'Alt menü', labels: { singular: 'Bağlantı', plural: 'Bağlantılar' }, fields: link },
  ],
}
