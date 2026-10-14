/** Meta description from the answer-first excerpt: whole sentences up to `max` chars, else a word-boundary cut + "…". */
export function metaDescription(text: string | null | undefined, max = 160): string {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  let out = ''
  for (const s of clean.split(/(?<=[.!?])\s+/)) {
    const next = out ? `${out} ${s}` : s
    if (next.length > max) break
    out = next
  }
  if (out) return out
  return `${clean.slice(0, max - 1).replace(/\s+\S*$/, '')}…`
}
