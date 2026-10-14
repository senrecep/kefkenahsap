import { describe, expect, it } from 'vitest'

import { keyFacts, llmsTxt } from './llms'

const SITE = 'https://www.kefkenahsap.com'

describe('keyFacts (llms.txt, from siteSettings)', () => {
  it('lists only filled fields, never a made-up value', () => {
    expect(keyFacts({ companyName: 'Kefken Ahşap Dekorasyon', foundingYear: null, email: '', social: { instagram: null } }, SITE)).toEqual([
      '- Name: Kefken Ahşap Dekorasyon',
      `- Website: ${SITE}`,
    ])
  })

  it('NAP, founder, founding year, hours, areas, services and profiles', () => {
    expect(
      keyFacts(
        {
          companyName: 'Kefken Ahşap Dekorasyon',
          founderName: 'Murat Şen',
          foundingYear: 2009,
          address: { street: 'Mavigöl, Münteha Sk. No:31', district: 'Arnavutköy', city: 'İstanbul', postalCode: '34287', country: 'TR' },
          phones: [{ label: 'Cep / WhatsApp', number: '0532 295 84 16' }, { number: '0212 322 43 59' }],
          email: 'info@example.com',
          hours: [{ days: ['Mo', 'Tu'], opens: '08:00', closes: '18:00' }],
          areaServed: [{ name: 'İstanbul' }, { name: 'Türkiye' }],
          services: ['Deck ve Zeminler', 'Merdivenler'],
          social: { instagram: 'https://instagram.com/k', facebook: 'https://facebook.com/k', googleBusiness: 'https://g.page/k' },
        },
        SITE,
      ),
    ).toEqual([
      '- Name: Kefken Ahşap Dekorasyon',
      `- Website: ${SITE}`,
      '- Founder: Murat Şen',
      '- Founded: 2009',
      '- Address: Mavigöl, Münteha Sk. No:31, Arnavutköy, İstanbul, 34287, TR',
      '- Phone: 0532 295 84 16 (Cep / WhatsApp)',
      '- Phone: 0212 322 43 59',
      '- Email: info@example.com',
      '- Opening hours: Mo, Tu 08:00–18:00',
      '- Areas served: İstanbul, Türkiye',
      '- Services: Deck ve Zeminler, Merdivenler',
      '- Instagram: https://instagram.com/k',
      '- Facebook: https://facebook.com/k',
      '- Google Business Profile: https://g.page/k',
    ])
  })
})

describe('llmsTxt', () => {
  const sections = [{ title: 'Hizmetler', items: [{ name: 'Deck ve Zeminler', url: `${SITE}/tr/deck-ve-zeminler`, text: 'Iroko deck.' }, { name: 'Merdivenler', url: `${SITE}/tr/merdivenler` }] }]

  it('llms.txt: title, summary, Key Facts and link lists', () => {
    expect(llmsTxt({ title: 'Kefken', summary: 'Ahşap işleri.', facts: ['- Name: Kefken'], sections })).toBe(
      [
        '# Kefken',
        '',
        '> Ahşap işleri.',
        '',
        '## Key Facts',
        '',
        '- Name: Kefken',
        '',
        '## Hizmetler',
        '',
        `- [Deck ve Zeminler](${SITE}/tr/deck-ve-zeminler): Iroko deck.`,
        `- [Merdivenler](${SITE}/tr/merdivenler)`,
        '',
      ].join('\n'),
    )
  })

  it('llms-full.txt: each item gets its own heading with the full text; no summary line when empty', () => {
    const out = llmsTxt({ title: 'Kefken', summary: '', facts: [], sections, full: true })
    expect(out).toBe(
      [
        '# Kefken',
        '',
        '## Hizmetler',
        '',
        `### [Deck ve Zeminler](${SITE}/tr/deck-ve-zeminler)`,
        '',
        'Iroko deck.',
        '',
        `### [Merdivenler](${SITE}/tr/merdivenler)`,
        '',
      ].join('\n'),
    )
  })
})
