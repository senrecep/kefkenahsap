import { CATEGORY_RENAMES } from '@/seed/categories'

/**
 * #172: where a missing category slug should go. A renamed category answers under whichever of its old/new slugs the
 * database holds right now: before categories-rename.ts runs the old one is live (the new one redirects to it), after it
 * the new one is (the old one redirects). Called only on a miss, so a normal page view costs no extra lookup.
 * `exists` must be uncached (categorySlugExists): only one of the two slugs exists at a time, so a fresh check can never
 * send the two slugs to each other in a loop, even while the page's own lookup is still a stale cached miss.
 */
export async function renameRedirect(
  locale: string,
  slug: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<{ slug: string; permanent: boolean } | null> {
  for (const { from, to } of CATEGORY_RENAMES) {
    const [oldSlug, newSlug] = [from, to].map((s) => s[locale as keyof typeof s])
    // old → new is the final state (permanent); new → old only bridges the time before the rename runs (temporary).
    const hit = oldSlug === slug ? { slug: newSlug!, permanent: true } : newSlug === slug ? { slug: oldSlug!, permanent: false } : undefined
    if (hit && (await exists(hit.slug))) return hit
  }
  return null
}
