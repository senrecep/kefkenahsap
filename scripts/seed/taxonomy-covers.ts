// #175: covers for the five categories added from the photo taxonomy and for Sundurma ve Ahşap Çatı, only where the
// cover is unset (an unset cover is the only state that is not an owner's choice, see editorial.ts). The pick
// (src/lib/media/taxonomy.ts pickCover): an approved photo of the category that the review rated good, landscape and
// at least 1280 px wide; live photos before imported ones, then the widest. Rejected and stacked-watermark photos are
// never picked, nor a duplicate copy taxonomy-dedup.ts hides. Publishing as editorial.ts: a category whose latest version is published is written published, one with
// a pending draft gets a new draft (the cover goes live with that draft).
// Also lists the editorial picks (seed/editorial/picks.json) whose photo the taxonomy moved or rejected; nothing changes.
// A re-run writes nothing. --dry-run writes nothing; a non-local database needs --yes; SITE_ENV=production is refused.
// Run: bun run payload run scripts/seed/taxonomy-covers.ts [-- --dry-run | --yes]
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { parseEditorialPicks } from '@/lib/content/schema'
import { pickCover } from '@/lib/media/taxonomy'

import { seedCtx } from './archive-media'
import { guardTarget, unwrap } from './i18n'
import { categoryIds, dryRun, finish, loadPlan, SEED } from './taxonomy'

const KEYS = ['bahce-kulubeleri', 'ahsap-ev-ve-bungalov', 'bahce-mobilyasi', 'mutfak-ve-gomme-dolap', 'lambri-ve-kaplama', 'ahsap-yapilar']
const plan = loadPlan()
const picks = unwrap(parseEditorialPicks(readFileSync(path.join(SEED, 'editorial/picks.json'), 'utf8')))
guardTarget(dryRun)
const payload = await getPayload({ config: await config })
const cats = await categoryIds(payload)
const excluded = new Set([...plan.rejects, ...plan.remedies.map((r) => r.seedKey), ...plan.duplicates.map((d) => d.hide)])

const set: string[] = []
const kept: string[] = []
const none: string[] = []
const failed: string[] = []
for (const key of KEYS) {
  const id = cats.get(key)!
  try {
    const latest = await payload.findByID({ collection: 'categories', id, draft: true, depth: 0 })
    if (latest.cover) {
      kept.push(`${key} (media ${typeof latest.cover === 'number' ? latest.cover : latest.cover.id})`)
      continue
    }
    const photos = (await payload.find({ collection: 'media', where: { category: { equals: id }, status: { equals: 'approved' } }, pagination: false, limit: 0, depth: 0, select: { seedKey: true, width: true, height: true } })).docs
    const cover = pickCover(
      photos
        .filter((p) => p.seedKey && !excluded.has(p.seedKey))
        .map((p) => ({ id: p.id, width: p.width ?? 0, height: p.height ?? 0, live: !p.seedKey!.startsWith('archive/'), quality: plan.facts[p.seedKey!]?.quality })),
    )
    if (!cover) {
      none.push(key)
      continue
    }
    const published = latest._status === 'published'
    set.push(`${key}: media ${cover} (${published ? 'published' : 'in the pending draft'})`)
    if (!dryRun)
      await payload.update({ collection: 'categories', id, draft: !published, data: published ? { cover, _status: 'published' } : { cover }, context: seedCtx() })
  } catch (err) {
    failed.push(key)
    console.error(`${key}: ${err instanceof Error ? err.message : err}`)
  }
}

// Report only: editorial picks whose photo changed category or was rejected by the review.
const moved = new Map(plan.moves.map((m) => [m.seedKey, `${m.from} → ${m.to}`]))
const rejected = new Set(plan.rejects)
const picked: [string, string][] = [
  ['hero', picks.hero.seedKey],
  ['mobileHero', picks.mobileHero.seedKey],
  ...picks.featuredProjects.map((f) => [`featured project ${f.cluster} cover`, f.cover] as [string, string]),
  ...Object.entries(picks.categoryCovers).map(([slug, c]) => [`category cover ${slug}`, c.seedKey] as [string, string]),
]
const affected = picked.filter(([, k]) => moved.has(k) || rejected.has(k)).map(([what, k]) => `${what}: ${k} (${moved.get(k) ?? 'rejected by the review'})`)
finish(
  `taxonomy covers: ${set.length} set, ${kept.length} already had one, ${none.length} without a candidate (of ${KEYS.length})`,
  [
    ['set', set],
    ['owner-set or earlier cover, kept', kept],
    ['no good landscape photo ≥ 1280 px', none],
    ['editorial picks on a moved or rejected photo (left as is)', affected],
  ],
  failed,
)
