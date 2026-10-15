import { describe, expect, it } from 'vitest'

import { blockNode, hasBlock, insertBlockAfter, markdownWithBlocks, replaceText, textOf } from './blocks'

// Stand-in converter: one paragraph node per non-empty line, so the expected trees are written by hand.
const toLexical = (md: string) => ({
  root: {
    type: 'root',
    children: md
      .split('\n')
      .filter((l) => l.trim())
      .map((text) => ({ type: 'paragraph', children: [{ type: 'text', text }] })),
  },
})
const p = (text: string) => ({ type: 'paragraph', children: [{ type: 'text', text }] })

describe('markdownWithBlocks', () => {
  it('replaces a `<!-- block:x -->` line with a Payload block node, in place', () => {
    const out = markdownWithBlocks('a\n\n<!-- block:woodSamples -->\n\nb', toLexical)
    expect(out.root.children).toEqual([p('a'), blockNode('woodSamples', 1), p('b')])
  })

  it('leaves markdown without a marker to the converter alone', () => {
    expect(markdownWithBlocks('a\nb', toLexical)).toEqual(toLexical('a\nb'))
  })

  it('builds the node shape the admin writes: block v2 with id, empty blockName and blockType', () => {
    expect(blockNode('woodSamples', 3)).toEqual({
      type: 'block',
      version: 2,
      format: '',
      fields: { id: expect.stringMatching(/^[0-9a-f]{20}0003$/), blockName: '', blockType: 'woodSamples' },
    })
  })

  it('gives two blocks of one type in one body different ids', () => {
    const out = markdownWithBlocks('a\n<!-- block:woodSamples -->\nb\n<!-- block:woodSamples -->', toLexical)
    const ids = out.root.children.filter((n) => (n as { type: string }).type === 'block').map((n) => (n as unknown as { fields: { id: string } }).fields.id)
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
  })
})

describe('insertBlockAfter', () => {
  const body = { root: { type: 'root', children: [p('one'), p('two'), p('three')] } }

  it('inserts the block after the first top-level node matching the predicate', () => {
    const out = insertBlockAfter(body, 'woodSamples', (n) => JSON.stringify(n).includes('two'))
    expect(out?.root.children).toEqual([p('one'), p('two'), blockNode('woodSamples', 2), p('three')])
  })

  it('returns undefined when no node matches or the block is already there (idempotent)', () => {
    expect(insertBlockAfter(body, 'woodSamples', () => false)).toBeUndefined()
    const withBlock = { root: { type: 'root', children: [p('one'), blockNode('woodSamples', 1)] } }
    expect(insertBlockAfter(withBlock, 'woodSamples', () => true)).toBeUndefined()
    expect(hasBlock(withBlock, 'woodSamples')).toBe(true)
    expect(hasBlock(body, 'woodSamples')).toBe(false)
  })
})

describe('replaceText', () => {
  const split = { type: 'paragraph', children: [{ type: 'text', text: 'Old ', format: 0 }, { type: 'text', text: 'note.', format: 2 }] }
  const cell = { type: 'tablecell', children: [{ type: 'paragraph', children: [{ type: 'text', text: ' Thermowood* ', format: 0 }] }] }
  const body = { root: { type: 'root', children: [split, { type: 'table', children: [{ type: 'tablerow', children: [cell] }] }] } }

  it('replaces a node whose whole text equals `from` with one plain text node, at any depth', () => {
    const out = replaceText(replaceText(body, 'Old note.', 'New note.')!, 'Thermowood*', 'Thermowood')!
    expect(textOf(out.root)).toBe('New note.Thermowood')
    expect((out.root.children[0] as { children: unknown[] }).children).toEqual([{ type: 'text', text: 'New note.', format: 0 }])
  })

  it('returns undefined when nothing still holds the old text (edited or already fixed)', () => {
    expect(replaceText(body, 'Old', 'x')).toBeUndefined()
    expect(replaceText(body, 'missing', 'x')).toBeUndefined()
  })
})
