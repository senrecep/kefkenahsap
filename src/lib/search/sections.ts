type Slugged = { slug?: string | null }
type Titled = Slugged & { title?: string | null }

export type Sections<P, G, C, M> =
  | { key: 'projects'; items: P[] }
  | { key: 'guides'; items: G[] }
  | { key: 'categories'; items: C[] }
  | { key: 'media'; items: M[] }

/**
 * Search page groups in display order — projects (the proof), guides, services, then photos — without empty
 * groups or items that cannot link (no slug; a guide untitled in this locale). Tags are matched but not shown.
 */
export function resultSections<P extends Slugged, G extends Titled, C extends Slugged, M>(r: {
  projects: P[]
  guides: G[]
  categories: C[]
  media: M[]
  tags: unknown[]
}): { sections: Sections<P, G, C, M>[]; total: number } {
  const all: Sections<P, G, C, M>[] = [
    { key: 'projects', items: r.projects.filter((p) => p.slug) },
    { key: 'guides', items: r.guides.filter((g) => g.slug && g.title) },
    { key: 'categories', items: r.categories.filter((c) => c.slug) },
    { key: 'media', items: r.media },
  ]
  const sections = all.filter((s) => s.items.length > 0)
  return { sections, total: sections.reduce((n, s) => n + s.items.length, 0) }
}
