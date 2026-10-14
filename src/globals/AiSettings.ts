import type { GlobalConfig } from 'payload'

import { hiddenFromEditor, isAdmin } from '@/access'

const chain = (name: string, label: string) => ({
  name,
  type: 'text' as const,
  hasMany: true,
  label,
  admin: { components: { Field: '/components/admin/ai/ModelChainField#ModelChainField' } },
})

export const AiSettings: GlobalConfig = {
  slug: 'aiSettings',
  label: 'AI Ayarları',
  admin: { hidden: hiddenFromEditor, group: 'Yönetim' },
  access: { read: isAdmin, update: isAdmin },
  fields: [
    { name: 'enabled', type: 'checkbox', defaultValue: true, label: 'Yeni yüklemelerde otomatik öneri üret' },
    { name: 'costPanel', type: 'ui', admin: { components: { Field: '/components/admin/ai/AiCostPanel#AiCostPanel' } } },
    { name: 'monthlyBudgetUsd', type: 'number', defaultValue: 10, label: 'Aylık bütçe (USD); dolunca AI işleri durur' },
    chain('tagImage', 'Görsel etiketleme modelleri'),
    chain('translate', 'Çeviri modelleri'),
    chain('draftGuide', 'Rehber taslağı modelleri'),
    chain('draftProjectStory', 'Proje hikayesi taslağı modelleri'),
    {
      name: 'glossary',
      type: 'array',
      label: 'Terim sözlüğü (TR → EN)',
      fields: [{ type: 'row', fields: [{ name: 'tr', type: 'text', required: true }, { name: 'en', type: 'text', required: true }] }],
    },
  ],
}
