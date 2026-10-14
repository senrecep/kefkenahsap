import type { CollectionConfig } from 'payload'

import { hiddenFromEditor, isStaff, publishedOrStaff } from '@/access'
import { slugFrom } from '@/hooks/slug'
import { revalidateAfterChange, revalidateAfterDelete } from '@/hooks/revalidate'

/**
 * Bölge sayfaları (/tr/bolgeler/<slug>, /en/areas/<slug>; decision #25). The body is written by hand, never templated.
 * Projects join here through their own "Bölge" field. A region is indexed only once it passes the publish gate
 * (src/lib/regions/gate.ts: ≥3 published projects + ≥250 words); otherwise the page is noindex and unlisted.
 */
export const Regions: CollectionConfig = {
  slug: 'regions',
  labels: { singular: 'Bölge', plural: 'Bölgeler' },
  admin: {
    hidden: hiddenFromEditor,
    useAsTitle: 'name',
    defaultColumns: ['name', 'updatedAt', '_status'],
    group: 'İçerik',
    description: 'En az 3 yayında proje ve 250 kelimelik kendi metni olan bölge arama motorlarına açılır; diğerleri gizli (noindex) kalır.',
    livePreview: {
      url: ({ data, locale }) => {
        const code = locale?.code ?? 'tr'
        return `${process.env.NEXT_PUBLIC_SITE_URL}/${code}/${code === 'tr' ? 'bolgeler' : 'areas'}/${data?.slug ?? ''}?preview=1`
      },
    },
  },
  hooks: { afterChange: [revalidateAfterChange('regions')], afterDelete: [revalidateAfterDelete('regions')] },
  access: { read: publishedOrStaff, create: isStaff, update: isStaff, delete: isStaff },
  versions: { drafts: true },
  fields: [
    { name: 'name', type: 'text', localized: true, required: true, label: 'Bölge adı' },
    {
      name: 'slug',
      type: 'text',
      localized: true,
      unique: true,
      index: true,
      hooks: { beforeValidate: [slugFrom('name')] },
      admin: { position: 'sidebar', description: 'Boş bırakılırsa addan üretilir.' },
    },
    { name: 'body', type: 'richText', localized: true, label: 'Metin (elle yazılır, en az 250 kelime)' },
    { name: 'projects', type: 'join', collection: 'projects', on: 'region', label: 'Projeler (projenin "Bölge" alanından)' },
  ],
}
