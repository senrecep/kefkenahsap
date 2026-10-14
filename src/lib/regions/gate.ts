/** Region publish gate (PLAN §4, decision #25): enough real work and enough hand-written text, or noindex. */
export const MIN_PROJECTS = 3
export const MIN_WORDS = 250

type Node = { type?: string; text?: string; children?: Node[] }
type Body = { root?: Node } | null | undefined

// Text runs inside one block join without a space ("Ahş" + bold "ap"); every block ends with one.
const textOf = (n: Node): string => (n.type === 'text' ? (n.text ?? '') : n.type === 'linebreak' ? ' ' : `${(n.children ?? []).map(textOf).join('')} `)

/** Plain text of a Lexical body, whitespace collapsed (meta description source). */
export const bodyText = (body: Body): string => (body?.root ? textOf(body.root).replace(/\s+/g, ' ').trim() : '')

/** Words in a Lexical body: whitespace-separated tokens holding a letter or digit (same rule as content/schema wordCount). */
export const bodyWords = (body: Body): number => bodyText(body).split(' ').filter((w) => /\p{L}|\p{N}/u.test(w)).length

/** Indexable only with ≥3 published projects in the region and ≥250 words of its own body (in that locale). */
export function regionGate(args: { projects: number; body: Body }) {
  const words = bodyWords(args.body)
  return { indexable: args.projects >= MIN_PROJECTS && words >= MIN_WORDS, projects: args.projects, words }
}
