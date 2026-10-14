import type { Block, GlobalConfig } from 'payload'

import { isStaff } from '@/access'
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
      heading,
      { name: 'subheading', type: 'textarea', localized: true },
    ],
  },
  { slug: 'featuredGallery', labels: { singular: 'Öne çıkan galeri', plural: 'Öne çıkan galeri' }, fields: [enabled, heading, { name: 'limit', type: 'number', defaultValue: 24 }] },
  { slug: 'services', labels: { singular: 'Hizmetler', plural: 'Hizmetler' }, fields: [enabled, heading] },
  { slug: 'featuredProjects', labels: { singular: 'Öne çıkan projeler', plural: 'Öne çıkan projeler' }, fields: [enabled, heading] },
  {
    slug: 'process',
    labels: { singular: 'Süreç', plural: 'Süreç' },
    fields: [
      enabled,
      heading,
      { name: 'steps', type: 'array', localized: true, fields: [{ name: 'title', type: 'text', required: true }, { name: 'text', type: 'textarea' }] },
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
      { name: 'items', type: 'array', localized: true, fields: [{ name: 'q', type: 'text', required: true }, { name: 'a', type: 'textarea', required: true }] },
    ],
  },
  { slug: 'contact', labels: { singular: 'İletişim', plural: 'İletişim' }, fields: [enabled, heading] },
]

export const Homepage: GlobalConfig = {
  slug: 'homepage',
  label: 'Ana Sayfa',
  admin: { group: 'İçerik' },
  hooks: { afterChange: [revalidateGlobal('homepage')] },
  access: { read: () => true, update: isStaff },
  versions: { drafts: true },
  fields: [{ name: 'layout', type: 'blocks', label: 'Bölümler (sürükleyerek sıralayın)', blocks }],
}
