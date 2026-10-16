// #30: generate TR/EN title/alt/caption/SEO filename/tags for the 568 launch images with Claude (via OpenRouter).
// Resumable: skips images that already have a JSON. Output: seed/media-meta/<category-slug>/<file>.json
// Run: bun scripts/seed/generate-media-meta.ts [--concurrency 6] [--limit N]
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

import { openRouterModel } from '@/ai/models'
import { knownTypes, TAG_IMAGE_PROMPT_VERSION, TagImageSchema, tagImageSystem, tagImageTypesLine } from '@/ai/prompts/tagImage'
import { runStructured } from '@/ai/run'
import { parseTaxonomyV0 } from '@/lib/content/schema'
import { SEED_CATEGORIES } from '@/seed/categories'

const DATA = process.env.KEFKEN_DATA ?? path.resolve(process.cwd(), '../../kefken-data/Webiste')
const OUT = path.resolve(process.cwd(), 'seed/media-meta')
const CHAIN = (process.env.AI_SEED_MODELS ?? 'anthropic/claude-sonnet-5.5,google/gemini-3.8-flash').split(',')
const arg = (k: string, d: number) => Number(process.argv[process.argv.indexOf(k) + 1] || d) || d
const concurrency = process.argv.includes('--concurrency') ? arg('--concurrency', 6) : 6
const limit = process.argv.includes('--limit') ? arg('--limit', Infinity) : Infinity
// #171: product types are offered from the committed taxonomy (the TR names scripts/seed/tags-type-axis.ts creates).
const taxonomy = parseTaxonomyV0(readFileSync(path.resolve(process.cwd(), 'seed/editorial/taxonomy-v0.json'), 'utf8'))
if (!taxonomy.ok) throw new Error(taxonomy.errors[0]?.description)
const TYPES = taxonomy.value.tags.filter((t) => t.axis === 'type').map((t) => t.name.tr)

type Job = { cat: (typeof SEED_CATEGORIES)[number]; file: string; out: string }
const jobs: Job[] = []
for (const cat of SEED_CATEGORIES) {
  const dir = path.join(DATA, cat.folder)
  mkdirSync(path.join(OUT, cat.slug.tr), { recursive: true })
  for (const file of readdirSync(dir).filter((f) => /\.(webp|jpe?g|png)$/i.test(f)).sort()) {
    const out = path.join(OUT, cat.slug.tr, `${file}.json`)
    if (!existsSync(out)) jobs.push({ cat, file, out })
  }
}
const todo = jobs.slice(0, limit)
console.log(`images to process: ${todo.length} (chain: ${CHAIN.join(' → ')})`)

let done = 0
let cost = 0
let failed = 0
async function work(job: Job) {
  const src = path.join(DATA, job.cat.folder, job.file)
  const image = await sharp(readFileSync(src)).rotate().resize({ width: 1024, height: 1024, fit: 'inside' }).jpeg({ quality: 82 }).toBuffer()
  const r = await runStructured({
    chain: CHAIN,
    getModel: openRouterModel,
    schema: TagImageSchema,
    system: tagImageSystem(new Date().toISOString().slice(0, 10)),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: `Kategori: ${job.cat.name.tr} (${job.cat.name.en})\n${tagImageTypesLine(TYPES)}` },
          { type: 'file', data: new Uint8Array(image), mediaType: 'image/jpeg' },
        ],
      },
    ],
  })
  done++
  if (!r.ok) {
    failed++
    console.error(`FAIL ${job.cat.slug.tr}/${job.file}: ${r.errors[0]?.description.slice(0, 200)}`)
    return
  }
  cost += r.value.costUsd ?? 0
  writeFileSync(
    job.out,
    JSON.stringify({ file: job.file, category: job.cat.slug.tr, model: r.value.model, promptVersion: TAG_IMAGE_PROMPT_VERSION, ...r.value.output, tags: { ...r.value.output.tags, type: knownTypes(r.value.output.tags.type, TYPES) } }, null, 2),
  )
  if (done % 20 === 0) console.log(`${done}/${todo.length} done, $${cost.toFixed(3)}, failed ${failed}`)
}

const queue = [...todo]
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    for (let j = queue.shift(); j; j = queue.shift()) await work(j)
  }),
)
console.log(`finished: ${done} processed, ${failed} failed, cost $${cost.toFixed(3)}`)
