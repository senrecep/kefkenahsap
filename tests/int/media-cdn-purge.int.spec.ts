// #185: deleting a media doc, or replacing its file, purges the old files' CDN URLs from the Cloudflare edge cache.
// Only the Cloudflare API is faked (global fetch, which tsentials fetchResult uses); DB and S3 are real.
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
const purged: { url: string; auth: string | null; files: string[] }[] = []
let reply: () => Response = () => Response.json({ success: true, errors: [], result: { id: 'x' } })

const realFetch = globalThis.fetch
vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
  const url = input instanceof Request ? input.url : String(input)
  if (!url.startsWith('https://api.cloudflare.com/')) return realFetch(input, init)
  purged.push({ url, auth: new Headers(init?.headers).get('authorization'), files: JSON.parse(String(init?.body)).files })
  return reply()
})

async function image(name: string, shade: number) {
  const file = path.join(DIR, `${name}-${Date.now()}.png`)
  await sharp({ create: { width: 1000, height: 700, channels: 3, background: { r: shade, g: 80, b: 60 } } }).png().toFile(file)
  return file
}
// Sizes that would upscale (w1280, w1920 of a 1000 px image) share the original-size file, so each URL appears once.
const urlsOf = (doc: { filename?: string | null; prefix?: string | null; sizes?: object | null }) => [
  ...new Set(
    [doc.filename, ...Object.values(doc.sizes ?? {}).map((s: { filename?: string | null }) => s?.filename)]
      .filter(Boolean)
      .map((f) => [process.env.MEDIA_PUBLIC_URL, doc.prefix, f].filter(Boolean).join('/')),
  ),
]

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
  delete process.env.CLOUDFLARE_ZONE_ID
  delete process.env.CLOUDFLARE_PURGE_TOKEN
  for (const id of created) await payload.delete({ collection: 'media', id }).catch(() => {})
  vi.restoreAllMocks()
})

it('deleting a media doc purges its main file and every size', async () => {
  const doc = await payload.create({ collection: 'media', data: {}, filePath: await image('del', 90), context: { skipAi: true } })
  const expected = urlsOf(doc)
  expect(expected.length).toBeGreaterThan(5) // main + sizes up to 960 + portrait
  expect(purged).toEqual([]) // a new upload purges nothing

  await payload.delete({ collection: 'media', id: doc.id })
  await vi.waitFor(() => expect(purged.length).toBeGreaterThan(0))
  expect(purged.every((p) => p.url === ENDPOINT && p.auth === 'Bearer test-token')).toBe(true)
  expect(purged.flatMap((p) => p.files).sort()).toEqual([...expected].sort())
})

it('replacing the file purges the previous files only; a plain re-save purges nothing', async () => {
  const doc = await payload.create({ collection: 'media', data: {}, filePath: await image('rep', 120), context: { skipAi: true } })
  created.push(doc.id)

  await payload.update({ collection: 'media', id: doc.id, data: { title: 'Yeniden kaydedildi' }, context: { skipAi: true } })
  const updated = await payload.update({ collection: 'media', id: doc.id, data: {}, filePath: await image('rep-next', 200), context: { skipAi: true } })
  expect(updated.filename).not.toBe(doc.filename)
  await vi.waitFor(() => expect(purged.length).toBeGreaterThan(0))
  expect(purged.flatMap((p) => p.files).sort()).toEqual([...urlsOf(doc)].sort())
})

it('a Cloudflare failure never fails the delete', async () => {
  reply = () => Response.json({ success: false, errors: [{ code: 10000, message: 'Authentication error' }] }, { status: 403 })
  const doc = await payload.create({ collection: 'media', data: {}, filePath: await image('fail', 30), context: { skipAi: true } })
  await expect(payload.delete({ collection: 'media', id: doc.id })).resolves.toMatchObject({ id: doc.id })
  await vi.waitFor(() => expect(purged.length).toBeGreaterThan(0))
  await expect(payload.find({ collection: 'media', where: { id: { equals: doc.id } } })).resolves.toMatchObject({ totalDocs: 0 })
})
