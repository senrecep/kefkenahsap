import { CATEGORY_RENAMES } from '@/seed/categories'

/**
 * #172: where a missing category slug should go. A renamed category answers under whichever of its old/new slugs the
 * database holds right now: before categories-rename.ts runs the old one is live (the new one redirects to it), after it
 * the new one is (the old one redirects). Called only on a miss, so a normal page view costs no extra lookup.
 */
export async function renameRedirect(locale: string, slug: string, exists: (slug: string) => Promise<boolean>): Promise<string | null> {
  for (const { from, to } of CATEGORY_RENAMES) {
    const pair = [from, to].map((s) => s[locale as keyof typeof s])
    const other = pair[0] === slug ? pair[1] : pair[1] === slug ? pair[0] : undefined
    if (other && (await exists(other))) return other
  }
  return null
}
