// #185: deleting media, or replacing its file, purges the old files' CDN URLs from the Cloudflare edge cache — only
// after the storage plugin has deleted the objects, so no request in between can re-cache them for a year.
// Only the Cloudflare API is faked (global fetch, which tsentials fetchResult uses); DB and S3 are real.
import { CopyObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { mkdirSync } from 'fs'
import os from 'os'
import path from 'path'
import { getPayload, type Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest'

import config from '@/payload.config'

let payload: Payload
const created: number[] = []
const DIR = path.join(os.tmpdir(), 'kefken-media-cdn-purge')
const ENDPOINT = 'https://api.cloudflare.com/client/v4/zones/test-zone/purge_cache'
const BASE = process.env.MEDIA_PUBLIC_URL!
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'auto',
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
})
const stored = (url: string) =>
  s3
    .send(new HeadObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: decodeURIComponent(url.slice(BASE.length + 1)) }))
    .then(() => true, () => false)

type Call = { url: string; auth: string | null; files: string[]; stillStored: string[] }
const purged: Call[] = []
let reply: () => Response = () => Response.json({ success: true, errors: [], result: { id: 'x' } })

const realFetch = globalThis.fetch
vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
  const url = input instanceof Request ? input.url : String(input)
  if (!url.startsWith('https://api.cloudflare.com/')) return realFetch(input, init)
  const files: string[] = JSON.parse(String(init?.body)).files
  // Checked when the call arrives: every purged object must already be gone from storage.
  const flags = await Promise.all(files.map(stored))
  purged.push({ url, auth: new Headers(init?.headers).get('authorization'), files, stillStored: files.filter((_, i) => flags[i]) })
  return reply()
})

async function upload(name: string, shade: number) {
  const file = path.join(DIR, `${name}-${Date.now()}.png`)
  await sharp({ create: { width: 1000, height: 700, channels: 3, background: { r: shade, g: 80, b: 60 } } }).png().toFile(file)
  return file
}
const create = async (name: string, shade: number) =>
  payload.create({ collection: 'media', data: {}, filePath: await upload(name, shade), context: { skipAi: true } })

// #216: a new upload purges its own URLs (fire-and-forget); the tests below that are about deletes and replacements wait for
// that purge and forget it.
const createQuiet = async (name: string, shade: number) => {
  const doc = await create(name, shade)
  await vi.waitFor(() => expect(purged.length).toBeGreaterThan(0))
  purged.length = 0
  return doc
}

// Sizes that would upscale (w1280, w1920 of a 1000 px image) share the original-size file, so each URL appears once.
const urlsOf = (doc: { filename?: string | null; prefix?: string | null; sizes?: object | null }) => [
  ...new Set(
    [doc.filename, ...Object.values(doc.sizes ?? {}).map((s: { filename?: string | null }) => s?.filename)]
      .filter(Boolean)
      .map((f) => [BASE, doc.prefix, f].filter(Boolean).join('/')),
  ),
]
const purgedFiles = () => purged.flatMap((p) => p.files).sort()

beforeAll(async () => {
  mkdirSync(DIR, { recursive: true })
  process.env.CLOUDFLARE_ZONE_ID = 'test-zone'
  process.env.CLOUDFLARE_PURGE_TOKEN = 'test-token'
  payload = await getPayload({ config: await config })
})
afterEach(() => {
  purged.length = 0
  reply = () => Response.json({ success: true, errors: [], result: { id: 'x' } })
})
afterAll(async () => {
  for (const id of created) await payload.delete({ collection: 'media', id }).catch(() => {})
  delete process.env.CLOUDFLARE_ZONE_ID
  delete process.env.CLOUDFLARE_PURGE_TOKEN
  vi.restoreAllMocks()
})

it('#216: a new upload purges its original and every size, so a cached 404 at a reused key is never served; objects carry a year-long immutable Cache-Control', async () => {
  const doc = await create('new', 70)
  created.push(doc.id)
  await vi.waitFor(() => expect(purged.length).toBeGreaterThan(0))
  expect(purgedFiles()).toEqual([...urlsOf(doc)].sort())
  expect(purged.every((p) => p.url === ENDPOINT && p.auth === 'Bearer test-token')).toBe(true)
  // Checked on every stored object, with the content type the size has.
  for (const f of [doc.filename, ...Object.values(doc.sizes ?? {}).map((x) => x?.filename)].filter((f): f is string => Boolean(f))) {
    const head = await s3.send(new HeadObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: [doc.prefix, f].filter(Boolean).join('/') }))
    expect([f, head.CacheControl, head.ContentType]).toEqual([f, 'public, max-age=31536000, immutable', 'image/webp'])
  }
})

