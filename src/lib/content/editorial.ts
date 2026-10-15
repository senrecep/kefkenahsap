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
 * left to their defaults); otherwise only the empty image/mobileImage of the first hero and the empty items of the first
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
    if (i === hero) for (const k of ['image', 'mobileImage'] as const) if (isEmpty(b[k]) && picks[k] !== undefined) patch[k] = picks[k]
    filled.push(...Object.keys(patch).map((k) => `${b.blockType}.${k}`))
    return Object.keys(patch).length ? { ...b, ...patch } : b
  })
  return { layout: filled.length ? next : [...layout], filled }
}
