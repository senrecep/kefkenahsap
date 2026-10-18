// #209: renames the stored files (original + every size) of approved or hidden media whose file is not yet named after its
// SEO name (admin uploads from before the rename-at-approval rule) to `<seoName>.<ext>` / `<seoName>-<W>x<H>.<ext>`.
// Same code path as the first approval (Media.ts renameToSeoName, forced): objects are copied, the document is pointed at
// the copies without re-stamping, the old objects are deleted and their CDN URLs purged. Idempotent: a renamed file is skipped.
// Seeded photos (seedKey) keep their names; pending media is renamed when it is approved. A photo that fails is listed and the run exits 1.
// --dry-run writes nothing; a non-local database needs --yes. Note: the public URL of an approved photo changes.
// Run: bun run payload run scripts/seed/seo-filenames.ts [-- --dry-run | --yes]
import { getPayload } from 'payload'

import { isSeoNamed, pickSeoName, stemOf } from '@/lib/media/seoName'
import config from '@/payload.config'

import { guardTarget } from './i18n'

const dryRun = process.argv.includes('--dry-run')
guardTarget(dryRun)
const payload = await getPayload({ config: await config })

const all = await payload.find({ collection: 'media', locale: 'tr', limit: 0, pagination: false, depth: 0, select: { filename: true, seoFilename: true, title: true, status: true, seedKey: true } })
const todo = all.docs.filter((d) => d.status !== 'pending' && !d.seedKey && d.filename && !isSeoNamed(d.filename, d.seoFilename))
const taken = new Set(all.docs.map((d) => stemOf(d.filename ?? '')))
let renamed = 0
const failed: string[] = []

for (const doc of todo) {
  try {
    if (dryRun) {
      // Same pick as the hook: the doc's own stem does not count as taken.
      const own = stemOf(doc.filename!)
      taken.delete(own)
      const name = pickSeoName({ seoFilename: doc.seoFilename, titleTr: doc.title, id: doc.id, taken })
      taken.add(name)
      console.log(`#${doc.id} [${doc.status}] ${doc.filename} -> ${name}${doc.filename!.slice(own.length)}`)
    } else {
      const done = await payload.update({ collection: 'media', id: doc.id, locale: 'tr', data: {}, context: { skipAi: true, seoRename: 'force' } })
      console.log(`#${doc.id} [${doc.status}] ${doc.filename} -> ${done.filename}`)
    }
    renamed++
  } catch (err) {
    failed.push(String(doc.id))
    console.error(`media #${doc.id}: ${err instanceof Error ? err.message : err}`)
  }
}
// The CDN purge is fire-and-forget inside the hook: give it time before the process exits.
if (!dryRun && renamed) await new Promise((r) => setTimeout(r, 5000))
console.log(`${dryRun ? '[dry run] ' : ''}media files: ${renamed} renamed, ${all.docs.length - todo.length} left as is (pending, seeded or already SEO-named), ${failed.length} failed`)
if (failed.length) console.error(`failed: ${failed.join(', ')}`)
process.exit(failed.length ? 1 : 0)
