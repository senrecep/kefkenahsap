// #156: gives every project locale with a title a Latin slug. Before #156 the slug hook could not transliterate Arabic,
// so the seeded ar titles left the slug empty (or a bare year, the only Latin in the title): those projects were not
// "published" in ar (no home tile, no related work on the ar guides). ar takes the hand-written slug from
// seed/i18n/ar/content/project-stories.json (the project found by its cluster's TR title); any other gap takes the
// transliterated title. A slug is written only while it is empty, exactly the old hook's output, or a bare number on an
// Arabic title (the old output once #148 took the year out of the title; on dev: 2014 / 2016) — see slugFix. So an
// editor's slug is kept and a re-run writes nothing.
// Where the write goes (as project-story-fixes.ts): a never-published project gets a new draft version; a published one
// whose latest version is the published one gets a new published version changing only the slug; a published one with
// unpublished draft edits is skipped and listed, so a published write never buries the owner's draft.
// --dry-run writes nothing; a non-local database needs --yes; SITE_ENV=production is refused.
// Run: bun run payload run scripts/seed/project-slugs.ts [-- --dry-run | --yes]
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'
import { Maybe } from 'tsentials/maybe'

import config from '@/payload.config'
import { slugFix } from '@/lib/content/overlay'
import { parseProjectFixes, parseProjectStoriesOverlay } from '@/lib/content/schema'
import type { Config } from '@/payload-types'

import { guardTarget, loadOverlay, unwrap } from './i18n'

const dryRun = process.argv.includes('--dry-run')
const SEED = path.resolve(process.cwd(), 'seed')
const { clusters } = JSON.parse(readFileSync(path.join(SEED, 'clusters/clusters.json'), 'utf8')) as { clusters: { key: string; title: string }[] }
const fixes = unwrap(parseProjectFixes(readFileSync(path.join(SEED, 'i18n/project-story-fixes.json'), 'utf8')))
const arSlugs = loadOverlay(SEED, 'ar', 'content/project-stories.json', parseProjectStoriesOverlay) ?? {}
// TR title (current or pre-#148) → cluster key, to find a project's hand-written ar slug.
const clusterOf = new Map(clusters.flatMap((c) => [c.title, fixes[c.key]?.title?.tr?.old].filter((t): t is string => Boolean(t)).map((t) => [t, c.key] as const)))

guardTarget(dryRun)
const payload = await getPayload({ config: await config })
const locales = (payload.config.localization ? payload.config.localization.localeCodes : []) as Config['locale'][]
const tag = dryRun ? '[dry run] ' : ''
let writes = 0
const pending: string[] = []
const failed: string[] = []

// Without `draft` this reads the main document: the published version, or the draft of a never-published project.
const { docs } = await payload.find({ collection: 'projects', locale: 'tr', limit: 1000, depth: 0, pagination: false, select: { title: true, _status: true } })
for (const doc of docs) {
  const label = `project ${doc.id} "${doc.title}"`
  try {
    const published = doc._status === 'published'
    if (published && (await payload.findByID({ collection: 'projects', id: doc.id, draft: true, depth: 0 }))._status !== 'published') {
      pending.push(label)
      continue
    }
    const key = clusterOf.get(doc.title ?? '')
    for (const locale of locales) {
      const current = await payload.findByID({ collection: 'projects', id: doc.id, locale, fallbackLocale: false, draft: !published, depth: 0 })
      const fix = slugFix(current, locale, locale === 'ar' && key ? arSlugs[key]?.slug : undefined)
      if (!Maybe.isSome(fix)) continue
      console.log(`${tag}${label} [${locale}] ${published ? 'published' : 'draft'}: slug ${current.slug || '∅'} → ${fix.value}`)
      if (!dryRun)
        await payload.update({
          collection: 'projects',
          id: doc.id,
          locale,
          draft: !published,
          data: (published ? { slug: fix.value, _status: 'published' } : { slug: fix.value }) as never,
          context: { skipAi: true },
        })
      writes++
    }
  } catch (err) {
    // One bad project (e.g. a slug another project already uses) must not stop the rest; listed below, and the run exits 1.
    failed.push(label)
    console.error(`${label}: ${err instanceof Error ? err.message : err}`)
  }
}
console.log(`${tag}project slugs: ${writes} locale write(s), ${pending.length} skipped (unpublished draft edits), ${failed.length} failed, ${docs.length} project(s)`)
for (const [what, list] of [['draft edits, left as is', pending], ['failed', failed]] as const) if (list.length) console.log(`${what}: ${list.join(' · ')}`)
process.exit(failed.length ? 1 : 0)
