// #150: pure parts of the editorial loaders (scripts/seed/editorial*.ts): gallery tag mapping, the homepage FAQ assembled
// from approved category FAQs, and the fill-only homepage layout.
import { Err } from 'tsentials/errors'
import { Result } from 'tsentials/result'

import { isEmpty } from '@/lib/content/merge'
import { DEFAULT_SECTIONS } from '@/lib/home/sections'

type Localized = Record<string, string>
export type TagDef = { key: string; axis: 'wood' | 'setting' | 'stage'; name: Localized; slug: Localized; raw: string[] }
export type Faq = { q: string; a: string }
export type FaqRef = { category: string; index: number }

export type TaxonomyTag = { axis: 'type' | 'wood' | 'setting' | 'finish' | 'stage'; status?: string; name: { tr: string; en: string }; slug: { tr: string; en: string } }
export type TagTranslations = Record<string, Record<'ru' | 'de' | 'ar', [name: string, slug: string]>>
export type TaxonomyTagDef = { axis: TaxonomyTag['axis']; name: Localized; slug: Localized }
// New setting values the owner approved with the type axis (#171); v0's optional `orman` is left out.
const NEW_SETTINGS = new Set(['ticari', 'giris'])

/**
 * #171: the taxonomy v0 tags to load: every product type, the approved new settings and the new finishes, each with
 * tr/en from v0 and ru/de/ar from the translation table (keyed by tr slug). A loaded tag missing there is a failure.
 */
export function taxonomyTagDefs(tags: TaxonomyTag[], translations: TagTranslations): Result<TaxonomyTagDef[]> {
  const load = tags.filter((t) => t.axis === 'type' || (t.axis === 'setting' && NEW_SETTINGS.has(t.slug.tr)) || (t.axis === 'finish' && t.status === 'new'))
  const missing = load.filter((t) => !translations[t.slug.tr]).map((t) => t.slug.tr)
  if (missing.length) return Result.failure(Err.validation('Content.MissingTranslation', `no ru/de/ar names for: ${missing.join(', ')}`))
  return Result.success(
    load.map((t) => {
      const { ru, de, ar } = translations[t.slug.tr]!
      return {
        axis: t.axis,
        name: { ...t.name, ru: ru[0], de: de[0], ar: ar[0] },
        slug: { ...t.slug, ru: ru[1], de: de[1], ar: ar[1] },
      }
    }),
  )
}

const norm = (s: string) => s.trim().toLocaleLowerCase('tr')

/** Canonical tag keys for one image's free-form `tags` (seed/media-meta), on each tag's own axis; unmapped values are dropped. */
export function tagKeysFor(defs: readonly TagDef[], tags: Partial<Record<string, readonly string[]>>): string[] {
  return defs.filter((d) => (tags[d.axis] ?? []).some((v) => d.raw.some((r) => norm(r) === norm(v)))).map((d) => d.key)
}

/**
 * The referenced category FAQ items, verbatim, per locale. Every locale's FAQ for a referenced category must have as many
 * items as TR's, or the index could point at a different question there.
 */
export function resolveFaq(refs: readonly FaqRef[], sources: Record<string, Record<string, readonly Faq[]>>): Result<Record<string, Faq[]>> {
  const tr = sources.tr ?? {}
  for (const ref of refs) {
    if (!tr[ref.category]?.[ref.index]) return Result.failure(Err.notFound('Editorial.UnknownFaq', `${ref.category}#${ref.index}: no such TR FAQ item`))
    for (const [locale, byCategory] of Object.entries(sources)) {
      if (byCategory[ref.category]?.length !== tr[ref.category]!.length)
        return Result.failure(Err.validation('Editorial.FaqMisaligned', `${locale}/${ref.category}: FAQ count differs from TR`))
    }
  }
  return Result.success(Object.fromEntries(Object.entries(sources).map(([locale, byCategory]) => [locale, refs.map((r) => ({ ...byCategory[r.category]![r.index]! }))])))
}

type Block = { blockType: string } & Record<string, unknown>

/**
 * Homepage layout with the editorial picks: on an empty layout every default section in order (hero + FAQ filled, the rest
 * left to their defaults); otherwise only the empty image of the first hero (its empty mobileImage only next to the picked
 * image) and the empty items of the first
 * FAQ block. Blocks the admin removed stay removed. `filled` lists what changed (empty: nothing to write).
 */
export function fillHomepageLayout(layout: readonly Block[], picks: { image?: number; mobileImage?: number; faq: Faq[] }): { layout: Block[]; filled: string[] } {
  if (!layout.length) {
    const blocks = DEFAULT_SECTIONS.map((blockType): Block => {
      if (blockType === 'hero') return { blockType, image: picks.image, mobileImage: picks.mobileImage }
      if (blockType === 'faq') return { blockType, items: picks.faq }
      return { blockType }
    })
    return { layout: blocks, filled: ['layout'] }
  }
  const filled: string[] = []
  const hero = layout.findIndex((b) => b.blockType === 'hero')
  const faq = layout.findIndex((b) => b.blockType === 'faq')
  const next = layout.map((b, i) => {
    const patch: Record<string, unknown> = {}
    if (i === faq && isEmpty(b.items) && picks.faq.length) patch.items = picks.faq
    if (i === hero) {
      if (isEmpty(b.image) && picks.image !== undefined) patch.image = picks.image
      // The phone photo is the picked hero's companion: only next to that hero, not next to one the admin chose.
      const heroId = patch.image ?? (typeof b.image === 'object' && b.image ? (b.image as { id?: unknown }).id : b.image)
      if (isEmpty(b.mobileImage) && picks.mobileImage !== undefined && heroId === picks.image) patch.mobileImage = picks.mobileImage
    }
    filled.push(...Object.keys(patch).map((k) => `${b.blockType}.${k}`))
    return Object.keys(patch).length ? { ...b, ...patch } : b
  })
  return { layout: filled.length ? next : [...layout], filled }
}

/** #156: a cover as the page sees it: the chosen photo, and the first gallery photo shown when none is chosen. */
export type CoverState = { cover: number | null; first?: number | null }

/**
 * Whether to replace a re-picked cover: only while the document still shows the previous pick (same cover id; for a
 * previous pick of "no cover", also the same first gallery photo). Any other value is the owner's choice and is kept.
 */
export function coverSwap(now: CoverState, from: CoverState, to: number): 'write' | 'done' | 'kept' {
  if (now.cover === to) return 'done'
  if (now.cover !== from.cover) return 'kept'
  return from.cover !== null || (now.first != null && now.first === from.first) ? 'write' : 'kept'
}

/** #156: `from` + `add` while a project's category ids are exactly the seeded `from`; 'done' once appended; else 'kept'. */
export function appendCategories(now: readonly number[], from: readonly number[], add: readonly number[]): number[] | 'done' | 'kept' {
  const same = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((x, i) => x === b[i])
  if (same(now, [...from, ...add])) return 'done'
  return same(now, from) ? [...from, ...add] : 'kept'
}
