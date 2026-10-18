// #209: an admin upload is stored under its upload name; once it is approved, the seoRename job renames the stored file and
// every size to the SEO name, once. Only the Cloudflare API is faked (global fetch); DB and S3 are real.
import { CopyObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
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
const openJobs = async (id: number | string) => {
  const { docs } = await payload.find({ collection: 'payload-jobs', where: { taskSlug: { equals: 'seoRename' } }, sort: '-createdAt', limit: 500, depth: 0 })
  return docs.filter((j) => !j.completedAt && !j.hasError && (j.input as { mediaId?: string }).mediaId === String(id))
}
/** Runs the photo's queued seoRename job(s), as the every-minute cron would. */
const runJobs = async (id: number | string) => {
  const jobs = await openJobs(id)
  for (const j of jobs) await payload.jobs.runByID({ id: j.id })
  return jobs.length
}
const read = (id: number | string) => payload.findByID({ collection: 'media', id, depth: 0 })

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
  // Unfinished jobs would be run by the next suite that calls jobs.run().
  await payload.delete({ collection: 'payload-jobs', where: { taskSlug: { equals: 'seoRename' }, completedAt: { exists: false } } }).catch(() => {})
  for (const id of created) await payload.delete({ collection: 'media', id }).catch(() => {})
  delete process.env.CLOUDFLARE_ZONE_ID
  delete process.env.CLOUDFLARE_PURGE_TOKEN
  vi.restoreAllMocks()
})

it('approving queues a job that renames the original and every size, moves the objects, purges the old URLs, stamps nothing again', async () => {
  const seo = `seo-bahce-${run}`
  const doc = await create({ seoFilename: seo })
  const oldFiles = filesOf(doc)
  expect(oldFiles.length).toBeGreaterThan(5)
  const stampedBefore = await bytes(doc.prefix, doc.filename!)
  const w480Before = await bytes(doc.prefix, doc.sizes!.w480!.filename!)
  expect(await openJobs(doc.id)).toHaveLength(0) // pending: nothing queued

  const approved = await approve(doc.id)
  expect(approved.filename).toBe(doc.filename) // the save itself renames nothing
  expect(await runJobs(doc.id)).toBe(1)

  const done = await read(doc.id)
  expect(done.filename).toBe(`${seo}.webp`)
  expect(done.sizes!.w480!.filename).toBe(`${seo}-480x336.webp`)
  expect(done.sizes!.w320!.filename).toBe(`${seo}-320x224.webp`)
  expect(done.sizes!.portrait!.filename).toBe(`${seo}-400x700.webp`)
  expect(done.seoFilename).toBe(seo)
  expect(done.seoRenamed).toBe(true)
  expect(done.watermark).toBe('applied')
  expect(done.status).toBe('approved')
  expect(new URL(done.url!).href).toBe(new URL(`${BASE}/${key(doc.prefix, `${seo}.webp`)}`).href)
  expect(done.sizes!.w480!.url).toContain(`${seo}-480x336.webp`)

  const newFiles = filesOf(done)
  expect(newFiles).toHaveLength(oldFiles.length)
  expect(await Promise.all(newFiles.map((f) => exists(doc.prefix, f)))).toEqual(newFiles.map(() => true))
  expect(await Promise.all(oldFiles.map((f) => exists(doc.prefix, f)))).toEqual(oldFiles.map(() => false))
  // Same bytes: nothing is re-encoded, so the mark is not stacked.
  expect(await bytes(doc.prefix, `${seo}.webp`)).toEqual(stampedBefore)
  expect(await bytes(doc.prefix, `${seo}-480x336.webp`)).toEqual(w480Before)

  const oldURLs = oldFiles.map((f) => new URL(`${BASE}/${key(doc.prefix, f)}`).href)
  const newURLs = newFiles.map((f) => new URL(`${BASE}/${key(doc.prefix, f)}`).href)
  expect([...new Set(purged)].sort()).toEqual([...oldURLs, ...newURLs].sort()) // old (deleted) and new (a 404 cached before the job)
})

it('approving through the English edit form still names the file from the SEO name', async () => {
  const seo = `seo-en-${run}`
  const doc = await create({ seoFilename: seo })
  await approve(doc.id, { title: 'Garden dog house' }, 'en')
  await runJobs(doc.id)
  expect((await read(doc.id)).filename).toBe(`${seo}.webp`)
})

it('a document created as approved gets renamed too', async () => {
  const seo = `seo-created-${run}`
  const doc = await create({ seoFilename: seo, status: 'approved' })
  expect(await runJobs(doc.id)).toBe(1)
  expect((await read(doc.id)).filename).toBe(`${seo}.webp`)
})

