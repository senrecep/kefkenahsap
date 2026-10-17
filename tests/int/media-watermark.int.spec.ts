// #169: admin uploads get the "kefkenahsap.com" mark on the public file and every size, the clean original stays on the
// private volume only, and nothing is ever stamped twice.
import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import os from 'os'
import path from 'path'
import { getPayload, type Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, expect, it } from 'vitest'

import { MEDIA_ORIGINALS_DIR } from '@/collections/Media'
import config from '@/payload.config'

let payload: Payload
const created: number[] = []
const DIR = path.join(os.tmpdir(), 'kefken-media-watermark')
const W = 1200
const H = 900
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'auto',
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
})
const bucket = process.env.S3_BUCKET!
const key = (filename: string) => [process.env.S3_PREFIX, filename].filter(Boolean).join('/')
const object = async (filename: string) => {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key(filename) }))
  return { data: Buffer.from(await res.Body!.transformToByteArray()), etag: res.ETag }
}

// A distinct image per test so stored filenames never collide with an earlier run.
async function upload(name: string, data: Record<string, unknown> = {}, size = { width: W, height: H }) {
  const file = path.join(DIR, `${name}-${Date.now()}.png`)
  await sharp({ create: { ...size, channels: 3, background: { r: 90, g: 80, b: 60 } } }).png().toFile(file)
  const doc = await payload.create({ collection: 'media', data, filePath: file, context: { skipAi: true } })
  created.push(doc.id)
  return { doc, clean: readFileSync(file) }
}

/** Mean absolute difference (0–255) of two images over a box given in fractions of their size. */
async function diff(a: Buffer, b: Buffer, box: { x: number; y: number; w: number; h: number }) {
  const meta = await sharp(a).metadata()
  const region = { left: Math.round(meta.width! * box.x), top: Math.round(meta.height! * box.y), width: Math.round(meta.width! * box.w), height: Math.round(meta.height! * box.h) }
  const raw = (img: Buffer) => sharp(img).resize(meta.width, meta.height).removeAlpha().extract(region).raw().toBuffer()
  const [pa, pb] = await Promise.all([raw(a), raw(b)])
  let sum = 0
  for (let i = 0; i < pa.length; i++) sum += Math.abs(pa[i]! - pb[i]!)
  return sum / pa.length
}
const CENTRE = { x: 0.3, y: 0.47, w: 0.4, h: 0.06 }
const CORNER = { x: 0, y: 0, w: 0.2, h: 0.2 }

beforeAll(async () => {
  mkdirSync(DIR, { recursive: true })
  payload = await getPayload({ config: await config })
})
afterAll(async () => {
  for (const id of created) await payload.delete({ collection: 'media', id }).catch(() => {})
})

it('stamps the public file and every size, keeps the clean original private', async () => {
  const { doc, clean } = await upload('mark')
  expect(doc.watermark).toBe('applied')

  const main = await object(doc.filename!)
  expect(await diff(clean, main.data, CENTRE)).toBeGreaterThan(5)
  expect(await diff(clean, main.data, CORNER)).toBeLessThan(2) // only the centre changes (WebP noise aside)

  const w480 = await object(doc.sizes!.w480!.filename!)
  expect(await sharp(w480.data).metadata()).toMatchObject({ width: 480 })
  expect(await diff(clean, w480.data, CENTRE)).toBeGreaterThan(5)

  // The clean (unmarked) original is on the private volume as WebP, at its own size (never upscaled), outside public/
  // and the bucket.
  const original = path.join(MEDIA_ORIGINALS_DIR, `${path.parse(doc.filename!).name}.webp`)
  expect(await sharp(readFileSync(original)).metadata()).toMatchObject({ width: W, height: H, format: 'webp' })
  expect(await diff(clean, readFileSync(original), CENTRE)).toBeLessThan(2)
  expect(path.relative(path.resolve('public'), MEDIA_ORIGINALS_DIR).startsWith('..')).toBe(true)
  const stem = path.parse(doc.filename!).name
  const listed = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: key(stem) }))
  const stored = [doc.filename, ...Object.values(doc.sizes ?? {}).map((s) => s?.filename)].filter(Boolean).map((f) => key(f!))
  const ours = (listed.Contents ?? []).map((o) => o.Key!).filter((k) => path.parse(k).name.replace(/-\d+x\d+$/, '') === stem)
  expect(ours.sort()).toEqual([...new Set(stored)].sort()) // no clean copy next to the stamped ones

  // Deleting the image deletes its clean original too.
  await payload.delete({ collection: 'media', id: doc.id })
  created.splice(created.indexOf(doc.id), 1)
  expect(existsSync(original)).toBe(false)
})

it('a large upload keeps its clean original downscaled to 2560 px on the long side', async () => {
  const { doc, clean } = await upload('large', {}, { width: 4000, height: 3000 })
  const original = readFileSync(path.join(MEDIA_ORIGINALS_DIR, `${path.parse(doc.filename!).name}.webp`))
  expect(await sharp(original).metadata()).toMatchObject({ width: 2560, height: 1920, format: 'webp' })
  expect(await diff(clean, original, CENTRE)).toBeLessThan(2)
})

