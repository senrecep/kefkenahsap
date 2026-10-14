import type { Field } from 'payload'

/** Sidebar "AI ile çevir" button (#55): categories, projects, pages, guides. No data; the button calls /api/ai/translate. */
export const aiTranslateField: Field = {
  name: 'aiTranslate',
  type: 'ui',
  admin: { position: 'sidebar', components: { Field: '/components/admin/ai/AiTranslateButton#AiTranslateButton' } },
}

/** Sidebar "AI ile taslak" (#56): guides and projects. Notes in, a draft of the empty body/story out; never publishes. */
export const aiDraftField: Field = {
  name: 'aiDraft',
  type: 'ui',
  admin: { position: 'sidebar', components: { Field: '/components/admin/ai/AiDraftButton#AiDraftButton' } },
}
