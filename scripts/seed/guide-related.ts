// #156: a guide's "İlgili hizmetler" (relatedCategories) also ranks its "Bu konudaki işlerimiz" (first category first),
// so ahsap-turleri drops Mobilya ve Cila (its office/furniture jobs led a wood-types guide) and lists deck before iroko,
// as seed/content/guides/ahsap-turleri.json now does. The relation is replaced only while it is still exactly the old
// seeded list, in that order (compared by TR category slug), so an owner's edit is kept and a re-run writes nothing.
// Where the write goes (as project-story-fixes.ts): a never-published guide gets a new draft version; a published one
// whose latest version is the published one gets a new published version changing only this relation; a published one
// with unpublished draft edits is skipped and listed.
// --dry-run writes nothing; a non-local database needs --yes; SITE_ENV=production is refused.
// Run: bun run payload run scripts/seed/guide-related.ts [-- --dry-run | --yes]
import { getPayload } from 'payload'

import config from '@/payload.config'

import { guardTarget } from './i18n'

const CHANGES = [{ guide: 'ahsap-turleri', old: ['ireko-teak', 'deck-ve-zeminler', 'mobilya-ve-cila'], new: ['deck-ve-zeminler', 'ireko-teak'] }]

const dryRun = process.argv.includes('--dry-run')
guardTarget(dryRun)
const payload = await getPayload({ config: await config })
const tag = dryRun ? '[dry run] ' : ''
let writes = 0
let failed = 0

for (const c of CHANGES) {
  try {
    const doc = (await payload.find({ collection: 'guides', locale: 'tr', where: { slug: { equals: c.guide } }, limit: 1, depth: 0 })).docs[0]
    if (!doc) {
      console.log(`guide ${c.guide}: not found, left as is`)
      continue
    }
    const published = doc._status === 'published'
    const latest = await payload.findByID({ collection: 'guides', id: doc.id, draft: true, depth: 0 })
    if (published && latest._status !== 'published') {
      console.log(`guide ${c.guide}: unpublished draft edits, left as is`)
      continue
    }
    const ids = (latest.relatedCategories ?? []).map((x) => (typeof x === 'object' ? x.id : x))
    const cats = await payload.find({ collection: 'categories', locale: 'tr', draft: true, where: { slug: { in: [...c.old, ...c.new] } }, limit: 50, depth: 0, select: { slug: true } })
    const slugOf = new Map(cats.docs.map((x) => [x.id, x.slug]))
    const idOf = new Map(cats.docs.map((x) => [x.slug, x.id]))
    const current = ids.map((id) => slugOf.get(id) ?? `#${id}`)
    if (current.join() !== c.old.join()) {
      console.log(`guide ${c.guide}: relatedCategories ${current.join(', ') || '∅'} (not the old seeded list), left as is`)
      continue
    }
    const next = c.new.map((s) => idOf.get(s))
    if (next.some((id) => id === undefined)) throw new Error(`category missing: ${c.new.filter((s) => !idOf.has(s)).join(', ')}`)
    console.log(`${tag}guide ${c.guide} ${published ? 'published' : 'draft'}: relatedCategories ${current.join(', ')} → ${c.new.join(', ')}`)
    if (!dryRun)
      await payload.update({
        collection: 'guides',
        id: doc.id,
        draft: !published,
        data: (published ? { relatedCategories: next, _status: 'published' } : { relatedCategories: next }) as never,
        context: { skipAi: true },
      })
    writes++
  } catch (err) {
    failed++
    console.error(`guide ${c.guide}: ${err instanceof Error ? err.message : err}`)
  }
}
console.log(`${tag}guide relations: ${writes} write(s), ${failed} failed`)
process.exit(failed ? 1 : 0)
