// #209: an admin upload is stored under its upload name; its first approval renames the stored file and every size to the
// SEO name, once. Only the Cloudflare API is faked (global fetch); DB and S3 are real.
import { CopyObjectCommand, GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { mkdirSync } from 'fs'
import os from 'os'
import path from 'path'
import { getPayload, type Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest'

import config from '@/payload.config'

let payload: Payload
const created: number[] = []
const DIR = path.join(os.tmpdir(), 'kefken-media-seo-rename')
const BASE = process.env.MEDIA_PUBLIC_URL!
const bucket = process.env.S3_BUCKET!
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'auto',
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
})
const key = (prefix: string | null | undefined, filename: string) => [prefix, filename].filter(Boolean).join('/')
const exists = (prefix: string | null | undefined, filename: string) =>
  s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key(prefix, filename) })).then(() => true, () => false)
const bytes = async (prefix: string | null | undefined, filename: string) =>
  Buffer.from(await (await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key(prefix, filename) }))).Body!.transformToByteArray())

const purged: string[] = []
const realFetch = globalThis.fetch
vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
  const url = input instanceof Request ? input.url : String(input)
  if (!url.startsWith('https://api.cloudflare.com/')) return realFetch(input, init)
  purged.push(...JSON.parse(String(init?.body)).files)
  return Response.json({ success: true, errors: [], result: { id: 'x' } })
})

const run = Date.now().toString(36)
let n = 0
// A distinct upload name per call; the image itself is 1000x700 so w1280/w1920 share the original.
async function create(data: Record<string, unknown> = {}, uploadName = `WhatsApp Image ${run} ${++n}`) {
  const file = path.join(DIR, `${uploadName}.png`)
  await sharp({ create: { width: 1000, height: 700, channels: 3, background: { r: 30 + n * 7, g: 80, b: 60 } } }).png().toFile(file)
  const doc = await payload.create({
    collection: 'media',
    locale: 'tr',
    data: { status: 'pending', title: 'Bahçe Köpek Kulübesi', alt: 'Verandalı ahşap köpek kulübesi', ...data },
    filePath: file,
    context: { skipAi: true },
  })
  created.push(doc.id)
  return doc
}
const approve = (id: number | string, data: Record<string, unknown> = {}, locale: 'tr' | 'en' = 'tr') =>
  payload.update({ collection: 'media', id, locale, data: { status: 'approved', ...data }, context: { skipAi: true } })
const filesOf = (doc: { filename?: string | null; sizes?: object | null }) => [
  ...new Set([doc.filename, ...Object.values(doc.sizes ?? {}).map((s: { filename?: string | null }) => s?.filename)].filter(Boolean) as string[]),
]
const purgedAfterSend = () => vi.waitFor(() => expect(purged.length).toBeGreaterThan(0))

beforeAll(async () => {
  mkdirSync(DIR, { recursive: true })
  process.env.CLOUDFLARE_ZONE_ID = 'test-zone'
  process.env.CLOUDFLARE_PURGE_TOKEN = 'test-token'
  payload = await getPayload({ config: await config })
})
afterEach(() => {
  purged.length = 0
  vi.restoreAllMocks()
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input)
    if (!url.startsWith('https://api.cloudflare.com/')) return realFetch(input, init)
    purged.push(...JSON.parse(String(init?.body)).files)
    return Response.json({ success: true, errors: [], result: { id: 'x' } })
  })
})
afterAll(async () => {
  for (const id of created) await payload.delete({ collection: 'media', id }).catch(() => {})
  delete process.env.CLOUDFLARE_ZONE_ID
  delete process.env.CLOUDFLARE_PURGE_TOKEN
  vi.restoreAllMocks()
})

it('approving renames the original and every size, moves the objects, purges the old URLs, stamps nothing again', async () => {
  const seo = `seo-bahce-${run}`
  const doc = await create({ seoFilename: seo })
  const oldFiles = filesOf(doc)
  expect(oldFiles.length).toBeGreaterThan(5)
  const stampedBefore = await bytes(doc.prefix, doc.filename!)
  const w480Before = await bytes(doc.prefix, doc.sizes!.w480!.filename!)

  const approved = await approve(doc.id)

  expect(approved.filename).toBe(`${seo}.webp`)
  expect(approved.sizes!.w480!.filename).toBe(`${seo}-480x336.webp`)
  expect(approved.sizes!.w320!.filename).toBe(`${seo}-320x224.webp`)
  expect(approved.sizes!.portrait!.filename).toBe(`${seo}-400x700.webp`)
  expect(approved.seoFilename).toBe(seo)
  expect(approved.watermark).toBe('applied')
  expect(new URL(approved.url!).href).toBe(new URL(`${BASE}/${key(doc.prefix, `${seo}.webp`)}`).href)
  expect(approved.sizes!.w480!.url).toContain(`${seo}-480x336.webp`)
  // Stored row matches the response.
  const stored = await payload.findByID({ collection: 'media', id: doc.id, depth: 0 })
  expect(stored.filename).toBe(approved.filename)
  expect(stored.sizes!.w960!.filename).toBe(approved.sizes!.w960!.filename)

  const newFiles = filesOf(approved)
  expect(newFiles).toHaveLength(oldFiles.length)
  expect(await Promise.all(newFiles.map((f) => exists(doc.prefix, f)))).toEqual(newFiles.map(() => true))
  expect(await Promise.all(oldFiles.map((f) => exists(doc.prefix, f)))).toEqual(oldFiles.map(() => false))
  // Same bytes: the copy is not re-encoded, so the mark is not stacked.
  expect(await bytes(doc.prefix, `${seo}.webp`)).toEqual(stampedBefore)
  expect(await bytes(doc.prefix, `${seo}-480x336.webp`)).toEqual(w480Before)

  await purgedAfterSend()
  const oldURLs = oldFiles.map((f) => new URL(`${BASE}/${key(doc.prefix, f)}`).href)
  expect([...new Set(purged)].sort()).toEqual([...oldURLs].sort())
})

