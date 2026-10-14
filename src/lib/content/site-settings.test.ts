import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { TR_WHATSAPP_TEMPLATES } from '../../../scripts/seed/site-settings'
import { parseSiteSettingsOverlay } from './schema'
import { siteSettingsFill } from './site-settings'

const overlay = {
  phones: [
    { number: '0532 295 84 16', label: 'Мобильный / WhatsApp' },
    { number: '0212 322 43 59', label: 'Городской' },
  ],
  areaServed: [{ name: 'Стамбул' }, { name: 'Турция' }],
  whatsappTemplates: { default: 'Здравствуйте.', contact: 'Хочу запросить предложение.' },
  defaultDescription: 'Описание.',
}

describe('siteSettingsFill', () => {
  it('fills empty localized fields and matches phones by number, areas by index', () => {
    const current = {
      phones: [
        { id: 'b', number: '0212 322 43 59', label: null, whatsapp: false },
        { id: 'a', number: '0532 295 84 16', label: null, whatsapp: true },
      ],
      areaServed: [{ id: 'x', name: null, kind: 'city' as const }],
      whatsappTemplates: { default: null, contact: null },
      defaultDescription: null,
    }
    expect(siteSettingsFill(current, overlay)).toEqual({
      phones: [
        { id: 'b', number: '0212 322 43 59', label: 'Городской', whatsapp: false },
        { id: 'a', number: '0532 295 84 16', label: 'Мобильный / WhatsApp', whatsapp: true },
      ],
      areaServed: [{ id: 'x', name: 'Стамбул', kind: 'city' }],
      whatsappTemplates: { default: 'Здравствуйте.', contact: 'Хочу запросить предложение.' },
      defaultDescription: 'Описание.',
    })
  })

  it('never overwrites a filled value and returns an empty patch when nothing is left', () => {
    const current = {
      phones: [{ id: 'a', number: '0532 295 84 16', label: 'Свой', whatsapp: true }],
      areaServed: [{ id: 'x', name: 'Своё', kind: 'city' as const }],
      whatsappTemplates: { default: 'Своё', contact: 'Своё' },
      defaultDescription: 'Своё',
    }
    expect(siteSettingsFill(current, overlay)).toEqual({})
  })

  it('leaves the rows alone while one of them has no translation (label is required)', () => {
    const current = {
      phones: [
        { id: 'a', number: '0532 295 84 16', label: null },
        { id: 'c', number: '0555 000 00 00', label: null },
      ],
    }
    expect(siteSettingsFill(current, overlay).phones).toBeUndefined()
  })

  it('keeps a filled template next to a filled-in empty one', () => {
    const current = { whatsappTemplates: { default: 'Своё', contact: '' } }
    expect(siteSettingsFill(current, overlay).whatsappTemplates).toEqual({ default: 'Своё', contact: 'Хочу запросить предложение.' })
  })
})

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe.each(['ru', 'de', 'ar'])('seed/i18n/%s/site-settings.json', (locale) => {
  const r = parseSiteSettingsOverlay(readFileSync(path.resolve(process.cwd(), 'seed/i18n', locale, 'site-settings.json'), 'utf8'))
  it('is valid', () => expect(r.ok).toBe(true))
  it.each(Object.entries(TR_WHATSAPP_TEMPLATES))('template %s keeps the TR placeholders', (key, tr) => {
    if (!r.ok) throw new Error('invalid overlay')
    const t = r.value.whatsappTemplates?.[key as keyof typeof TR_WHATSAPP_TEMPLATES]
    expect(t).toBeTruthy()
    expect(placeholders(t!)).toEqual(placeholders(tr))
  })
})
