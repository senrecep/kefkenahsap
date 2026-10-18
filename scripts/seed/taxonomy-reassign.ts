// #175: moves the live photos to the category the owner-approved taxonomy files them under (photo-plan.json `moves`,
// matched by seedKey). A photo moves only while it is still in the planned `from` category; one found anywhere else
// (moved by the owner, or a plan that does not fit this database) is listed and left alone. Projects are never touched:
// a moved photo that sits in a project's gallery or cover is listed. The plan's rejected live photos are only listed,
// never unpublished. A re-run writes nothing.
// --dry-run writes nothing; a non-local database needs --yes; SITE_ENV=production is refused.
// Run: bun run payload run scripts/seed/taxonomy-reassign.ts [-- --dry-run | --yes]
import { getPayload } from 'payload'

import config from '@/payload.config'
import { moveAction } from '@/lib/media/taxonomy'

import { seedCtx } from './archive-media'
import { guardTarget } from './i18n'
import { categoryIds, dry, dryRun, finish, loadPlan, mediaBySeedKey } from './taxonomy'

const plan = loadPlan()
guardTarget(dryRun)
const payload = await getPayload({ config: await config })
const cats = await categoryIds(payload)
const media = await mediaBySeedKey(payload, { category: true, status: true })
const idOf = (c: unknown) => (typeof c === 'object' && c ? (c as { id: number }).id : (c as number | null | undefined) ?? undefined)

// Every project (latest version) that shows a photo, by media id.
const inProjects = new Map<number, string[]>()
for (const p of (await payload.find({ collection: 'projects', draft: true, pagination: false, limit: 0, depth: 0, locale: 'tr', select: { title: true, cover: true, gallery: true } })).docs)
  for (const m of [p.cover, ...(p.gallery ?? [])].map(idOf).filter((x): x is number => x !== undefined))
    inProjects.set(m, [...new Set([...(inProjects.get(m) ?? []), `#${p.id} ${p.title ?? ''}`.trim()])])

const counts = { moved: 0, done: 0 }
const mismatch: string[] = []
const missing: string[] = []
const projects: string[] = []
const failed: string[] = []
for (const move of plan.moves) {
  const doc = media.get(move.seedKey)
  if (!doc) {
    missing.push(move.seedKey)
    continue
  }
  const action = moveAction(idOf(doc.category), cats.get(move.from)!, cats.get(move.to)!)
  if (inProjects.has(doc.id)) projects.push(`${move.seedKey} (media ${doc.id}, ${move.from} → ${move.to}) in ${inProjects.get(doc.id)!.join(', ')}`)
  if (action === 'done') {
    counts.done++
    continue
  }
  if (action === 'mismatch') {
    mismatch.push(`${move.seedKey} (category ${idOf(doc.category) ?? 'none'}, plan ${move.from} → ${move.to})`)
    continue
  }
  try {
    console.log(`${dry}${move.seedKey}: ${move.from} → ${move.to}`)
    if (!dryRun) await payload.update({ collection: 'media', id: doc.id, data: { category: cats.get(move.to)! }, context: seedCtx() })
    counts.moved++
  } catch (err) {
    failed.push(move.seedKey)
    console.error(`${move.seedKey}: ${err instanceof Error ? err.message : err}`)
  }
}
const rejects = plan.rejects.map((k) => `${k} (${media.get(k)?.status ?? 'not in this database'})`)
finish(
  `taxonomy reassign: ${counts.moved} moved, ${counts.done} already there, ${mismatch.length} not in the planned category, ${missing.length} not in this database (of ${plan.moves.length})`,
  [
    ['not in the planned category, left as is', mismatch],
    ['not in this database', missing],
    ['in a project gallery or cover (projects left as is)', projects],
    ['rejected by the review, left published (owner decides)', rejects],
  ],
  failed,
)
