// #61: fills the story (TR + EN) and the EN title of the draft projects from #33 (scripts/seed/project-drafts.ts).
// Source: seed/content/project-stories.json, keyed by photo-cluster key; the project is found by the cluster's TR title,
// the same way project-drafts.ts does. Only projects whose main document is unpublished (_status 'draft') are touched,
// only empty fields are written (fillEmpty), and every write is a new draft version — nothing is published.
// A re-run makes no writes. --force overwrites story and EN title on those drafts with the committed text.
// #138: also the title and story of the other locales from seed/i18n/<locale>/content/project-stories.json, when present.
// Run: bun run payload run scripts/seed/project-stories.ts [-- --force]
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { convertMarkdownToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { parseProjectStories, parseProjectStoriesOverlay } from '@/lib/content/schema'

import { fillLocales, loadOverlay, payloadOverlayLocales } from './i18n'

const force = process.argv.includes('--force')
const read = (p: string) => readFileSync(path.resolve(process.cwd(), p), 'utf8')
const { clusters } = JSON.parse(read('seed/clusters/clusters.json')) as { clusters: { key: string; title: string }[] }
const parsed = parseProjectStories(read('seed/content/project-stories.json'))
if (!parsed.ok) throw new Error(`project-stories.json: ${parsed.errors.map((e) => e.description).join('; ')}`)
const stories = parsed.value

const payload = await getPayload({ config: await config })
const editorConfig = await editorConfigFactory.default({ config: payload.config })
const lexical = (markdown: string) => convertMarkdownToLexical({ editorConfig, markdown })
const overlays = payloadOverlayLocales(payload).flatMap((l) => {
  const o = loadOverlay(path.resolve(process.cwd(), 'seed'), l, 'content/project-stories.json', parseProjectStoriesOverlay)
  return o ? [[l, o] as const] : []
})
let writes = 0
let skipped = 0

for (const c of clusters) {
  const s = stories[c.key]
  if (!s) throw new Error(`no story for cluster ${c.key}`)
  // Without `draft: true` this reads the main document; its _status is 'draft' while the project is unpublished.
  const found = await payload.find({ collection: 'projects', locale: 'tr', where: { title: { equals: c.title } }, limit: 1, depth: 0 })
  const doc = found.docs[0]
  if (!doc || doc._status !== 'draft') {
    skipped++
    console.log(`project "${c.title}": ${doc ? 'published, left as is' : 'not found (renamed or not seeded)'}`)
    continue
  }
  const incoming = {
    tr: { story: lexical(s.tr.story) },
    en: { title: s.en.title, story: lexical(s.en.story) },
    ...Object.fromEntries(overlays.flatMap(([l, o]) => (o[c.key] ? [[l, { title: o[c.key]!.title, story: lexical(o[c.key]!.story) }]] : []))),
  }
  writes += await fillLocales(payload, 'projects', doc.id, incoming, { label: `project "${c.title}"`, draft: true, force })
}
console.log(`project stories: ${writes} write(s), ${skipped} project(s) skipped (${clusters.length} clusters)`)
process.exit(0)