it('approving together with a new file renames the new file', async () => {
  const seo = `seo-both-${run}`
  const doc = await create({ seoFilename: seo })
  const file = path.join(DIR, `Baska Yukleme ${run}.png`)
  await sharp({ create: { width: 1000, height: 700, channels: 3, background: { r: 10, g: 10, b: 200 } } }).png().toFile(file)
  const updated = await payload.update({ collection: 'media', id: doc.id, data: { status: 'approved' }, filePath: file, context: { skipAi: true } })
  expect(updated.filename).not.toBe(doc.filename)
  await runJobs(doc.id)
  const done = await read(doc.id)
  expect(done.filename).toBe(`${seo}.webp`)
  expect((await sharp(await bytes(doc.prefix, done.filename!)).stats()).dominant.b).toBeGreaterThan(150)
})

it('a save that fails queues nothing, and update-many with one failing document leaves that document alone', async () => {
  const ok = await create({ seoFilename: `seo-many-ok-${run}` })
  const bad = await create({ seoFilename: `seo-many-bad-${run}`, alt: '' }) // approving needs a Turkish alt text
  await expect(approve(bad.id)).rejects.toThrow()
  expect(await openJobs(bad.id)).toHaveLength(0)

  const res = await payload.update({ collection: 'media', where: { id: { in: [ok.id, bad.id] } }, data: { status: 'approved' }, context: { skipAi: true } })
  expect(res.docs.map((d) => d.id)).toEqual([ok.id])
  expect(res.errors).toHaveLength(1)
  await runJobs(ok.id)
  await runJobs(bad.id)
  expect((await read(ok.id)).filename).toBe(`seo-many-ok-${run}.webp`)
  const stillBad = await read(bad.id)
  expect(stillBad.filename).toBe(bad.filename)
  expect(stillBad.status).toBe('pending')
  expect(await Promise.all(filesOf(bad).map((f) => exists(bad.prefix, f)))).toEqual(filesOf(bad).map(() => true))
})

it('a later approval, edit or seoFilename change renames nothing; re-running the job is a no-op', async () => {
  const seo = `seo-once-${run}`
  const doc = await create({ seoFilename: seo })
  await approve(doc.id)
  await runJobs(doc.id)
  const first = await read(doc.id)
  await payload.update({ collection: 'media', id: doc.id, data: { status: 'hidden' }, context: { skipAi: true } })
  await payload.update({ collection: 'media', id: doc.id, data: { title: 'Yeni başlık', seoFilename: `${seo}-yeni` }, context: { skipAi: true } })
  await approve(doc.id)
  expect(await openJobs(doc.id)).toHaveLength(0)
  const job = await payload.jobs.queue({ task: 'seoRename', input: { mediaId: String(doc.id) } })
  purged.length = 0
  await payload.jobs.runByID({ id: job.id })
  const again = await read(doc.id)
  expect(again.filename).toBe(first.filename)
  expect(filesOf(again)).toEqual(filesOf(first))
  expect(purged).toEqual([])
})

it('a name already used by another document gets -2', async () => {
  const seo = `seo-clash-${run}`
  const a = await create({ seoFilename: seo })
  const b = await create({ seoFilename: seo })
  await approve(a.id)
  await runJobs(a.id)
  await approve(b.id)
  await runJobs(b.id)
  expect((await read(a.id)).filename).toBe(`${seo}.webp`)
  const second = await read(b.id)
  expect(second.filename).toBe(`${seo}-2.webp`)
  expect(second.seoFilename).toBe(seo) // the gallery slug is not touched
  expect(second.sizes!.w320!.filename).toBe(`${seo}-2-320x224.webp`)
})

it('an object that already sits at the target key (another process, no document yet) is never overwritten', async () => {
  const seo = `seo-bucket-${run}`
  const doc = await create({ seoFilename: seo })
  const foreign = Buffer.from('somebody else')
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key(doc.prefix, `${seo}.webp`), Body: foreign }))
  await approve(doc.id)
  await runJobs(doc.id)
  expect((await read(doc.id)).filename).toBe(`${seo}-2.webp`)
  expect(await bytes(doc.prefix, `${seo}.webp`)).toEqual(foreign)
})

it('an empty seoFilename falls back to the Turkish title slug and fills seoFilename', async () => {
  const doc = await create({ seoFilename: '', title: `Çatı Katı Pergola ${run}` })
  await approve(doc.id)
  await runJobs(doc.id)
  const slug = `cati-kati-pergola-${run}`
  const done = await read(doc.id)
  expect(done.filename).toBe(`${slug}.webp`)
  expect(done.seoFilename).toBe(slug)
})

it('with neither seoFilename nor title the name is kefken-ahsap-<id>', async () => {
  const doc = await create({ seoFilename: '', title: '' })
  await approve(doc.id)
  await runJobs(doc.id)
  expect((await read(doc.id)).filename).toBe(`kefken-ahsap-${doc.id}.webp`)
})

