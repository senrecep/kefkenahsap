// "Fill only empty" rule for seed content: the loader must never overwrite what the owner edited in the admin.

type Node = { text?: unknown; children?: unknown; root?: unknown }

const hasText = (n: unknown): boolean => {
  if (!n || typeof n !== 'object') return false
  const node = n as Node
  if (typeof node.text === 'string' && node.text.trim()) return true
  if (node.root) return hasText(node.root)
  return Array.isArray(node.children) && node.children.some(hasText)
}

/** null / blank string / [] / a Lexical state with no text (a cleared editor is a root with one empty paragraph). */
export function isEmpty(v: unknown): boolean {
  if (v === undefined || v === null) return true
  if (typeof v === 'string') return v.trim() === ''
  if (Array.isArray(v)) return v.length === 0
  if (typeof v === 'object' && 'root' in v) return !hasText(v)
  return false
}

/**
 * The patch to write: incoming fields whose current value is empty (or all non-empty incoming fields with `force`).
 * Whole fields only — a FAQ the owner touched at all is left as is. An empty patch means "skip the write".
 */
export function fillEmpty<T extends Record<string, unknown>>(current: Partial<Record<keyof T, unknown>>, incoming: T, opts: { force?: boolean } = {}): Partial<T> {
  const patch: Partial<T> = {}
  for (const key of Object.keys(incoming) as (keyof T)[]) {
    if (isEmpty(incoming[key])) continue
    if (opts.force || isEmpty(current[key])) patch[key] = incoming[key]
  }
  return patch
}

type RenameText = { name: string; slug: string; shortDesc: string }

/**
 * #172 one locale of a renamed category: name and slug move while they are still the old seeded value (or empty).
 * The intro is the sentinel for the text: while it is still the old seeded intro, shortDesc/body/faq are replaced as a
 * block; once the owner edited it, only empty text fields are filled (fillEmpty). A second run writes nothing.
 */
export function renamePatch<T extends RenameText & Record<string, unknown>>(current: Partial<Record<keyof T, unknown>>, from: RenameText, to: T): Partial<T> {
  const moved = (k: keyof RenameText) => isEmpty(current[k]) || current[k] === from[k]
  const { name, slug, ...text } = to
  return {
    ...(moved('name') ? { name } : {}),
    ...(moved('slug') ? { slug } : {}),
    ...fillEmpty(current as Partial<Record<keyof typeof text, unknown>>, text, { force: current.shortDesc === from.shortDesc }),
  } as Partial<T>
}
