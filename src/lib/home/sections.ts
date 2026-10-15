export const DEFAULT_SECTIONS = ['hero', 'featuredGallery', 'services', 'featuredProjects', 'process', 'references', 'woodTypes', 'faq', 'contact'] as const

type Block = { blockType: string; enabled?: boolean | null }

/** Homepage blocks in the admin's saved order (only enabled ones); an unconfigured homepage gets the default order. */
export function homeSections<B extends Block>(layout: readonly B[] | null | undefined): (B | { blockType: (typeof DEFAULT_SECTIONS)[number] })[] {
  if (!layout?.length) return DEFAULT_SECTIONS.map((blockType) => ({ blockType }))
  return layout.filter((b) => b.enabled !== false)
}

/** Published homepage, read as the public: a hero image that is not approved comes back as a bare id (→ fallback photo). */
export const homepageQuery = { slug: 'homepage', depth: 1, draft: false, overrideAccess: false } as const

/** Index of the first hero among the rendered sections (-1: none). Only that hero's title is the page h1. */
export const firstHero = (sections: readonly { blockType: string }[]) => sections.findIndex((s) => s.blockType === 'hero')
