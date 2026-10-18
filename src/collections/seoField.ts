import type { Field } from 'payload'

/** The `seo` group shared by categories, guides and pages; the frontend falls back to the page title when it is empty. */
export const seoField = (withImage = false): Field => ({
  name: 'seo',
  type: 'group',
  label: 'SEO (Google görünümü)',
  fields: [
    { name: 'title', type: 'text', localized: true, label: 'Google başlığı', admin: { description: 'Boşsa sayfanın başlığı kullanılır.' } },
    { name: 'description', type: 'textarea', localized: true, label: 'Google açıklaması', admin: { description: 'Arama sonucunda başlığın altındaki kısa metin (en çok 160 karakter).' } },
    ...(withImage ? [{ name: 'ogImage', type: 'upload' as const, relationTo: 'media' as const, label: 'Paylaşım görseli (WhatsApp, Facebook)' }] : []),
  ],
})