it('#216: a bucket that hangs on the Cache-Control rewrite delays the upload by the 5 s budget at most; the upload and its purge stand', async () => {
  const send = S3Client.prototype.send
  const spy = vi.spyOn(S3Client.prototype, 'send').mockImplementation(function (this: S3Client, command: unknown, options?: { abortSignal?: AbortSignal }) {
    if (command instanceof CopyObjectCommand)
      return new Promise((_, reject) => options?.abortSignal?.addEventListener('abort', () => reject(new Error('aborted')))) as never
    return (send as (c: unknown, o?: unknown) => Promise<unknown>).call(this, command, options) as never
  } as never)
  const started = Date.now()
  let doc
  try {
    doc = await create('slow', 60)
  } finally {
    spy.mockRestore()
  }
  created.push(doc.id)
  expect(Date.now() - started).toBeLessThan(15_000)
  await vi.waitFor(() => expect(purged.length).toBeGreaterThan(0))
  expect(purgedFiles()).toEqual([...urlsOf(doc)].sort())
})

it('deleting a media doc purges its main file and every size, after they left storage', async () => {
  const doc = await createQuiet('del', 90)
  const expected = urlsOf(doc)
  expect(expected.length).toBeGreaterThan(5) // main + sizes up to 960 + portrait
  expect(await Promise.all(expected.map(stored))).toEqual(expected.map(() => true))

  await payload.delete({ collection: 'media', id: doc.id })
  await vi.waitFor(() => expect(purged.length).toBeGreaterThan(0))
  expect(purged.every((p) => p.url === ENDPOINT && p.auth === 'Bearer test-token')).toBe(true)
  expect(purgedFiles()).toEqual([...expected].sort())
  expect(purged.flatMap((p) => p.stillStored)).toEqual([])
})

it('a bulk delete purges every deleted doc once, after storage', async () => {
  const docs = [await createQuiet('bulk-a', 40), await createQuiet('bulk-b', 50)]
  await payload.delete({ collection: 'media', where: { id: { in: docs.map((d) => d.id) } } })
  await vi.waitFor(() => expect(purged.length).toBeGreaterThan(0))
  expect(purgedFiles()).toEqual(docs.flatMap(urlsOf).sort())
  expect(purged.flatMap((p) => p.stillStored)).toEqual([])
})

it('replacing the file purges the previous and the new files, the old ones after they left storage; a plain re-save purges nothing', async () => {
  const doc = await createQuiet('rep', 120)
  created.push(doc.id)

  await payload.update({ collection: 'media', id: doc.id, data: { title: 'Yeniden kaydedildi' }, context: { skipAi: true } })
  const updated = await payload.update({ collection: 'media', id: doc.id, data: {}, filePath: await upload('rep-next', 200), context: { skipAi: true } })
  expect(updated.filename).not.toBe(doc.filename)
  await vi.waitFor(() => expect(purged.length).toBeGreaterThan(0))
  expect(purgedFiles()).toEqual([...new Set([...urlsOf(doc), ...urlsOf(updated)])].sort()) // #216: the new file's URLs too
  expect(purged.flatMap((p) => p.stillStored.filter((u) => !urlsOf(updated).includes(u)))).toEqual([]) // the old ones are gone from storage
  // #216: the replacement's objects carry the Cache-Control too.
  const head = await s3.send(new HeadObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: [updated.prefix, updated.filename].filter(Boolean).join('/') }))
  expect(head.CacheControl).toBe('public, max-age=31536000, immutable')
})

it('a Cloudflare failure never fails the delete', async () => {
  reply = () => Response.json({ success: false, errors: [{ code: 10000, message: 'Authentication error' }] }, { status: 403 })
  const doc = await create('fail', 30)
  await expect(payload.delete({ collection: 'media', id: doc.id })).resolves.toMatchObject({ id: doc.id })
  await vi.waitFor(() => expect(purged.length).toBeGreaterThan(0))
  await expect(payload.find({ collection: 'media', where: { id: { equals: doc.id } } })).resolves.toMatchObject({ totalDocs: 0 })
})
