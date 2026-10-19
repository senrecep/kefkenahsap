import { describe, expect, it } from 'vitest'

import { MAX_REMEMBERED, MAX_SAVED, parseRemembered, parseSaved, remember, saveEntry, suggest, type SavedEntry } from './memory'

const at = (min: number) => new Date(Date.UTC(2026, 9, 19, 9, min))
const entry = (id: string, min = 0): SavedEntry => ({ id, title: id, savedAt: at(min).toISOString(), link: `1.${id}` })

describe('saved calculations (device only)', () => {
  it('puts the newest first and replaces an entry saved again under the same id', () => {
    const list = saveEntry(saveEntry(saveEntry([], entry('a', 1)), entry('b', 2)), { ...entry('a', 3), title: 'A2' })
    expect(list.map((e) => e.title)).toEqual(['A2', 'b'])
  })

  it(`keeps at most ${MAX_SAVED}`, () => {
    let list: SavedEntry[] = []
    for (let i = 0; i < MAX_SAVED + 3; i++) list = saveEntry(list, entry(`e${i}`, i))
    expect(list).toHaveLength(MAX_SAVED)
    expect(list[0]!.id).toBe(`e${MAX_SAVED + 2}`)
  })

  it('reads only well-formed storage, else an empty list', () => {
    expect(parseSaved(JSON.stringify([entry('a')]))).toEqual([entry('a')])
    expect(parseSaved('not json')).toEqual([])
    expect(parseSaved(null)).toEqual([])
    expect(parseSaved(JSON.stringify([{ id: 1 }, entry('b')]))).toEqual([entry('b')])
  })
})

describe('remembered extra items (suggestions while typing)', () => {
  const extras = [
    { d: 'Paslanmaz vida', q: '2', u: 'kg' as const, p: '180' },
    { d: 'Nakliye', q: '', u: 'goturu' as const, p: '1500' },
    { d: '', q: '1', u: 'adet' as const, p: '5' }, // no description: nothing to remember
  ]

  it('remembers description, unit and last price; using one again moves it to the top', () => {
    let mem = remember([], extras, at(1))
    mem = remember(mem, [{ d: 'paslanmaz VİDA ', q: '1', u: 'kutu', p: '200' }], at(2))
    expect(mem.map((m) => [m.d, m.u, m.p, m.n])).toEqual([
      ['paslanmaz VİDA', 'kutu', '200', 2],
      ['Nakliye', 'goturu', '1500', 1],
    ])
  })

  it(`keeps the ${MAX_REMEMBERED} most recently used`, () => {
    let mem = remember([], [], at(0))
    for (let i = 0; i < MAX_REMEMBERED + 4; i++) mem = remember(mem, [{ d: `Kalem ${i}`, q: '1', u: 'adet', p: '1' }], at(i))
    expect(mem).toHaveLength(MAX_REMEMBERED)
    expect(mem.some((m) => m.d === 'Kalem 0')).toBe(false)
  })

  it('suggests by any word start, Turkish case-insensitively, skipping an exact match', () => {
    const mem = remember([], [...extras, { d: 'İnce zımpara', q: '1', u: 'adet', p: '10' }], at(1))
    expect(suggest(mem, 'vi').map((m) => m.d)).toEqual(['Paslanmaz vida'])
    expect(suggest(mem, 'ince').map((m) => m.d)).toEqual(['İnce zımpara'])
    expect(suggest(mem, 'Nakliye')).toEqual([])
    expect(suggest(mem, '').length).toBe(3)
  })

  it('reads only well-formed storage', () => {
    expect(parseRemembered('[{"d":"x"}]')).toEqual([])
    expect(parseRemembered(null)).toEqual([])
  })
})
