// #190: the redirect maps are baked into the image as file names, which go stale when a photo's file is replaced
// (Payload stores the new upload as `<name>-1.webp`) or a duplicate is deleted. Each entry carries the photo's seedKey,
// which never changes, so the maps can be re-pointed at the current files (scripts/seed/legacy-maps.ts).
import type { LegacyMaps } from './resolve'

export type LiveMedia = { filename: string; seoFilename: string }
type Maps = Pick<LegacyMaps, 'media' | 'attachments'>

/**
 * Re-points every entry at the photo's current CDN file (media) and gallery slug (attachments). A deleted duplicate
 * follows its kept twin; a rejected photo is dropped (410). `unresolved` lists the seedKeys found nowhere; their entries
 * stay unchanged.
 */
export function retargetLegacyMaps(maps: Maps, live: ReadonlyMap<string, LiveMedia>, plan: { duplicates: { hide: string; keep: string }[]; rejects: string[] }) {
  const keep = new Map(plan.duplicates.map((d) => [d.hide, d.keep]))
  const rejected = new Set(plan.rejects)
  const unresolved = new Set<string>()
  const current = (seedKey: string): [string, LiveMedia] | 'drop' | undefined => {
    let key = seedKey
    for (let hops = 0; !live.has(key) && keep.has(key) && hops < 10; hops++) key = keep.get(key)!
    const doc = live.get(key)
    if (doc) return [key, doc]
    if (rejected.has(seedKey)) return 'drop'
    unresolved.add(seedKey)
  }
  const media: Maps['media'] = {}
  for (const [k, t] of Object.entries(maps.media)) {
    const hit = current(t.seedKey)
    if (hit !== 'drop') media[k] = hit ? { file: hit[1].filename, seedKey: hit[0] } : t
  }
  const attachments: Maps['attachments'] = {}
  for (const [k, t] of Object.entries(maps.attachments)) {
    const hit = current(t.seedKey)
    if (hit !== 'drop') attachments[k] = hit ? { slug: hit[1].seoFilename, seedKey: hit[0] } : t
  }
  return { maps: { media, attachments }, unresolved: [...unresolved] }
}
