// #219: gives every object in the media bucket under S3_PREFIX the Cache-Control that #216 puts on new uploads
// (seeded and legacy objects were stored without one, so browsers no longer keep them once the CDN rule respects the origin).
// Lists the bucket (orphans count too), HEADs each object and, where Cache-Control differs, self-copies it with
// MetadataDirective REPLACE: ContentType and the other headers and user metadata are carried over, the bytes are never rewritten.
// Idempotent and resumable: an object that already has the header is skipped, so a re-run only does what is left.
// --dry-run only counts. Storage that is not local needs --yes (or --dry-run). No Payload or database needed.
// Run: bun scripts/media/backfill-cache-control.ts [--dry-run | --yes]
import { S3Client } from '@aws-sdk/client-s3'

import { backfillPrefix } from '@/lib/media/backfillCacheControl'
import { isLocalHost } from '@/lib/quality/target'

const dryRun = process.argv.includes('--dry-run')

const missing = ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'].filter((k) => !process.env[k])
if (missing.length) {
  console.error(`Missing env: ${missing.join(', ')}`)
  process.exit(1)
}
const bucket = process.env.S3_BUCKET!
const prefix = process.env.S3_PREFIX ? `${process.env.S3_PREFIX.replace(/\/+$/, '')}/` : ''
console.log(`bucket: ${bucket} · prefix: ${prefix || '(root)'} · endpoint: ${process.env.S3_ENDPOINT ?? 'default'}${dryRun ? ' · dry run' : ''}`)
const s3Host = process.env.S3_ENDPOINT ? new URL(process.env.S3_ENDPOINT).hostname : ''
if (!isLocalHost(s3Host) && !dryRun && !process.argv.includes('--yes')) {
  console.error('Storage is not local: check the target above, then re-run with --yes (or --dry-run first).')
  process.exit(1)
}

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'auto',
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
  maxAttempts: 8, // the SDK retries throttling and 5xx/network errors with exponential backoff
})

const counts = await backfillPrefix(s3, bucket, prefix, {
  dryRun,
  concurrency: 16,
  onProgress: (c) => console.log(`${c.updated + c.skipped + c.failed} objects: ${c.updated} to set, ${c.skipped} already set, ${c.failed} failed`),
  onError: (key, err) => console.error(`${key}: ${err instanceof Error ? err.message : err}`),
})
console.log(`${dryRun ? '[dry run] ' : ''}Cache-Control ${dryRun ? 'would be set' : 'set'} on ${counts.updated} objects, ${counts.skipped} already had it, ${counts.failed} failed`)
process.exit(counts.failed ? 1 : 0)
