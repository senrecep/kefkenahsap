// #190: re-points the committed legacy redirect maps (src/lib/legacy/*-map.json) at the database's current files.
// The maps are baked into the image as file names; a replaced file (taxonomy-remedy.ts → `<name>-1.webp`) or a deleted
// or hidden duplicate (taxonomy-dedup.ts) leaves them pointing at a file that is gone. Every entry keeps its seedKey, so
// this follows it to the approved photo now holding it (a duplicate → its kept twin; a rejected photo → dropped, 410).
// Reads the database only; writes the two JSON files. Exits 1, writing nothing, if a photo cannot be found.
// Run after any remedy/dedup/reject run, and before building the launch image (docs/LAUNCH.md):
//   bun run payload run scripts/seed/legacy-maps.ts
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'

import config from '@/payload.config'
import type { LegacyMaps } from '@/lib/legacy/resolve'
import { retargetLegacyMaps, type LiveMedia } from '@/lib/legacy/retarget'

import { loadPlan, mediaBySeedKey } from './taxonomy'

const dir = path.resolve(process.cwd(), 'src/lib/legacy')
const read = <T,>(f: string) => JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as T
const maps = { media: read<LegacyMaps['media']>('media-map.json'), attachments: read<LegacyMaps['attachments']>('attachment-map.json') }

const payload = await getPayload({ config: await config })
const live = new Map<string, LiveMedia>()
for (const [seedKey, d] of await mediaBySeedKey(payload, { filename: true, seoFilename: true, status: true }))
  if (d.status === 'approved' && d.filename && d.seoFilename) live.set(seedKey, { filename: d.filename, seoFilename: d.seoFilename })

const { maps: out, unresolved } = retargetLegacyMaps(maps, live, loadPlan())
if (unresolved.length) {
  console.error(`no approved photo for ${unresolved.length} seedKey(s): ${unresolved.join(' · ')}`)
  process.exit(1)
}
const changed = (a: Record<string, unknown>, b: Record<string, unknown>) =>
  new Set([...Object.keys(a), ...Object.keys(b)]).size - Object.keys(a).filter((k) => JSON.stringify(a[k]) === JSON.stringify(b[k])).length
const sortObj = <T,>(o: Record<string, T>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)))
writeFileSync(path.join(dir, 'media-map.json'), JSON.stringify(sortObj(out.media), null, 0) + '\n')
writeFileSync(path.join(dir, 'attachment-map.json'), JSON.stringify(sortObj(out.attachments), null, 0) + '\n')
console.log(`legacy maps: ${changed(maps.media, out.media)} media and ${changed(maps.attachments, out.attachments)} attachment entries changed`)
process.exit(0)
