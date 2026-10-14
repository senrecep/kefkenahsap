export const DEFAULT_SECTIONS = ['hero', 'featuredGallery', 'services', 'featuredProjects', 'process', 'references', 'woodTypes', 'faq', 'contact'] as const

type Block = { blockType: string; enabled?: boolean | null }

/** Homepage blocks in the admin's saved order (only enabled ones); an unconfigured homepage gets the default order. */
export function homeSections<B extends Block>(layout: readonly B[] | null | undefined): (B | { blockType: (typeof DEFAULT_SECTIONS)[number] })[] {
  if (!layout?.length) return DEFAULT_SECTIONS.map((blockType) => ({ blockType }))
  return layout.filter((b) => b.enabled !== false)
}
