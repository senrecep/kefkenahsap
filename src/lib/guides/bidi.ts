// #146: Latin binomials (*Milicia excelsa*, *Quercus* spp.) inside Arabic text get scrambled by the bidi algorithm next to
// parentheses. The renderer wraps each italic Latin-script run (plus a following "spp."/"sp."/"var."/"subsp.") in an LTR isolate.
type Text = { type?: string; text?: string; format?: number }

const ITALIC = 2
const LATIN = /^[\p{Script=Latin}\s.'’-]+$/u
const TAIL = /^\s+(?:spp?|subsp|var)\./

const isLatinItalic = (n: Text | undefined) => n?.type === 'text' && Boolean((n.format ?? 0) & ITALIC) && LATIN.test(n.text ?? '') && /\p{L}/u.test(n.text ?? '')
const plain = (n: Text | undefined) => n?.type === 'text' && !((n.format ?? 0) & ITALIC)

/** For the text node at `i` among `siblings`: isolate it (with `tail` appended), or render it with its first `skip` chars dropped. */
export function latinRun(siblings: Text[], i: number): { isolate: true; tail: string } | { isolate: false; skip: number } {
  const node = siblings[i]
  const next = siblings[i + 1]
  if (isLatinItalic(node)) return { isolate: true, tail: plain(next) ? (TAIL.exec(next!.text ?? '')?.[0] ?? '') : '' }
  if (plain(node) && isLatinItalic(siblings[i - 1])) return { isolate: false, skip: TAIL.exec(node!.text ?? '')?.[0].length ?? 0 }
  return { isolate: false, skip: 0 }
}
