import type { CollectionConfig } from 'payload'

import { hiddenFromEditor, isAdmin } from '@/access'

/** One row per AI call (cost from OpenRouter usage accounting). Read by the budget check and the admin cost panel (F2). */
export const AiUsage: CollectionConfig = {
  slug: 'ai-usage',
  labels: { singular: 'AI kullanımı', plural: 'AI kullanımı' },
  admin: {
    hidden: hiddenFromEditor,
    group: 'Yönetim',
    useAsTitle: 'task',
    listSearchableFields: ['task', 'docRef'],
    defaultColumns: ['task', 'model', 'costUsd', 'ok', 'createdAt'],
    hideAPIURL: true,
  },
  access: { read: isAdmin, create: () => false, update: () => false, delete: isAdmin },
  fields: [
    { name: 'task', type: 'text', required: true, index: true, label: 'İş' },
    { name: 'model', type: 'text', label: 'Model' },
    { name: 'ok', type: 'checkbox', label: 'Başarılı' },
    { name: 'costUsd', type: 'number', label: 'Maliyet (USD)' },
    { name: 'inputTokens', type: 'number', label: 'Giden token' },
    { name: 'outputTokens', type: 'number', label: 'Gelen token' },
    { name: 'docRef', type: 'text', label: 'Kayıt', admin: { description: 'koleksiyon:id' } },
    { name: 'error', type: 'textarea', label: 'Hata' },
  ],
}
