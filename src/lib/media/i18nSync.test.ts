import { describe, expect, it } from 'vitest'

import { backfillSync, changedFields, type I18nSync, planSync, settleSync, textHash } from './i18nSync'

// Provenance of a locale field the AI wrote from a given TR text.
const made = (tr: string, ai: string) => ({ src: textHash(tr), ai: textHash(ai) })

describe('textHash', () => {
  it('treats null, missing, empty and edge spaces as the same text', () => {
    expect(textHash(null)).toBe(textHash(''))
    expect(textHash(undefined)).toBe(textHash('  '))
    expect(textHash(' Deck ')).toBe(textHash('Deck'))
    expect(textHash('Deck')).not.toBe(textHash('deck'))
  })
})

describe('changedFields (TR edit detection)', () => {
  it('lists the sent fields whose text differs from the stored one', () => {
    expect(changedFields({ title: 'Yeni', alt: 'Aynı' }, { title: 'Eski', alt: 'Aynı', caption: 'x' })).toEqual(['title'])
  })
  it('an empty string over a null is not a change (the Galeri editor sends "" for an empty title)', () => {
    expect(changedFields({ title: '', alt: 'a' }, { title: null, alt: 'a' })).toEqual([])
  })
  it('fields not sent are not changes', () => {
    expect(changedFields({ status: 'approved' } as never, { title: 'x' })).toEqual([])
  })
  it('a create (no stored doc) with text counts as changed', () => {
    expect(changedFields({ alt: 'a' }, null)).toEqual(['alt'])
  })
})

describe('planSync (which locale fields the job may write)', () => {
  const tr = { title: 'Yeni başlık', alt: 'Yeni alt', caption: 'Açıklama' }

  it('rewrites a field whose locale text is still the AI text, and marks a hand-edited one stale', () => {
    const sync: I18nSync = {
      prov: { en: { alt: made('Eski alt', 'Old alt') }, de: { alt: made('Eski alt', 'Alter Alt') } },
      pending: ['alt'],
    }
    const plan = planSync({
      tr,
      locales: { en: { alt: 'Old alt' }, de: { alt: 'Von Hand geändert' } },
      sync,
      force: false,
    })
    expect(plan.translate).toEqual({ en: ['alt'] })
    expect(plan.clear).toEqual({})
    expect(plan.edited).toEqual(['de'])
  })

  it('translates only the changed fields', () => {
    const sync: I18nSync = { prov: { en: { title: made('Eski', 'Old'), alt: made('Yeni alt', 'New alt') } }, pending: ['title'] }
    const plan = planSync({ tr, locales: { en: { title: 'Old', alt: 'New alt' } }, sync, force: false })
    expect(plan.translate).toEqual({ en: ['title'] })
  })

  it('a field whose provenance names an older TR text needs work even when not pending (lost or retried job)', () => {
    const sync: I18nSync = { prov: { en: { caption: made('Eski açıklama', 'Old caption') } } }
    const plan = planSync({ tr, locales: { en: { caption: 'Old caption' } }, sync, force: false })
    expect(plan.translate).toEqual({ en: ['caption'] })
  })

  it('a locale already made from the current TR text needs nothing (a retried job does not pay twice)', () => {
    const sync: I18nSync = { prov: { en: { alt: made('Yeni alt', 'New alt') } }, pending: ['alt'] }
    const plan = planSync({ tr, locales: { en: { alt: 'New alt' } }, sync, force: false })
    expect(plan.translate).toEqual({})
    expect(plan.edited).toEqual([])
  })

  it('an empty locale field is filled; a locale without provenance but with text is hand-made (seeded) and goes stale', () => {
    const plan = planSync({ tr, locales: { ru: { alt: '' }, ar: { alt: 'نص مراجع يدويًا' } }, sync: { pending: ['alt'] }, force: false })
    expect(plan.translate).toEqual({ ru: ['alt'] })
    expect(plan.edited).toEqual(['ar'])
  })

  it('an emptied TR field clears the AI-made locale text and is never sent to the model', () => {
    const sync: I18nSync = { prov: { en: { caption: made('Açıklama', 'Caption') } }, pending: ['caption'] }
    const plan = planSync({ tr: { ...tr, caption: '' }, locales: { en: { caption: 'Caption' } }, sync, force: false })
    expect(plan.translate).toEqual({})
    expect(plan.clear).toEqual({ en: ['caption'] })
  })

  it('force (the explicit button) rewrites every non-empty TR field in every locale, hand-edited ones too', () => {
    const plan = planSync({
      tr: { title: 'Başlık', alt: 'Alt', caption: '' },
      locales: { en: { title: 'Hand', alt: 'Hand' }, de: {} },
      sync: null,
      force: true,
    })
    expect(plan.translate).toEqual({ en: ['title', 'alt'], de: ['title', 'alt'] })
    expect(plan.edited).toEqual([])
  })
})

