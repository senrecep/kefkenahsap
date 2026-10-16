// #175: the live site had the same photo in several categories; after the moves some copies share one category
// (photo-plan.json `duplicates`). One copy goes back to `pending` (hidden from the site, never deleted, reversible in the
// Galeri): the planned one, or, when a page uses it (a project gallery or cover, a category/guide cover, the homepage,
// an OG image…), the kept copy instead; when both are in use neither is touched and the pair is listed.
// Only an approved copy is set pending, so a re-run writes nothing. Run after taxonomy-covers.ts and editorial-swaps.ts,
// so the covers it checks are the final ones.
// --dry-run writes nothing; a non-local database needs --yes; SITE_ENV=production is refused.
// Run: bun run payload run scripts/seed/taxonomy-dedup.ts [-- --dry-run | --yes]
import { getPayload } from 'payload'

import config from '@/payload.config'
import { duplicateToHide, mediaRefs } from '@/lib/media/taxonomy'

import { seedCtx } from './archive-media'
import { guardTarget } from './i18n'
import { dry, dryRun, finish, loadPlan, mediaBySeedKey } from './taxonomy'

const plan = loadPlan()
guardTarget(dryRun)
const payload = await getPayload({ config: await config })
const media = await mediaBySeedKey(payload, { status: true })

// Every media id a page shows, from the latest and the published version of each document and global.
const used = new Set<number>()
for (const draft of [true, false]) {
  for (const collection of ['categories', 'projects', 'guides', 'references', 'pages'] as const)
    mediaRefs((await payload.find({ collection, draft, locale: 'all', pagination: false, limit: 0, depth: 0 })).docs, used)
  for (const slug of ['homepage', 'siteSettings'] as const) mediaRefs(await payload.findGlobal({ slug, draft, locale: 'all', depth: 0 }), used)
}

let hidden = 0
let unchanged = 0
const swapped: string[] = []
const bothUsed: string[] = []
const missing: string[] = []
const failed: string[] = []
for (const { hide, keep } of plan.duplicates) {
  const [h, k] = [media.get(hide), media.get(keep)]
  if (!h || !k) {
    missing.push(`${hide} / ${keep}`)
    continue
  }
  const id = duplicateToHide({ id: h.id, used: used.has(h.id) }, { id: k.id, used: used.has(k.id) })
  if (id === undefined) {
    bothUsed.push(`${hide} (media ${h.id}) and ${keep} (media ${k.id})`)
    continue
  }
  const [key, doc] = id === h.id ? [hide, h] : [keep, k]
  if (id === k.id) swapped.push(`${key} (media ${id}) hidden instead of ${hide} (media ${h.id}, in use)`)
  if (doc.status !== 'approved') {
    unchanged++
    continue
  }
  try {
    console.log(`${dry}${key} (media ${id}): approved → pending`)
    if (!dryRun) await payload.update({ collection: 'media', id, data: { status: 'pending' }, context: seedCtx() })
    hidden++
  } catch (err) {
    failed.push(key)
    console.error(`${key}: ${err instanceof Error ? err.message : err}`)
  }
}
finish(
  `taxonomy dedup: ${hidden} set pending, ${unchanged} already not approved, ${bothUsed.length} both in use, ${missing.length} not in this database (of ${plan.duplicates.length})`,
  [
    ['kept copy hidden instead (the planned one is in use)', swapped],
    ['both copies in use, left as is', bothUsed],
    ['not in this database', missing],
  ],
  failed,
)
