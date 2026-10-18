import type { Field } from 'payload'

/** "Diller" panel (#158): per-language live / draft / empty, under the title of every localized, draftable collection. */
export const localeStatusField: Field = {
  name: 'localeStatus',
  type: 'ui',
  admin: { components: { Field: '/components/admin/ai/LocaleStatus#LocaleStatus' } },
}

/** "AI ile çevir" button (#55), right after the title: categories, projects, pages, guides. No data; it calls /api/ai/translate. */
export const aiTranslateField: Field = {
  name: 'aiTranslate',
  type: 'ui',
  admin: { components: { Field: '/components/admin/ai/AiTranslateButton#AiTranslateButton' } },
}

/** "AI ile taslak" (#56), right after the body/story it fills: guides and projects. Notes in, a draft out; never publishes. */
export const aiDraftField: Field = {
  name: 'aiDraft',
  type: 'ui',
  admin: { components: { Field: '/components/admin/ai/AiDraftButton#AiDraftButton' } },
}
