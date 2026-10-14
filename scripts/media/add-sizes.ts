// #116: adds image sizes that were introduced after upload (w480) to existing approved media.
// Idempotent: media that already has the size, or whose original is not wider, is skipped, so a re-run (or a run cut
// short) only does what is left. Reads the stored original from S3 (GetObject), resizes it the way Payload does at
// upload (EXIF-rotated, same width, WebP q80, no enlargement), writes `<name>-<w>x<h>.webp` next to the other sizes,
// then saves only that size entry through the local API (which also revalidates the public pages).
// The original and the existing sizes are never rewritten (Payload's own re-upload would re-encode the original).
// --dry-run reads and encodes everything but writes nothing. A non-local database or storage needs --yes (or --dry-run).
// Run: bun run payload run scripts/media/add-sizes.ts [-- --dry-run | --yes]
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getPayload } from 'payload'
import sharp from 'sharp'

import config from '@/payload.config'
import { derivativeFilename, needsDerivative } from '@/lib/media/derivative'
import { databaseHost, isLocalHost } from '@/lib/quality/target'

const SIZES = { w480: 480 } as const
const QUALITY = 80 // = Media.upload.imageSizes formatOptions
const dryRun = process.argv.includes('--dry-run')

const missing = ['DATABASE_URL', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'MEDIA_PUBLIC_URL'].filter((k) => !process.env[k])
if (missing.length) {
  console.error(`Missing env: ${missing.join(', ')}`)
  process.exit(1)
}
const bucket = process.env.S3_BUCKET!
const host = databaseHost(process.env.DATABASE_URL)
console.log(`database host: ${host || '?'} · bucket: ${bucket} · endpoint: ${process.env.S3_ENDPOINT ?? 'default'}${dryRun ? ' · dry run' : ''}`)
// A tunnelled database still reads as localhost, so the storage endpoint counts too.
const s3Host = process.env.S3_ENDPOINT ? new URL(process.env.S3_ENDPOINT).hostname : ''
if (!(isLocalHost(host) && isLocalHost(s3Host)) && !dryRun && !process.argv.includes('--yes')) {
  console.error('Not a local database and storage: check the target above, then re-run with --yes (or --dry-run first).')
  process.exit(1)
}

const payload = await getPayload({ config: await config })
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'auto',
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
})

let added = 0
let skipped = 0
let failed = 0
for (let page = 1, more = true; more; page++) {
  const res = await payload.find({ collection: 'media', where: { status: { equals: 'approved' } }, limit: 50, page, depth: 0, sort: 'id', overrideAccess: true })
  more = res.hasNextPage
  for (const doc of res.docs) {
    const todo = Object.entries(SIZES).filter(([name, width]) => needsDerivative(doc, name, width))
    if (!todo.length || !doc.filename) {
      skipped++
      continue
    }
    const key = (filename: string) => [doc.prefix, filename].filter(Boolean).join('/')
    try {
      const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key(doc.filename) }))
      const original = Buffer.from(await object.Body!.transformToByteArray())
      const sizes: Record<string, unknown> = {}
      for (const [name, width] of todo) {
        const { data, info } = await sharp(original).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: QUALITY }).toBuffer({ resolveWithObject: true })
        const filename = derivativeFilename(doc.filename, info.width, info.height)
        if (!dryRun) await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key(filename), Body: data, ContentType: 'image/webp' }))
        sizes[name] = { filename, width: info.width, height: info.height, mimeType: 'image/webp', filesize: data.length }
      }
      // Only the new entries: Payload keeps the other size columns as they are.
      if (!dryRun) await payload.update({ collection: 'media', id: doc.id, data: { sizes }, context: { skipAi: true }, overrideAccess: true, depth: 0 })
      added++
    } catch (err) {
      failed++
      console.error(`media ${doc.id} (${doc.filename}): ${err instanceof Error ? err.message : err}`)
    }
  }
}
console.log(`${dryRun ? '[dry run] ' : ''}sizes added to ${added} approved media, ${skipped} already complete or too small, ${failed} failed`)
process.exit(failed ? 1 : 0)
