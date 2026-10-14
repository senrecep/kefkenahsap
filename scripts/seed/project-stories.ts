// #61: fills the story (TR + EN) and the EN title of the draft projects from #33 (scripts/seed/project-drafts.ts).
// Source: seed/content/project-stories.json, keyed by photo-cluster key; the project is found by the cluster's TR title,
// the same way project-drafts.ts does. Only never-published projects are touched, only empty fields are written
// (fillEmpty), and every write is a draft — nothing is published. A re-run makes no writes.
// Run: bun run payload run scripts/seed/project-stories.ts   (needs the drafts from scripts/seed/project-drafts.ts)
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { convertMarkdownToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { fillEmpty } from '@/lib/content/merge'
import { parseProjectStories } from '@/lib/content/schema'

const read = (p: string) => readFileSync(path.resolve(process.cwd(), p), 'utf8')
const { clusters } = JSON.parse(read('seed/clusters/clusters.json')) as { clusters: { key: string; title: string }[] }
const parsed = parseProjectStories(read('seed/content/project-stories.json'))
if (!parsed.ok) throw new Error(`project-stories.json: ${parsed.errors.map((e) => e.description).join('; ')}`)
const stories = parsed.value

const payload = await getPayload({ config: await config })
const editorConfig = await editorConfigFactory.default({ config: payload.config })
const lexical = (markdown: string) => convertMarkdownToLexical({ editorConfig, markdown })
let writes = 0
let skipped = 0

for (const c of clusters) {
  const s = stories[c.key]
  if (!s) throw new Error(`no story for cluster ${c.key}`)
  // Without `draft: true` this reads the main document, whose _status is 'draft' only if it was never published.
  const found = await payload.find({ collection: 'projects', locale: 'tr', where: { title: { equals: c.title } }, limit: 1, depth: 0 })
  const doc = found.docs[0]
  if (!doc || doc._status !== 'draft') {
    skipped++
    console.log(`project "${c.title}": ${doc ? 'published, left as is' : 'not found (renamed or not seeded)'}`)
    continue
  }
  const incoming = { tr: { story: lexical(s.tr.story) }, en: { title: s.en.title, story: lexical(s.en.story) } }
  for (const locale of ['tr', 'en'] as const) {
    const current = await payload.findByID({ collection: 'projects', id: doc.id, locale, fallbackLocale: false, draft: true, depth: 0 })
    const patch = fillEmpty(current, incoming[locale])
    if (!Object.keys(patch).length) continue
    await payload.update({ collection: 'projects', id: doc.id, locale, draft: true, data: patch })
    writes++
    console.log(`project "${c.title}" [${locale}]: ${Object.keys(patch).join(', ')}`)
  }
}
console.log(`project stories: ${writes} write(s), ${skipped} project(s) skipped (${clusters.length} clusters)`)
process.exit(0)
