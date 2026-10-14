import type { Field } from 'payload'

/** Sidebar "AI ile çevir" button (#55): categories, projects, pages, guides. No data; the button calls /api/ai/translate. */
export const aiTranslateField: Field = {
  name: 'aiTranslate',
  type: 'ui',
  admin: { position: 'sidebar', components: { Field: '/components/admin/ai/AiTranslateButton#AiTranslateButton' } },
}
