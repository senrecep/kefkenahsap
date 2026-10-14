import { describe, expect, it } from 'vitest'
import { Result } from 'tsentials/result'

import { allowedPhotoIds, draftData, draftUpdateArgs, guideLexical, isDraftable, parseNotes, siteFacts, storyLexical } from './draft'

describe('parseNotes: the editor’s bullet notes', () => {
  it('one note per line, list markers and blanks dropped', () => {
    const r = parseNotes('- Iroko deck, 40 m²\n* Riva’da bir villa\n\n• 3 hafta sürdü\n  havuz kenarı  ')
    expect(Result.isSuccess(r) && r.value).toEqual(['Iroko deck, 40 m²', 'Riva’da bir villa', '3 hafta sürdü', 'havuz kenarı'])
  })
  it('needs at least one note and stays bounded', () => {
    const empty = parseNotes(' \n - ')
    expect(Result.isFailure(empty) && empty.errors[0]?.code).toBe('Draft.NotesRequired')
    const long = parseNotes(Array.from({ length: 41 }, (_, i) => `not ${i}`).join('\n'))
    expect(Result.isFailure(long) && long.errors[0]?.code).toBe('Draft.NotesTooLong')
  })
})

describe('siteFacts: the only facts besides the notes the model may restate', () => {
  it('lists filled site settings and nothing for empty ones', () => {
    const facts = siteFacts({
      companyName: 'Kefken Ahşap Dekorasyon',
      foundingYear: 2009,
      founder: { name: 'Murat Şen', craftStartYear: null },
      teamSize: null,
      projectCount: undefined,
      address: { city: 'İstanbul', district: 'Ümraniye' },
      areaServed: [{ name: 'Sarıyer' }, { name: 'Beykoz' }],
    })
    expect(facts).toEqual([
      'Firma adı: Kefken Ahşap Dekorasyon',
      'Kuruluş yılı: 2009',
      'Kurucu: Murat Şen',
      'Adres: Ümraniye, İstanbul',
      'Hizmet verilen bölgeler: Sarıyer, Beykoz',
    ])
    expect(facts.join(' ')).not.toMatch(/ekip|proje sayısı|mesleğe/i)
  })
})

describe('Lexical builders', () => {
  it('guide: H2 per section, paragraphs, bullet list; plain text nodes only', () => {
    const doc = guideLexical([{ heading: 'Ne zaman bakım?', paragraphs: ['Yüzey grileşince.'], bullets: ['Yıkayın', 'Yağlayın'] }])
    const kids = doc.root.children
    expect(kids.map((k) => k.type)).toEqual(['heading', 'paragraph', 'list'])
    expect(kids[0]).toMatchObject({ tag: 'h2', children: [{ type: 'text', text: 'Ne zaman bakım?' }] })
    expect(kids[2]).toMatchObject({ listType: 'bullet', tag: 'ul', children: [{ type: 'listitem', value: 1 }, { type: 'listitem', value: 2 }] })
  })
  it('project story: one paragraph each', () => {
    expect(storyLexical(['Bir.', 'İki.']).root.children.map((k) => k.children![0]!.text)).toEqual(['Bir.', 'İki.'])
  })
})

describe('no code path can publish an AI draft', () => {
  it('draftData never carries _status, even when the model adds one', () => {
    const guide = draftData('guides', { excerpt: 'Kısa.', sections: [], _status: 'published' } as never, { excerpt: null })
    expect(guide).not.toHaveProperty('_status')
    const story = draftData('projects', { paragraphs: ['Bir.'], _status: 'published' } as never, {})
    expect(story).not.toHaveProperty('_status')
  })
  it('the only update arguments are draft: true and data without _status', () => {
    const args = draftUpdateArgs({ collection: 'guides', id: 7, data: { body: {}, _status: 'published' } as Record<string, unknown> })
    expect(args.draft).toBe(true)
    expect(args.locale).toBe('tr')
    expect(args.data).not.toHaveProperty('_status')
    expect(args.overrideAccess).toBe(false)
  })
  it('keeps a guide excerpt a person already wrote', () => {
    expect(draftData('guides', { excerpt: 'AI', sections: [] }, { excerpt: 'Elle yazıldı' })).not.toHaveProperty('excerpt')
  })
})

describe('draft scope guards', () => {
  it('isDraftable: guides and projects only, no prototype keys', () => {
    expect(isDraftable('guides')).toBe(true)
    expect(isDraftable('projects')).toBe(true)
    for (const c of ['pages', 'categories', 'users', 'media', 'constructor', '__proto__', 'toString', ''])
      expect(isDraftable(c), c).toBe(false)
  })

  it('allowedPhotoIds: only photos attached to this document (gallery ids or populated, cover)', () => {
    expect(allowedPhotoIds([1, 2, 3, 9], { gallery: [1, { id: 2 }], cover: 3 })).toEqual([1, 2, 3])
    expect(allowedPhotoIds([1], {})).toEqual([])
    expect(allowedPhotoIds([5], { gallery: null, cover: { id: 5 } })).toEqual([5])
  })
})