describe('settleSync (the stored state after a job)', () => {
  const tr = { title: 'Başlık', alt: 'Alt metin', caption: '' }

  it('records provenance of what was written, clears pending, keeps and adds stale locales', () => {
    const before: I18nSync = { prov: { en: { caption: made('Eski', 'Old') } }, pending: ['alt', 'caption'], stale: { ar: 'edited' } }
    const next = settleSync({
      sync: before,
      tr,
      plan: { translate: { en: ['alt'] }, clear: { en: ['caption'] }, edited: ['de'] },
      written: { en: { alt: 'Alt text' } },
      failed: false,
    })
    expect(next).toEqual({
      prov: { en: { alt: { src: textHash('Alt metin'), ai: textHash('Alt text') } } },
      stale: { ar: 'edited', de: 'edited' },
    })
  })

  it('a locale written again is no longer stale', () => {
    const next = settleSync({
      sync: { stale: { de: 'edited', ru: 'failed' } },
      tr,
      plan: { translate: { de: ['title'], ru: ['title'] }, clear: {}, edited: [] },
      written: { de: { title: 'Titel' }, ru: { title: 'Заголовок' } },
      failed: false,
    })
    expect(next.stale).toBeUndefined()
  })

  it('a failed or refused call marks the locales that needed work as "failed", never over "edited"', () => {
    const next = settleSync({
      sync: { pending: ['alt'] },
      tr,
      plan: { translate: { en: ['alt'], de: ['alt'] }, clear: {}, edited: ['ar'] },
      written: {},
      failed: true,
    })
    expect(next).toEqual({ stale: { en: 'failed', de: 'failed', ar: 'edited' } })
  })
})

describe('backfillSync (seeded photos: their non-TR texts came from the seed AI pipeline)', () => {
  it('records the current TR text as source and the current locale text as AI text, skipping empty locale fields', () => {
    const sync = backfillSync({ title: 'Kamelya', alt: 'Çam kamelya', caption: null }, { en: { title: 'Gazebo', alt: '' }, de: { title: 'Pavillon', alt: 'Kiefernpavillon' } })
    expect(sync).toEqual({
      prov: {
        en: { title: { src: textHash('Kamelya'), ai: textHash('Gazebo') } },
        de: { title: { src: textHash('Kamelya'), ai: textHash('Pavillon') }, alt: { src: textHash('Çam kamelya'), ai: textHash('Kiefernpavillon') } },
      },
    })
  })
  it('a photo with no non-TR text gets nothing to record', () => {
    expect(backfillSync({ title: 'Kamelya' }, { en: {}, de: { alt: ' ' } })).toBeNull()
  })
  it('after a backfill, a TR edit makes the job rewrite the locale (it reads as AI text)', () => {
    const tr = { alt: 'Çam kamelya' }
    const sync = { ...backfillSync(tr, { en: { alt: 'Pine gazebo' } })!, pending: ['alt' as const] }
    expect(planSync({ tr: { alt: 'Teak kamelya' }, locales: { en: { alt: 'Pine gazebo' } }, sync, force: false }).translate).toEqual({ en: ['alt'] })
  })
})
