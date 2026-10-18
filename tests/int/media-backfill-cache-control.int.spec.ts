// #219: objects stored without Cache-Control get it in place; ContentType, user metadata and bytes stay; a second run changes nothing.
// Real S3 (RustFS), no Payload.
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { afterAll, expect, it } from 'vitest'

import { backfillPrefix } from '@/lib/media/backfillCacheControl'
import { MEDIA_CACHE_CONTROL } from '@/lib/media/renameStored'

const bucket = process.env.S3_BUCKET!
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'auto',
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
})
const prefix = `backfill-cc-${Date.now().toString(36)}/`
const head = (name: string) => s3.send(new HeadObjectCommand({ Bucket: bucket, Key: prefix + name }))
const put = (name: string, body: string, extra: Partial<ConstructorParameters<typeof PutObjectCommand>[0]> = {}) =>
  s3.send(new PutObjectCommand({ Bucket: bucket, Key: prefix + name, Body: body, ...extra }))

afterAll(async () => {
  const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')
  for (const n of ['plain.webp', 'meta Ünï.png', 'done.webp', 'no-type.jpg']) await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: prefix + n }))
})

it('sets Cache-Control, keeps type, metadata and bytes, and is a no-op the second time', async () => {
  await put('plain.webp', 'webp-bytes', { ContentType: 'image/webp' })
  await put('meta Ünï.png', 'png-bytes', { ContentType: 'image/png', Metadata: { source: 'wp' } })
  await put('done.webp', 'done-bytes', { ContentType: 'image/webp', CacheControl: MEDIA_CACHE_CONTROL })
  await put('no-type.jpg', 'jpg-bytes', { ContentType: '' })

  const dry = await backfillPrefix(s3, bucket, prefix, { dryRun: true, concurrency: 2 })
  expect(dry).toEqual({ updated: 3, skipped: 1, failed: 0 })
  expect((await head('plain.webp')).CacheControl).toBeUndefined()

  expect(await backfillPrefix(s3, bucket, prefix, { concurrency: 2 })).toEqual({ updated: 3, skipped: 1, failed: 0 })

  const plain = await head('plain.webp')
  expect(plain.CacheControl).toBe(MEDIA_CACHE_CONTROL)
  expect(plain.ContentType).toBe('image/webp')
  const meta = await head('meta Ünï.png')
  expect(meta.CacheControl).toBe(MEDIA_CACHE_CONTROL)
  expect(meta.ContentType).toBe('image/png')
  expect(meta.Metadata).toEqual({ source: 'wp' })
  expect((await head('no-type.jpg')).ContentType).toBe('image/jpeg')
  const body = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: `${prefix}meta Ünï.png` }))
  expect(await body.Body!.transformToString()).toBe('png-bytes')

  const etag = (await head('plain.webp')).ETag
  expect(await backfillPrefix(s3, bucket, prefix)).toEqual({ updated: 0, skipped: 4, failed: 0 })
  expect((await head('plain.webp')).ETag).toBe(etag)
})