it('replacing the file removes an older original stored under its uploaded extension', async () => {
  const { doc } = await upload('legacy')
  const stem = path.parse(doc.filename!).name
  const legacy = path.join(MEDIA_ORIGINALS_DIR, `${stem}.jpg`)
  writeFileSync(legacy, 'old')
  const next = path.join(DIR, `legacy-next-${Date.now()}.png`)
  await sharp({ create: { width: 300, height: 200, channels: 3, background: { r: 10, g: 10, b: 10 } } }).png().toFile(next)
  await payload.update({ collection: 'media', id: doc.id, data: {}, filePath: next, context: { skipAi: true } })
  expect(existsSync(legacy)).toBe(false)
  expect(existsSync(path.join(MEDIA_ORIGINALS_DIR, `${stem}.webp`))).toBe(false)
})

it('re-saving the document never stamps again', async () => {
  const { doc } = await upload('resave')
  const before = await object(doc.filename!)
  const saved = await payload.update({ collection: 'media', id: doc.id, data: { title: 'Yeniden kaydedildi', focalX: 30, focalY: 40 }, context: { skipAi: true } })
  expect(saved.watermark).toBe('applied')
  expect(saved.filename).toBe(doc.filename)
  const after = await object(saved.filename!)
  expect(after.data.equals(before.data)).toBe(true)
})

it('a duplicate copies the marked file as is and does not claim a clean original', async () => {
  const { doc } = await upload('dup')
  const copy = await payload.duplicate({ collection: 'media', id: doc.id, context: { skipAi: true } })
  created.push(copy.id)
  expect(copy.watermark).toBe('already')
  const [source, copied] = await Promise.all([object(doc.filename!), object(copy.filename!)])
  expect(await diff(source.data, copied.data, CENTRE)).toBeLessThan(2)
  expect(existsSync(path.join(MEDIA_ORIGINALS_DIR, `${path.parse(copy.filename!).name}.webp`))).toBe(false)
})

it('"Filigran ekleme" and files that already carry the mark are stored as uploaded', async () => {
  for (const [name, data, state] of [
    ['optout', { skipWatermark: true }, 'none'],
    ['seeded', { watermark: 'already' }, 'already'],
  ] as const) {
    const { doc, clean } = await upload(name, data)
    expect(doc.watermark).toBe(state)
    expect(await diff(clean, (await object(doc.filename!)).data, CENTRE)).toBeLessThan(2)
    expect(existsSync(path.join(MEDIA_ORIGINALS_DIR, `${path.parse(doc.filename!).name}.webp`))).toBe(false)
  }
})

it('replacing the file stamps the new one and swaps the private original', async () => {
  const { doc } = await upload('replace')
  const next = path.join(DIR, `replace-next-${Date.now()}.png`)
  await sharp({ create: { width: W, height: H, channels: 3, background: { r: 200, g: 190, b: 170 } } }).png().toFile(next)
  // The admin echoes the stored state on update; it describes the old file, so it must not block the new stamp.
  const updated = await payload.update({ collection: 'media', id: doc.id, data: { watermark: 'applied' }, filePath: next, context: { skipAi: true } })
  expect(updated.watermark).toBe('applied')
  expect(await diff(readFileSync(next), (await object(updated.filename!)).data, CENTRE)).toBeGreaterThan(5)
  expect(await diff(readFileSync(next), readFileSync(path.join(MEDIA_ORIGINALS_DIR, `${path.parse(updated.filename!).name}.webp`)), CENTRE)).toBeLessThan(2)
  expect(updated.filename).not.toBe(doc.filename)
  expect(existsSync(path.join(MEDIA_ORIGINALS_DIR, `${path.parse(doc.filename!).name}.webp`))).toBe(false)
  writeFileSync(next, '') // keep tmp small
})

it('replacing the file with "Filigran ekleme" still drops the old clean original', async () => {
  const { doc } = await upload('replace-optout')
  const next = path.join(DIR, `replace-optout-next-${Date.now()}.png`)
  await sharp({ create: { width: W, height: H, channels: 3, background: { r: 200, g: 190, b: 170 } } }).png().toFile(next)
  const updated = await payload.update({ collection: 'media', id: doc.id, data: { skipWatermark: true }, filePath: next, context: { skipAi: true } })
  expect(updated.watermark).toBe('none')
  expect(existsSync(path.join(MEDIA_ORIGINALS_DIR, `${path.parse(doc.filename!).name}.webp`))).toBe(false)
  expect(existsSync(path.join(MEDIA_ORIGINALS_DIR, `${path.parse(updated.filename!).name}.webp`))).toBe(false)
})

it('a file upload on a bulk update is refused', async () => {
  const { doc } = await upload('bulk')
  const next = path.join(DIR, `bulk-next-${Date.now()}.png`)
  await sharp({ create: { width: 300, height: 200, channels: 3, background: { r: 10, g: 10, b: 10 } } }).png().toFile(next)
  await expect(
    payload.update({ collection: 'media', where: { id: { equals: doc.id } }, data: {}, filePath: next, context: { skipAi: true } }),
  ).rejects.toThrow(/tek bir görselde/)
  expect((await payload.findByID({ collection: 'media', id: doc.id })).filename).toBe(doc.filename)
})
