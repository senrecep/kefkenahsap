import { describe, expect, it } from 'vitest'

import { translateMediaSchema, translateMediaSystem } from './translateMedia'

describe('translateMedia prompt (#203)', () => {
  const schema = translateMediaSchema(['en', 'de'])

  it('accepts one string per target locale for each photo field', () => {
    const ok = schema.safeParse({ items: [{ id: 'alt', en: 'Light timber decking beside a pool', de: 'Helle Holzterrasse am Pool' }] })
    expect(ok.success).toBe(true)
  })

  it('holds each field to the tagImage limits: title ≤80, alt ≤125, caption ≤240', () => {
    const at = (id: string, n: number) => schema.safeParse({ items: [{ id, en: 'x'.repeat(n), de: 'Titel' }] }).success
    expect(at('title', 80)).toBe(true)
    expect(at('title', 81)).toBe(false)
    expect(at('alt', 125)).toBe(true)
    expect(at('alt', 126)).toBe(false)
    expect(at('caption', 240)).toBe(true)
    expect(at('caption', 241)).toBe(false)
  })

  it('rejects a field that is not a photo text', () => {
    expect(schema.safeParse({ items: [{ id: 'slug', en: 'x', de: 'y' }] }).success).toBe(false)
  })

  it('tells the model the targets, their language guidance, the house terms and the admin glossary', () => {
    const s = translateMediaSystem({ glossary: [{ tr: 'kamelya', en: 'gazebo' }], targets: ['de', 'ar'] })
    expect(s).toContain('tr → de, ar')
    expect(s).toContain('de: doğal Almanca')
    expect(s).toContain('ar: Modern Standart Arapça')
    expect(s).not.toContain('ru: doğal Rusça')
    // PR #181 native-editor terms
    expect(s).toContain('Terrassendielen')
    expect(s).toContain('kamelya = gazebo')
  })
})