it('approving through the English edit form still names the file from the SEO name', async () => {
  const seo = `seo-en-${run}`
  const doc = await create({ seoFilename: seo })
  const approved = await approve(doc.id, { title: 'Garden dog house' }, 'en')
  expect(approved.filename).toBe(`${seo}.webp`)
})

it('a later approval or edit renames nothing', async () => {
  const seo = `seo-once-${run}`
  const doc = await create({ seoFilename: seo })
  const first = await approve(doc.id)
  await payload.update({ collection: 'media', id: doc.id, data: { status: 'hidden' }, context: { skipAi: true } })
  await payload.update({ collection: 'media', id: doc.id, data: { title: 'Yeni başlık' }, context: { skipAi: true } })
  purged.length = 0
  const again = await approve(doc.id)
  expect(again.filename).toBe(first.filename)
  expect(filesOf(again)).toEqual(filesOf(first))
  await new Promise((r) => setTimeout(r, 300))
  expect(purged).toEqual([])
})

it('a name already used by another file gets -2', async () => {
  const seo = `seo-clash-${run}`
  const a = await create({ seoFilename: seo })
  const b = await create({ seoFilename: seo })
  expect((await approve(a.id)).filename).toBe(`${seo}.webp`)
  const second = await approve(b.id)
  expect(second.filename).toBe(`${seo}-2.webp`)
  expect(second.seoFilename).toBe(seo) // the gallery slug is not touched
  expect(second.sizes!.w320!.filename).toBe(`${seo}-2-320x224.webp`)
})

it('simultaneous approvals of the same SEO name get different files', async () => {
  const seo = `seo-race-${run}`
  const docs = await Promise.all([create({ seoFilename: seo }), create({ seoFilename: seo })])
  const done = await Promise.all(docs.map((d) => approve(d.id)))
  expect(done.map((d) => d.filename).sort()).toEqual([`${seo}-2.webp`, `${seo}.webp`])
})

it('an empty seoFilename falls back to the Turkish title slug and fills seoFilename', async () => {
  const doc = await create({ seoFilename: '', title: `Çatı Katı Pergola ${run}` })
  const approved = await approve(doc.id)
  const slug = `cati-kati-pergola-${run}`
  expect(approved.filename).toBe(`${slug}.webp`)
  expect(approved.seoFilename).toBe(slug)
})

it('with neither seoFilename nor title the name is kefken-ahsap-<id>', async () => {
  const doc = await create({ seoFilename: '', title: '' })
  const approved = await approve(doc.id)
  expect(approved.filename).toBe(`kefken-ahsap-${doc.id}.webp`)
})

it('a new file on a document that already has an SEO-named file keeps the SEO name', async () => {
  const seo = `seo-replace-${run}`
  const doc = await create({ seoFilename: seo })
  const approved = await approve(doc.id)
  const file = path.join(DIR, `Yeni Yukleme ${run}.png`)
  await sharp({ create: { width: 1000, height: 700, channels: 3, background: { r: 200, g: 20, b: 20 } } }).png().toFile(file)
  const replaced = await payload.update({ collection: 'media', id: doc.id, data: {}, filePath: file, context: { skipAi: true } })
  expect(replaced.filename).toBe(approved.filename)
  expect(replaced.sizes!.w480!.filename).toBe(approved.sizes!.w480!.filename)
  expect(await exists(doc.prefix, replaced.filename!)).toBe(true)
  // The new file's bytes are stored under the SEO name.
  expect((await sharp(await bytes(doc.prefix, replaced.filename!)).stats()).dominant.r).toBeGreaterThan(150)
})

it('a seeded photo keeps its file names', async () => {
  const doc = await create({ seoFilename: `seo-seeded-${run}`, seedKey: `test/seeded-${run}` })
  const approved = await approve(doc.id)
  expect(approved.filename).toBe(doc.filename)
})

it('a copy failure leaves the document and its objects unchanged', async () => {
  const seo = `seo-fail-${run}`
  const doc = await create({ seoFilename: seo })
  const oldFiles = filesOf(doc)
  const send = S3Client.prototype.send
  vi.spyOn(S3Client.prototype, 'send').mockImplementation(function (this: S3Client, command: unknown) {
    if (command instanceof CopyObjectCommand && String(command.input.Key).includes('-480x')) return Promise.reject(new Error('boom'))
    return (send as (c: unknown) => Promise<unknown>).call(this, command)
  } as never)

  await expect(approve(doc.id)).rejects.toThrow()

  vi.restoreAllMocks()
  const stored = await payload.findByID({ collection: 'media', id: doc.id, depth: 0 })
  expect(stored.status).toBe('pending')
  expect(stored.filename).toBe(doc.filename)
  expect(filesOf(stored)).toEqual(oldFiles)
  expect(await Promise.all(oldFiles.map((f) => exists(doc.prefix, f)))).toEqual(oldFiles.map(() => true))
  // Copies made before the failure are undone.
  expect(await exists(doc.prefix, `${seo}.webp`)).toBe(false)
})

it('the one-off script path renames a hidden document when forced', async () => {
  const seo = `seo-force-${run}`
  const doc = await create({ seoFilename: seo, status: 'hidden' })
  const renamed = await payload.update({ collection: 'media', id: doc.id, data: {}, context: { skipAi: true, seoRename: 'force' } })
  expect(renamed.filename).toBe(`${seo}.webp`)
  expect(renamed.status).toBe('hidden')
})
