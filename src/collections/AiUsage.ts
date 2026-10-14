import type { CollectionConfig } from 'payload'

import { hiddenFromEditor, isAdmin } from '@/access'

/** One row per AI call (cost from OpenRouter usage accounting). Read by the budget check and the admin cost panel (F2). */
export const AiUsage: CollectionConfig = {
  slug: 'ai-usage',
  labels: { singular: 'AI kullanımı', plural: 'AI kullanımı' },
  admin: { hidden: hiddenFromEditor, group: 'Yönetim', defaultColumns: ['task', 'model', 'costUsd', 'ok', 'createdAt'] },
  access: { read: isAdmin, create: () => false, update: () => false, delete: isAdmin },
  fields: [
    { name: 'task', type: 'text', required: true, index: true },
    { name: 'model', type: 'text' },
    { name: 'ok', type: 'checkbox' },
    { name: 'costUsd', type: 'number' },
    { name: 'inputTokens', type: 'number' },
    { name: 'outputTokens', type: 'number' },
    { name: 'docRef', type: 'text', admin: { description: 'collection:id' } },
    { name: 'error', type: 'textarea' },
  ],
}
