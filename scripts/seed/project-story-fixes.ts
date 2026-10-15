// #148: applies the rewritten project stories (all locales) and moves the year out of two titles into `year`, from
// seed/i18n/project-story-fixes.json (`{ "<cluster key>": { year?, title?: { <locale>: { old, new } }, story?: … } }`).
// A title or story is replaced only while it is still exactly the old seeded text (the story compared as plain text);
// the year is written only while it is empty. An owner's edit is kept, and a re-run writes nothing.
// Where the write goes:
// - never published (_status draft): a new draft version, like project-stories.ts;
// - published, latest version is the published one: a new published version that changes only the fields above;
// - published with unpublished draft edits: skipped and listed, so a published write never buries the owner's draft.
// The project is found by its TR title, old or new; one the owner renamed is listed as not found and left alone.
// --dry-run writes nothing; a non-local database needs --yes; SITE_ENV=production is refused.
// Run: bun run payload run scripts/seed/project-story-fixes.ts [-- --dry-run | --yes]
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { convertMarkdownToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import { getPayload } from 'payload'
import { Maybe } from 'tsentials/maybe'

import config from '@/payload.config'
import { projectFixPatch, projectYearFix } from '@/lib/content/overlay'
import { parseProjectFixes } from '@/lib/content/schema'
import { bodyText } from '@/lib/regions/gate'
import type { Config } from '@/payload-types'

import { guardTarget, unwrap } from './i18n'

const dryRun = process.argv.includes('--dry-run')
const SEED = path.resolve(process.cwd(), 'seed')
const fixes = unwrap(parseProjectFixes(readFileSync(path.join(SEED, 'i18n/project-story-fixes.json'), 'utf8')))
const { clusters } = JSON.parse(readFileSync(path.join(SEED, 'clusters/clusters.json'), 'utf8')) as { clusters: { key: string; title: string }[] }

guardTarget(dryRun)
const payload = await getPayload({ config: await config })
const editorConfig = await editorConfigFactory.default({ config: payload.config })
const locales = (payload.config.localization ? payload.config.localization.localeCodes : []) as Config['locale'][]
const tag = dryRun ? '[dry run] ' : ''
let writes = 0
const pending: string[] = []
const missing: string[] = []
const failed: string[] = []

for (const c of clusters) {
  const fix = fixes[c.key]
  if (!fix) continue
  try {
    const titles = [...new Set([c.title, fix.title?.tr?.old].filter((t): t is string => Boolean(t)))]
    // Without `draft` this reads the main document: the published version, or the draft of a never-published project.
    const doc = (await payload.find({ collection: 'projects', locale: 'tr', where: { title: { in: titles } }, limit: 1, depth: 0 })).docs[0]
    if (!doc) {
      missing.push(c.title)
      continue
    }
    const published = doc._status === 'published'
    if (published && (await payload.findByID({ collection: 'projects', id: doc.id, draft: true, depth: 0 }))._status !== 'published') {
      pending.push(c.title)
      continue
    }
    let year = projectYearFix(doc.year, fix)
    for (const locale of locales) {
      const current = await payload.findByID({ collection: 'projects', id: doc.id, locale, fallbackLocale: false, draft: !published, depth: 0 })
      const patch = projectFixPatch({ title: current.title, story: bodyText(current.story as Parameters<typeof bodyText>[0]) }, fix, locale)
      const data: Record<string, unknown> = { ...patch }
      if (patch.story) data.story = convertMarkdownToLexical({ editorConfig, markdown: patch.story })
      if (Maybe.isSome(year)) {
        data.year = year.value
        year = Maybe.none()
      }
      if (!Object.keys(data).length) continue
      console.log(`${tag}project "${c.title}" [${locale}] ${published ? 'published' : 'draft'}: ${Object.keys(data).join(', ')}`)
      if (!dryRun)
        await payload.update({
          collection: 'projects',
          id: doc.id,
          locale,
          draft: !published,
          data: (published ? { ...data, _status: 'published' } : data) as never,
          context: { skipAi: true },
        })
      writes++
    }
  } catch (err) {
    // One bad project must not stop the rest; listed below, and the run exits 1.
    failed.push(c.title)
    console.error(`project "${c.title}": ${err instanceof Error ? err.message : err}`)
  }
}
console.log(`${tag}project stories: ${writes} locale write(s), ${pending.length} skipped (unpublished draft edits), ${missing.length} not found (renamed?), ${failed.length} failed`)
for (const [label, list] of [['draft edits, left as is', pending], ['not found', missing], ['failed', failed]] as const) if (list.length) console.log(`${label}: ${list.join(' · ')}`)
process.exit(failed.length ? 1 : 0)
