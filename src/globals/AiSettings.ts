import type { GlobalConfig } from 'payload'

import { isAdmin } from '@/access'

const chain = (name: string, label: string) => ({
  name,
  type: 'text' as const,
  hasMany: true,
  label,
  admin: { description: 'OpenRouter model kimlikleri, sırayla denenir. Boşsa varsayılanlar kullanılır.' },
})

export const AiSettings: GlobalConfig = {
  slug: 'aiSettings',
  label: 'AI Ayarları',
  admin: { group: 'Yönetim' },
  access: { read: isAdmin, update: isAdmin },
  fields: [
    { name: 'enabled', type: 'checkbox', defaultValue: true, label: 'Yeni yüklemelerde otomatik öneri üret' },
    { name: 'monthlyBudgetUsd', type: 'number', defaultValue: 10, label: 'Aylık bütçe (USD); dolunca AI işleri durur' },
    chain('tagImage', 'Görsel etiketleme modelleri'),
    chain('translate', 'Çeviri modelleri'),
    chain('draftGuide', 'Taslak yazı modelleri'),
    {
      name: 'glossary',
      type: 'array',
      label: 'Terim sözlüğü (TR → EN)',
      fields: [{ type: 'row', fields: [{ name: 'tr', type: 'text', required: true }, { name: 'en', type: 'text', required: true }] }],
    },
  ],
}
