// #209: queues a seoRename job (src/jobs/seoRename.ts) for every approved or hidden photo whose stored file is not yet named
// after its SEO name (admin uploads from before the rename-on-approval rule). The jobs do the work, so this is the same code
// path as an approval: objects are copied, the document is pointed at the copies without re-stamping, the old objects are
// deleted and their CDN URLs purged. The server's job runner (every minute) picks them up; this script does not rename.
// Seeded photos (seedKey) and photos already renamed are skipped; pending photos are renamed when approved. Idempotent:
// a photo with an unfinished job is not queued again. Note: the public URL of an approved photo changes.
// --dry-run queues nothing; a non-local database needs --yes.
// Run: bun run payload run scripts/seed/seo-filenames.ts [-- --dry-run | --yes]
import { getPayload } from 'payload'

import { SEO_RENAME_QUEUE, needsSeoRename } from '@/lib/media/seoName'
import config from '@/payload.config'

import { guardTarget } from './i18n'

const dryRun = process.argv.includes('--dry-run')
guardTarget(dryRun)
const payload = await getPayload({ config: await config })

const all = await payload.find({ collection: 'media', limit: 0, pagination: false, depth: 0, select: { filename: true, seoFilename: true, status: true, seedKey: true, seoRenamed: true } })
const open = await payload.find({ collection: 'payload-jobs', where: { taskSlug: { equals: 'seoRename' }, completedAt: { exists: false }, hasError: { not_equals: true } }, limit: 0, pagination: false, depth: 0 })
const queued = new Set(open.docs.map((j) => (j.input as { mediaId?: string }).mediaId))
const todo = all.docs.filter((d) => needsSeoRename(d, { force: true }) && !queued.has(String(d.id)))
const failed: string[] = []
let count = 0

for (const doc of todo) {
  try {
    if (!dryRun) await payload.jobs.queue({ task: 'seoRename', input: { mediaId: String(doc.id), force: true }, queue: SEO_RENAME_QUEUE })
    console.log(`#${doc.id} [${doc.status}] ${doc.filename}`)
    count++
  } catch (err) {
    failed.push(String(doc.id))
    console.error(`media #${doc.id}: ${err instanceof Error ? err.message : err}`)
  }
}
console.log(`${dryRun ? '[dry run] ' : ''}seoRename: ${count} job(s) ${dryRun ? 'would be queued' : 'queued (the job runner renames them within a minute)'}, ${all.docs.length - count} left as is (pending, seeded, renamed, SEO-named or already queued), ${failed.length} failed`)
if (failed.length) console.error(`failed: ${failed.join(', ')}`)
process.exit(failed.length ? 1 : 0)