it('a new file on a renamed document never reuses the old public name, and the new URLs are purged', async () => {
  const seo = `seo-replace-${run}`
  const doc = await create({ seoFilename: seo })
  await approve(doc.id)
  await runJobs(doc.id)
  const file = path.join(DIR, `Yeni Yukleme ${run}.png`)
  await sharp({ create: { width: 1000, height: 700, channels: 3, background: { r: 200, g: 20, b: 20 } } }).png().toFile(file)
  const replaced = await payload.update({ collection: 'media', id: doc.id, data: {}, filePath: file, context: { skipAi: true } })
  expect(replaced.filename).not.toBe(`${seo}.webp`)
  expect(replaced.seoRenamed).toBe(false)
  expect(replaced.seoRetiredStems).toEqual([seo])
  purged.length = 0
  expect(await runJobs(doc.id)).toBe(1)
  const done = await read(doc.id)
  expect(done.filename).toBe(`${seo}-2.webp`)
  expect((await sharp(await bytes(doc.prefix, done.filename!)).stats()).dominant.r).toBeGreaterThan(150)
  expect(purged).toContain(new URL(`${BASE}/${key(doc.prefix, `${seo}-2.webp`)}`).href) // the new URL
  // A second replacement retires -2 as well.
  await payload.update({ collection: 'media', id: doc.id, data: {}, filePath: file, context: { skipAi: true } })
  await runJobs(doc.id)
  expect((await read(doc.id)).filename).toBe(`${seo}-3.webp`)
})

it('an admin save that changes the file during the job is not overwritten', async () => {
  const seo = `seo-stale-${run}`
  const doc = await create({ seoFilename: seo })
  await approve(doc.id)
  const send = S3Client.prototype.send
  let raced = false
  vi.spyOn(S3Client.prototype, 'send').mockImplementation(async function (this: S3Client, command: unknown) {
    if (command instanceof CopyObjectCommand && !raced) {
      raced = true
      await payload.update({ collection: 'media', id: doc.id, data: { filename: `racing-${run}.webp` }, context: { skipAi: true, seoRenameJob: true } })
    }
    return (send as (c: unknown) => Promise<unknown>).call(this, command)
  } as never)
  const [job] = await openJobs(doc.id)
  await payload.jobs.runByID({ id: job!.id })
  vi.restoreAllMocks()

  const stored = await read(doc.id)
  expect(stored.filename).toBe(`racing-${run}.webp`)
  expect(stored.seoRenamed).toBe(false)
  expect(await exists(doc.prefix, `${seo}.webp`)).toBe(false) // our copies are gone
  expect(await exists(doc.prefix, doc.filename!)).toBe(true)
})

it('a seeded photo keeps its file names', async () => {
  const doc = await create({ seoFilename: `seo-seeded-${run}`, seedKey: `test/seeded-${run}` })
  await approve(doc.id)
  expect(await openJobs(doc.id)).toHaveLength(0)
  expect((await read(doc.id)).filename).toBe(doc.filename)
})

it('a copy failure leaves the document and the old objects unchanged and removes partial copies', async () => {
  const seo = `seo-fail-${run}`
  const doc = await create({ seoFilename: seo })
  const oldFiles = filesOf(doc)
  await approve(doc.id)
  const send = S3Client.prototype.send
  vi.spyOn(S3Client.prototype, 'send').mockImplementation(function (this: S3Client, command: unknown) {
    if (command instanceof CopyObjectCommand && String(command.input.Key).includes('-480x')) return Promise.reject(new Error('boom'))
    return (send as (c: unknown) => Promise<unknown>).call(this, command)
  } as never)
  const [job] = await openJobs(doc.id)
  await payload.jobs.runByID({ id: job!.id })
  vi.restoreAllMocks()

  const stored = await read(doc.id)
  expect(stored.filename).toBe(doc.filename)
  expect(stored.seoRenamed).toBe(false)
  expect(filesOf(stored)).toEqual(oldFiles)
  expect(await Promise.all(oldFiles.map((f) => exists(doc.prefix, f)))).toEqual(oldFiles.map(() => true))
  expect(await exists(doc.prefix, `${seo}.webp`)).toBe(false)
  expect(await exists(doc.prefix, `${seo}-320x224.webp`)).toBe(false)
})

it('a forced job renames a hidden photo (the one-off script)', async () => {
  const seo = `seo-force-${run}`
  const doc = await create({ seoFilename: seo, status: 'hidden' })
  expect(await openJobs(doc.id)).toHaveLength(0)
  const job = await payload.jobs.queue({ task: 'seoRename', input: { mediaId: String(doc.id), force: true } })
  await payload.jobs.runByID({ id: job.id })
  const done = await read(doc.id)
  expect(done.filename).toBe(`${seo}.webp`)
  expect(done.status).toBe('hidden')
})
