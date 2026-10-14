/**
 * "AI ile çevir": which texts of a document go to the model, and how the answers go back.
 * Only plain text fields and Lexical text nodes are sent; the Lexical JSON is rebuilt node for node.
 * A field the target locale already has is never sent and never overwritten.
 */
export type TranslateSpec = {
  /** The field that decides whether a locale is missing (PLAN §5.1: title + slug; the slug follows the title). */
  title: string
  /** Plain localized text fields; `group.field` for fields inside a group. */
  text: string[]
  /** Localized Lexical fields. */
  rich: string[]
  /** Localized arrays: the whole array is per locale, translated when the target has none. */
  arrays?: Record<string, string[]>
}

export const TRANSLATE_SPECS = {
  categories: { title: 'name', text: ['name', 'shortDesc', 'priceGuide.note', 'seo.title', 'seo.description'], rich: ['body'], arrays: { faq: ['q', 'a'] } },
  // Testimonial quotes are the customer's own words: never machine-translated.
  projects: { title: 'title', text: ['title', 'duration', 'finish'], rich: ['story'] },
  pages: { title: 'title', text: ['title', 'seo.title', 'seo.description'], rich: ['body'] },
  guides: { title: 'title', text: ['title', 'excerpt', 'seo.title', 'seo.description'], rich: ['body'], arrays: { faq: ['q', 'a'] } },
} satisfies Record<string, TranslateSpec>

export type TranslatableCollection = keyof typeof TRANSLATE_SPECS
export const isTranslatable = (c: string): c is TranslatableCollection => Object.hasOwn(TRANSLATE_SPECS, c)

export type Segment = { id: string; text: string }
type Doc = Record<string, unknown> | null | undefined
type LexNode = { type?: string; text?: unknown; children?: LexNode[]; [k: string]: unknown }

const get = (doc: Doc, path: string): unknown =>
  path.split('.').reduce<unknown>((v, k) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined), doc)
const blank = (v: unknown) => typeof v !== 'string' || !v.trim()

/** Every text node in document order (depth first), with its node so the caller can read or replace the text. */
const IS_CODE = 16 // Lexical text format bit
/** Not prose: an autolink's text is its URL, code blocks and inline code stay as written. */
const untranslatable = (n: LexNode) => n.type === 'autolink' || n.type === 'code' || (n.type === 'text' && ((n.format as number) & IS_CODE) !== 0)

function textNodes(node: LexNode | undefined, out: LexNode[] = []): LexNode[] {
  if (!node || typeof node !== 'object' || untranslatable(node)) return out
  if (node.type === 'text' && typeof node.text === 'string') out.push(node)
  for (const c of node.children ?? []) textNodes(c, out)
  return out
}
const lexRoot = (v: unknown) => (v as { root?: LexNode } | null)?.root
const richBlank = (v: unknown) => textNodes(lexRoot(v)).every((n) => blank(n.text))
const arrayBlank = (v: unknown) => !Array.isArray(v) || v.length === 0

export const sourceChars = (segs: Segment[]) => segs.reduce((n, s) => n + s.text.length, 0)

export const isMissing = (target: Doc, spec: TranslateSpec) => blank(get(target, spec.title))

/** Source texts whose field is empty in the target locale. Whitespace-only text nodes are kept as they are. */
export function collectSegments(source: Doc, target: Doc, spec: TranslateSpec): Segment[] {
  const segs: Segment[] = []
  for (const f of spec.text) {
    const v = get(source, f)
    if (!blank(v) && blank(get(target, f))) segs.push({ id: `f:${f}`, text: v as string })
  }
  for (const f of spec.rich) {
    if (!richBlank(get(target, f))) continue
    textNodes(lexRoot(get(source, f))).forEach((n, i) => {
      if (!blank(n.text)) segs.push({ id: `r:${f}:${i}`, text: n.text as string })
    })
  }
  for (const [f, keys] of Object.entries(spec.arrays ?? {})) {
    const rows = get(source, f)
    if (!Array.isArray(rows) || !arrayBlank(get(target, f))) continue
    rows.forEach((row: Record<string, unknown>, i) => {
      for (const k of keys) if (!blank(row[k])) segs.push({ id: `a:${f}:${i}:${k}`, text: row[k] as string })
    })
  }
  return segs
}

/**
 * Update data for the target locale from the translated segments (id → text). Only fields that had segments are set;
 * groups keep the target's other values; Lexical values are deep copies of the source with only `text` replaced.
 */
export function applySegments(source: Doc, target: Doc, spec: TranslateSpec, out: Record<string, string>): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  for (const f of spec.text) {
    const t = out[`f:${f}`]
    if (t === undefined) continue
    const [group, field] = f.split('.')
    if (field === undefined) data[group!] = t
    else data[group!] = { ...((data[group!] ?? get(target, group!) ?? {}) as object), [field]: t }
  }
  for (const f of spec.rich) {
    const src = get(source, f)
    const ids = Object.keys(out).filter((id) => id.startsWith(`r:${f}:`))
    if (!ids.length) continue
    const copy = structuredClone(src)
    textNodes(lexRoot(copy)).forEach((n, i) => {
      const t = out[`r:${f}:${i}`]
      if (t !== undefined) n.text = t
    })
    data[f] = copy
  }
  for (const [f, keys] of Object.entries(spec.arrays ?? {})) {
    const rows = get(source, f)
    if (!Array.isArray(rows) || !Object.keys(out).some((id) => id.startsWith(`a:${f}:`))) continue
    // No row ids: localized array rows are per locale, Payload gives the new locale its own.
    data[f] = rows.map((row: Record<string, unknown>, i) =>
      Object.fromEntries(keys.map((k) => [k, out[`a:${f}:${i}:${k}`] ?? row[k]])),
    )
  }
  return data
}
