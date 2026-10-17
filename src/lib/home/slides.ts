/** Photos the homepage hero cycles through at most (its image + its slides); seven fit the indicator row on a phone. */
export const MAX_SLIDES = 7

type WithId = { id: number }

const isMedia = (v: unknown): v is WithId => typeof v === 'object' && v !== null && typeof (v as { id?: unknown }).id === 'number'
const idOf = (v: unknown) => (isMedia(v) ? v.id : typeof v === 'number' ? v : undefined)

/**
 * The hero's photos in order: its image first (the LCP photo, og.jpg's source and mobileImage's partner), then its
 * `slides` (a hasMany upload). Read with overrideAccess: false, a photo the public may not see arrives as a bare id and
 * is skipped; each photo shows once.
 */
export function heroSlides<M extends WithId>(image: M | null | undefined, slides: readonly unknown[] | null | undefined): M[] {
  const all = [image, ...(slides ?? [])].filter((m): m is M => isMedia(m))
  return all.filter((m, i) => all.findIndex((x) => x.id === m.id) === i).slice(0, MAX_SLIDES)
}

type Block = { blockType: string } & Record<string, unknown>

/**
 * Seed: the first hero's slides from `picks` (media ids, its own image left out), only while it has none. Every block
 * keeps its id and fields, so the per-language texts Payload merges by block stay where they are.
 */
export function fillHeroSlides(layout: readonly Block[], picks: readonly number[]): { layout: Block[]; filled: boolean } {
  const i = layout.findIndex((b) => b.blockType === 'hero')
  const hero = layout[i]
  if (!hero || (Array.isArray(hero.slides) && hero.slides.length)) return { layout: [...layout], filled: false }
  const own = idOf(hero.image)
  const slides = picks.filter((id) => id !== own).slice(0, MAX_SLIDES - 1)
  if (!slides.length) return { layout: [...layout], filled: false }
  return { layout: layout.map((b, j) => (j === i ? { ...b, slides } : b)), filled: true }
}
