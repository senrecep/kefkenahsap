// #146: Payload blocks inside seeded markdown. A line `<!-- block:<blockType> -->` becomes a block node at that place
// (Payload's markdown converter has no syntax for a field-less block). Pure: the converter is passed in.

type Node = { type?: string; fields?: { blockType?: string }; children?: Node[] }
type State = { root: { type: string; children: unknown[] } & Record<string, unknown> } & Record<string, unknown>

const MARKER = /^[ \t]*<!--\s*block:([A-Za-z][\w-]*)\s*-->[ \t]*$/m

/** The node the admin writes for a block without fields. The id is stable per block type, so re-seeding is a no-op. */
export const blockNode = (blockType: string) => ({
  type: 'block',
  version: 2,
  format: '',
  fields: {
    id: Array.from(blockType, (c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('').padEnd(24, '0').slice(0, 24),
    blockName: '',
    blockType,
  },
})

/** Markdown → Lexical with each marker line replaced by its block node. */
export function markdownWithBlocks<T extends State>(markdown: string, toLexical: (md: string) => T): T {
  const parts = markdown.split(MARKER) // [md, type, md, type, md…]
  if (parts.length === 1) return toLexical(markdown)
  const first = toLexical(parts[0]!)
  const children: unknown[] = [...first.root.children]
  for (let i = 1; i < parts.length; i += 2) {
    children.push(blockNode(parts[i]!))
    if (parts[i + 1]?.trim()) children.push(...toLexical(parts[i + 1]!).root.children)
  }
  return { ...first, root: { ...first.root, children } }
}

const contains = (n: Node, blockType: string): boolean =>
  (n.type === 'block' && n.fields?.blockType === blockType) || (n.children ?? []).some((c) => contains(c, blockType))
export const hasBlock = (body: { root?: Node } | null | undefined, blockType: string) => Boolean(body?.root && contains(body.root, blockType))

/** A copy of `body` with the block after the first top-level node matching `after`; undefined if no match or already present. */
export function insertBlockAfter<T extends State>(body: T, blockType: string, after: (node: unknown) => boolean): T | undefined {
  if (hasBlock(body as { root?: Node }, blockType)) return undefined
  const at = body.root.children.findIndex(after)
  if (at < 0) return undefined
  const children = [...body.root.children]
  children.splice(at + 1, 0, blockNode(blockType))
  return { ...body, root: { ...body.root, children } }
}

type TextNode = { type?: string; text?: string; children?: TextNode[] } & Record<string, unknown>
/** Concatenated text of a Lexical node. */
export const textOf = (n: unknown): string => {
  const node = n as TextNode
  return (node.text ?? '') + (node.children ?? []).map(textOf).join('')
}

/**
 * A copy of `body` where each element whose children are only text nodes reading exactly `from` gets one plain text node
 * with `to` (surrounding spaces ignored: table cells keep them). Undefined when no node holds `from`: the owner edited it, or it is already fixed.
 */
export function replaceText<T extends State>(body: T, from: string, to: string): T | undefined {
  let hits = 0
  const walk = (n: TextNode): TextNode => {
    const kids = n.children
    if (!kids?.length) return n
    if (kids.every((k) => k.type === 'text') && textOf(n).trim() === from) {
      hits++
      return { ...n, children: [{ ...kids[0]!, text: to, format: 0 }] }
    }
    return { ...n, children: kids.map(walk) }
  }
  const root = walk(body.root as unknown as TextNode)
  return hits ? ({ ...body, root } as T) : undefined
}
