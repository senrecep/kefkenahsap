import { describe, expect, it } from 'vitest'

import { bodyWords, regionGate } from './gate'

const text = (t: string, format = 0) => ({ type: 'text', text: t, format })
const para = (...children: object[]) => ({ type: 'paragraph', children })
const doc = (...children: object[]) => ({ root: { type: 'root', children } })
const words = (n: number) => Array.from({ length: n }, (_, i) => `kelime${i}`).join(' ')

describe('bodyWords', () => {
  it('is 0 for an empty or missing body', () => {
    expect(bodyWords(null)).toBe(0)
    expect(bodyWords(undefined)).toBe(0)
    expect(bodyWords(doc())).toBe(0)
  })

  it('counts words across headings, paragraphs and nested lists', () => {
    const body = doc(
      { type: 'heading', tag: 'h2', children: [text('Kartal’da hangi işler?')] }, // 3
      para(text('Bahçe deck’i ve pergola.')), // 4
      { type: 'list', children: [{ type: 'listitem', children: [text('iroko')] }, { type: 'listitem', children: [text('teak zemin')] }] }, // 3
    )
    expect(bodyWords(body)).toBe(10)
  })

  it('does not split a word formatted in two text runs, and separates blocks', () => {
    // "Ahş" + bold "ap" is one word; "son" ends one paragraph and "ilk" starts the next.
    expect(bodyWords(doc(para(text('Ahş'), text('ap', 1), text(' son')), para(text('ilk'))))).toBe(3)
  })

  it('ignores punctuation-only tokens', () => {
    expect(bodyWords(doc(para(text('iroko — teak , 2024 …'))))).toBe(3)
  })
})

describe('regionGate', () => {
  const ok = doc(para(text(words(250))))

  it('passes with 3 projects and 250 words', () => {
    expect(regionGate({ projects: 3, body: ok })).toEqual({ indexable: true, projects: 3, words: 250 })
  })

  it('fails with 2 projects even with enough text', () => {
    expect(regionGate({ projects: 2, body: ok }).indexable).toBe(false)
  })

  it('fails with 249 words even with enough projects', () => {
    expect(regionGate({ projects: 10, body: doc(para(text(words(249)))) })).toEqual({ indexable: false, projects: 10, words: 249 })
  })

  it('fails with no body', () => {
    expect(regionGate({ projects: 5, body: null }).indexable).toBe(false)
  })
})
