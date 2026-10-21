/** #256: `{ad}`, `{hizmet}`, `{konum}` in e-mail templates, filled from the linked lead. Pure; runs in the admin too. */

export type PlaceholderLead = { name?: string | null; service?: string | null; district?: string | null; city?: string | null }

type Node = { type?: string; text?: string; children?: Node[] }

const clean = (s?: string | null) => s?.trim() || undefined

const values = (lead?: PlaceholderLead): Record<string, string | undefined> => ({
  ad: clean(lead?.name),
  hizmet: clean(lead?.service),
  konum: [clean(lead?.district), clean(lead?.city)].filter(Boolean).join(', ') || undefined,
})

/** Every `{word}`: the lead's value, or `[word]` when it is empty or unknown, so the writer sees what is still missing. */
export function fillPlaceholders(text: string, lead?: PlaceholderLead): string {
  const v = values(lead)
  return text.replace(/\{([\p{L}_]+)\}/gu, (_, key: string) => v[key] ?? `[${key}]`)
}

/** A template applied to a lead: the subject and every text node of a deep copy of the Lexical body. */
export function fillTemplate<B>({ subject, body }: { subject: string; body: B }, lead?: PlaceholderLead): { subject: string; body: B } {
  const copy = structuredClone(body)
  const walk = (n: Node) => {
    if (n.type === 'text' && typeof n.text === 'string') n.text = fillPlaceholders(n.text, lead)
    n.children?.forEach(walk)
  }
  walk((copy as { root?: Node } | null)?.root ?? {})
  return { subject: fillPlaceholders(subject, lead), body: copy }
}

// Text of a node: inline children joined as they are, one line per paragraph/heading/list item (a bracket never spans two).
const INLINE = new Set(['text', 'linebreak', 'link', 'autolink', 'tab'])
const plain = (n: Node): string =>
  n.type === 'text' ? (n.text ?? '') : n.type === 'linebreak' ? '\n' : (n.children ?? []).map(plain).join('') + (INLINE.has(n.type ?? '') ? '' : '\n')

/** `[...]` parts to fill by hand and `{...}` tokens left in the subject and body, in order, once each (#256 send guard). */
export function unfilledFields(subject: string, body: unknown): string[] {
  const text = `${subject}\n${plain((body as { root?: Node } | null)?.root ?? {})}`
  return [...new Set(text.match(/\[[^[\]\n]{1,80}\]|\{[^{}\n]{1,40}\}/g) ?? [])]
}
