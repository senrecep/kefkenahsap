import { slugify } from '@/lib/slug'

type Node = { type?: string; tag?: string; text?: string; children?: unknown[] }
export type TocItem = { id: string; text: string }

/** Ids the guide page and layout already use (layout `main`, page sections); headings never take them. */
export const RESERVED_IDS = new Set(['main', 'mobile-menu', 'toc-title', 'faq', 'related', 'guide-cta'])

const textOf = (node: Node): string => (node.text ?? '') + (node.children ?? []).map((c) => textOf(c as Node)).join('')

/**
 * Table of contents from the H2s of a Lexical body. `idOf` hands the renderer the same anchor id for the same
 * heading node, so TOC links and heading ids cannot drift apart.
 */
export function tableOfContents(body: { root?: Node } | null | undefined): { items: TocItem[]; idOf: (node: unknown) => string | undefined } {
  const ids = new WeakMap<object, string>()
  const items: TocItem[] = []
  const used = new Set<string>(RESERVED_IDS)
  for (const child of (body?.root?.children ?? []) as Node[]) {
    if (child.type !== 'heading' || child.tag !== 'h2') continue
    const text = textOf(child).trim()
    if (!text) continue
    const slug = slugify(text)
    const base = slug.ok ? slug.value : `bolum-${items.length + 1}`
    let id = base
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`
    used.add(id)
    ids.set(child, id)
    items.push({ id, text })
  }
  return { items, idOf: (node) => (node && typeof node === 'object' ? ids.get(node) : undefined) }
}
