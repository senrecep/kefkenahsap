import type { Block, GlobalConfig } from 'payload'

import { hiddenFromEditor, isStaff } from '@/access'
import { revalidateGlobal } from '@/hooks/revalidate'

const enabled = { name: 'enabled', type: 'checkbox' as const, defaultValue: true, label: 'Göster' }
const heading = { name: 'heading', type: 'text' as const, localized: true, label: 'Başlık' }

const blocks: Block[] = [
  {
    slug: 'hero',
    labels: { singular: 'Hero', plural: 'Hero' },
    fields: [
      enabled,
      { name: 'image', type: 'upload', relationTo: 'media', required: true, label: 'Görsel (gerçek proje)' },
      {
        name: 'mobileImage',
        type: 'upload',
        relationTo: 'media',
        label: 'Telefon görseli (isteğe bağlı)',
        admin: { description: 'Telefonda bu görsel gösterilir. Filigranın başlığın arkasında kalmadığı dikey bir fotoğraf seçin; boşsa ana görsel kullanılır.' },
      },
      heading,
      { name: 'subheading', type: 'textarea', localized: true, label: 'Alt başlık' },
    ],
  },
  { slug: 'featuredGallery', labels: { singular: 'Öne çıkan galeri', plural: 'Öne çıkan galeri' }, fields: [enabled, heading, { name: 'limit', type: 'number', defaultValue: 24, label: 'Gösterilecek fotoğraf sayısı' }] },
  { slug: 'services', labels: { singular: 'Hizmetler', plural: 'Hizmetler' }, fields: [enabled, heading] },
  { slug: 'featuredProjects', labels: { singular: 'Öne çıkan projeler', plural: 'Öne çıkan projeler' }, fields: [enabled, heading] },
  {
    slug: 'process',
    labels: { singular: 'Süreç', plural: 'Süreç' },
    fields: [
      enabled,
      heading,
      {
        name: 'steps',
        type: 'array',
        localized: true,
        label: 'Adımlar',
        labels: { singular: 'Adım', plural: 'Adımlar' },
        fields: [{ name: 'title', type: 'text', required: true, label: 'Başlık' }, { name: 'text', type: 'textarea', label: 'Açıklama' }],
      },
    ],
  },
  { slug: 'references', labels: { singular: 'Referanslar', plural: 'Referanslar' }, fields: [enabled, heading] },
  { slug: 'woodTypes', labels: { singular: 'Ahşap türleri', plural: 'Ahşap türleri' }, fields: [enabled, heading] },
  {
    slug: 'faq',
    labels: { singular: 'SSS', plural: 'SSS' },
    fields: [
      enabled,
      heading,
      {
        name: 'items',
        type: 'array',
        localized: true,
        label: 'Sorular',
        labels: { singular: 'Soru', plural: 'Sorular' },
        fields: [{ name: 'q', type: 'text', required: true, label: 'Soru' }, { name: 'a', type: 'textarea', required: true, label: 'Cevap' }],
      },
    ],
  },
  { slug: 'contact', labels: { singular: 'İletişim', plural: 'İletişim' }, fields: [enabled, heading] },
]

export const Homepage: GlobalConfig = {
  slug: 'homepage',
  label: 'Ana Sayfa',
  admin: { hidden: hiddenFromEditor, group: 'İçerik', hideAPIURL: true },
  hooks: { afterChange: [revalidateGlobal('homepage')] },
  access: { read: () => true, update: isStaff },
  versions: { drafts: true },
  // disableBlockName: the free-text block name only adds an unexplained field to every section.
  fields: [{ name: 'layout', type: 'blocks', label: 'Bölümler (sürükleyerek sıralayın)', labels: { singular: 'Bölüm', plural: 'Bölümler' }, blocks: blocks.map((b) => ({ ...b, admin: { ...b.admin, disableBlockName: true } })) }],
}
