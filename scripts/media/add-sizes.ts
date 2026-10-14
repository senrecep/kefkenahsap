// #116: adds image sizes that were introduced after upload (w480) to existing media. Idempotent: media that already
// has the size, or whose original is not wider, is skipped. Reads the stored original from S3, resizes it the way
// Payload does at upload (same width, WebP q80, no enlargement), writes `<name>-<w>x<h>.webp` next to the other sizes,
// then saves the size on the document through the local API (which also revalidates the public pages).
// The original and the existing sizes are never rewritten (Payload's own re-upload would re-encode the original).
// Run: bun run payload run scripts/media/add-sizes.ts [-- --dry-run]
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3' // ships with @payloadcms/storage-s3
import { getPayload } from 'payload'
import sharp from 'sharp'

import config from '@/payload.config'
import { derivativeFilename, needsDerivative } from '@/lib/media/derivative'

const SIZES = { w480: 480 } as const
const QUALITY = 80 // = Media.upload.imageSizes formatOptions
const dryRun = process.argv.includes('--dry-run')

const payload = await getPayload({ config: await config })
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'auto',
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID || '', secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '' },
})

let added = 0
let skipped = 0
let failed = 0
for (let page = 1, more = true; more; page++) {
  const res = await payload.find({ collection: 'media', limit: 50, page, depth: 0, sort: 'id', overrideAccess: true })
  more = res.hasNextPage
  for (const doc of res.docs) {
    const todo = Object.entries(SIZES).filter(([name, width]) => needsDerivative(doc, name, width))
    if (!todo.length || !doc.filename || !doc.url) {
      skipped++
      continue
    }
    try {
      const source = await fetch(doc.url)
      if (!source.ok) throw new Error(`GET ${doc.url}: ${source.status}`)
      const original = Buffer.from(await source.arrayBuffer())
      const sizes: Record<string, unknown> = {}
      for (const [name, width] of todo) {
        const { data, info } = await sharp(original).resize({ width, withoutEnlargement: true }).webp({ quality: QUALITY }).toBuffer({ resolveWithObject: true })
        const filename = derivativeFilename(doc.filename, info.width, info.height)
        const key = [doc.prefix, filename].filter(Boolean).join('/')
        if (!dryRun) await s3.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: data, ContentType: 'image/webp' }))
        sizes[name] = { filename, width: info.width, height: info.height, mimeType: 'image/webp', filesize: data.length }
      }
      if (!dryRun) await payload.update({ collection: 'media', id: doc.id, data: { sizes: { ...doc.sizes, ...sizes } }, context: { skipAi: true }, overrideAccess: true, depth: 0 })
      added++
    } catch (err) {
      failed++
      console.error(`media ${doc.id} (${doc.filename}): ${err instanceof Error ? err.message : err}`)
    }
  }
}
console.log(`${dryRun ? '[dry run] ' : ''}sizes added to ${added} media, ${skipped} already complete or too small, ${failed} failed`)
process.exit(failed ? 1 : 0)
