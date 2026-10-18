// #28 tagImage job against a mock model (no network to OpenRouter in tests).
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { mkdirSync } from 'fs'
import os from 'os'
import path from 'path'
import { createLocalReq, getPayload, type Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { FAKE_TAG_IMAGE, fakeHooks } from '@/ai/fake'
import { retryTagImage } from '@/ai/tagMedia'
import { aiTagMediaEndpoint } from '@/endpoints/ai'
import { mediaBadge } from '@/lib/media/galeri'

// Model calls go to the deterministic fake (AI_FAKE_PROVIDER=1, set in vitest.setup.ts).
const SUGGESTION = FAKE_TAG_IMAGE

let payload: Payload
const IMG = path.join(os.tmpdir(), 'kefken-ai', 'deck.webp')
const created: { collection: 'media' | 'ai-usage'; id: number | string }[] = []

beforeAll(async () => {
  mkdirSync(path.dirname(IMG), { recursive: true })
  await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 170, g: 120, b: 70 } } }).webp().toFile(IMG)
  const { default: config } = await import('@/payload.config')
  payload = await getPayload({ config: await config })
  await payload.updateGlobal({ slug: 'aiSettings', data: { monthlyBudgetUsd: 1000, tagImage: [] } })
  // #203: TR edits in other int files leave translateMedia jobs on the default queue; a bare run() (limit 10, oldest
  // first) could fill up on them before reaching this file's tagImage job.
  await payload.delete({ collection: 'payload-jobs', where: { taskSlug: { in: ['translateMedia', 'seoRename'] }, completedAt: { exists: false } } })
})
afterAll(async () => {
  for (const c of created.reverse()) await payload.delete({ collection: c.collection, id: c.id }).catch(() => {})
  await payload.updateGlobal({ slug: 'aiSettings', data: { monthlyBudgetUsd: 10, tagImage: [] } })
})

describe('tagImage job', () => {
  // Flake in PR #191's CI: the every-minute autoRun cron ran inside this process too. When a tick landed between a
  // test's queue() and run(), the cron took the job, run() found nothing and returned, and the assertion read the photo
  // before the cron's run had written it. Tests run the queue themselves only.
  it('the autoRun cron never runs jobs under test', async () => {
    expect(await payload.config.jobs.shouldAutoRun?.(payload)).toBe(false)
  })

  it('fills empty TR/EN fields, records the suggestion and cost, keeps the image pending', async () => {
    const m = await payload.create({ collection: 'media', data: {}, filePath: IMG })
    created.push({ collection: 'media', id: m.id })
    await payload.jobs.queue({ task: 'tagImage', input: { mediaId: String(m.id) } })
    await payload.jobs.run()

    const tr = await payload.findByID({ collection: 'media', id: m.id, locale: 'tr' })
    const en = await payload.findByID({ collection: 'media', id: m.id, locale: 'en' })
    expect(tr.status).toBe('pending')
    expect(tr.alt).toBe(SUGGESTION.alt.tr)
    expect(tr.title).toBe(SUGGESTION.title.tr)
    expect(tr.seoFilename).toBe('havuz-kenari-ahsap-deck')
    expect(en.alt).toBe(SUGGESTION.alt.en)
    expect((tr.aiSuggestion as { model: string; promptVersion: string }).model).toBe('google/gemini-3.8-flash')
    const usage = await payload.find({ collection: 'ai-usage', where: { docRef: { equals: `media:${m.id}` } } })
    usage.docs.forEach((d) => created.push({ collection: 'ai-usage', id: d.id }))
    expect(usage.docs[0]?.costUsd).toBeCloseTo(0.0042)
  })

  it('never overwrites text a person already wrote', async () => {
    const m = await payload.create({ collection: 'media', locale: 'tr', data: { alt: 'Elle yazılmış alt metin' }, filePath: IMG })
    created.push({ collection: 'media', id: m.id })
    await payload.jobs.queue({ task: 'tagImage', input: { mediaId: String(m.id) } })
    await payload.jobs.run()
    const tr = await payload.findByID({ collection: 'media', id: m.id, locale: 'tr' })
    expect(tr.alt).toBe('Elle yazılmış alt metin')
    expect(tr.title).toBe(SUGGESTION.title.tr)
  })

  it('a retried job does not call the model again', async () => {
    const m = await payload.create({ collection: 'media', data: {}, filePath: IMG })
    created.push({ collection: 'media', id: m.id })
    await payload.jobs.queue({ task: 'tagImage', input: { mediaId: String(m.id) } })
    await payload.jobs.run()
    await payload.jobs.queue({ task: 'tagImage', input: { mediaId: String(m.id) } })
    await payload.jobs.run()
    const usage = await payload.find({ collection: 'ai-usage', where: { docRef: { equals: `media:${m.id}` } } })
    usage.docs.forEach((d) => created.push({ collection: 'ai-usage', id: d.id }))
    expect(usage.totalDocs).toBe(1)
  })

  it('stops when the monthly budget is used up', async () => {
    await payload.updateGlobal({ slug: 'aiSettings', data: { monthlyBudgetUsd: 0 } })
    const m = await payload.create({ collection: 'media', data: {}, filePath: IMG })
    created.push({ collection: 'media', id: m.id })
    await payload.jobs.queue({ task: 'tagImage', input: { mediaId: String(m.id) } })
    await payload.jobs.run()
    const tr = await payload.findByID({ collection: 'media', id: m.id, locale: 'tr' })
    expect(tr.alt ?? null).toBeNull()
    // #216: refused for the budget is a visible state, not silence.
    expect((tr.aiFailure as { code: string }).code).toBe('AI.BudgetExceeded')
    await payload.updateGlobal({ slug: 'aiSettings', data: { monthlyBudgetUsd: 1000 } })
  })

  it('#171: offers the existing product types and keeps only the ones from that list', async () => {
    // The fake model answers with the first offered type plus an invented one (src/ai/fake.ts).
    const name = `E2E Tür ${Date.now()}`
    const tag = await payload.create({ collection: 'tags', locale: 'tr', data: { name, axis: 'type' } })
    try {
      const m = await payload.create({ collection: 'media', data: {}, filePath: IMG })
      created.push({ collection: 'media', id: m.id })
      await payload.jobs.queue({ task: 'tagImage', input: { mediaId: String(m.id) } })
      await payload.jobs.run()
      const tr = await payload.findByID({ collection: 'media', id: m.id, locale: 'tr' })
      const s = tr.aiSuggestion as { promptVersion: string; tags: { type: string[] } }
      expect(s.promptVersion).toBe('tagImage@4')
      expect(s.tags.type).toHaveLength(1)
      expect(s.tags.type[0]).not.toBe('Uydurma tür')
      const usage = await payload.find({ collection: 'ai-usage', where: { docRef: { equals: `media:${m.id}` } } })
      usage.docs.forEach((d) => created.push({ collection: 'ai-usage', id: d.id }))
    } finally {
      await payload.delete({ collection: 'tags', id: tag.id })
    }
  })

  it('#192: fills every locale from one call and keeps text a person wrote in any of them', async () => {
    const m = await payload.create({ collection: 'media', locale: 'tr', data: {}, filePath: IMG })
    created.push({ collection: 'media', id: m.id })
    await payload.update({ collection: 'media', id: m.id, locale: 'de', data: { alt: 'Von Hand geschriebener Alt-Text' }, context: { skipAi: true } })
    await payload.jobs.queue({ task: 'tagImage', input: { mediaId: String(m.id) } })
    await payload.jobs.run()
    const read = (locale: 'ru' | 'de' | 'ar') => payload.findByID({ collection: 'media', id: m.id, locale, fallbackLocale: false, depth: 0 })
    const [ru, de, ar] = await Promise.all([read('ru'), read('de'), read('ar')])
    expect([ru.title, ru.alt, ru.caption]).toEqual([SUGGESTION.title.ru, SUGGESTION.alt.ru, SUGGESTION.caption.ru])
    expect(ar.alt).toBe(SUGGESTION.alt.ar)
    expect(de.alt).toBe('Von Hand geschriebener Alt-Text')
    expect(de.title).toBe(SUGGESTION.title.de)
    const usage = await payload.find({ collection: 'ai-usage', where: { docRef: { equals: `media:${m.id}` } } })
    usage.docs.forEach((d) => created.push({ collection: 'ai-usage', id: d.id }))
    expect(usage.totalDocs).toBe(1)
  })

  it('#192: a locale write that fails midway leaves the job unfinished; the retry fills the rest', async () => {
    const m = await payload.create({ collection: 'media', data: {}, filePath: IMG })
    created.push({ collection: 'media', id: m.id })
    const update = payload.update.bind(payload)
    const spy = vi.spyOn(payload, 'update').mockImplementation(((args: { locale?: string }) => {
      if (args.locale === 'de') throw new Error('simulated DE write failure')
      return update(args as never)
    }) as never)
    // One job, run by id both times: its retry is what fills the rest. A second job for the same photo would run in
    // parallel with the retry, and Payload writes every locale of the doc it read on each update, so one job's later
    // write could put back the empty DE the other had just filled (the flake in CI after #194).
    const job = await payload.jobs.queue({ task: 'tagImage', input: { mediaId: String(m.id) } })
    try {
      await payload.jobs.runByID({ id: job.id })
    } finally {
      spy.mockRestore()
    }
    const half = await payload.findByID({ collection: 'media', id: m.id, locale: 'de', fallbackLocale: false, depth: 0 })
    expect(half.alt ?? null).toBeNull()
    expect(half.aiSuggestion ?? null).toBeNull()

    const { jobStatus } = await payload.jobs.runByID({ id: job.id })
    expect(jobStatus?.[String(job.id)]?.status).toBe('success')
    const de = await payload.findByID({ collection: 'media', id: m.id, locale: 'de', fallbackLocale: false, depth: 0 })
    expect(de.alt).toBe(SUGGESTION.alt.de)
    expect((de.aiSuggestion as { promptVersion: string }).promptVersion).toBe('tagImage@4')
    const usage = await payload.find({ collection: 'ai-usage', where: { docRef: { equals: `media:${m.id}` } } })
    usage.docs.forEach((d) => created.push({ collection: 'ai-usage', id: d.id }))
  })

  it('#192: a photo deleted before its job runs is skipped, not a failed job', async () => {
    const job = await payload.jobs.queue({ task: 'tagImage', input: { mediaId: '987654321' } })
    const { jobStatus } = await payload.jobs.run()
    expect(jobStatus?.[String(job.id)]?.status).toBe('success')
  })

  it('#57: a model changed in AI Ayarları is used by the next job', async () => {
    const envChain = process.env.AI_TAGIMAGE_MODELS
    delete process.env.AI_TAGIMAGE_MODELS // env beats settings; this test is about the admin setting
    try {
      await payload.updateGlobal({ slug: 'aiSettings', data: { tagImage: ['test/changed-model'] } })
      const m = await payload.create({ collection: 'media', data: {}, filePath: IMG })
      created.push({ collection: 'media', id: m.id })
      await payload.jobs.queue({ task: 'tagImage', input: { mediaId: String(m.id) } })
      await payload.jobs.run()
      const tr = await payload.findByID({ collection: 'media', id: m.id, locale: 'tr' })
      expect((tr.aiSuggestion as { model: string }).model).toBe('test/changed-model')
      const usage = await payload.find({ collection: 'ai-usage', where: { docRef: { equals: `media:${m.id}` } } })
      usage.docs.forEach((d) => created.push({ collection: 'ai-usage', id: d.id }))
      expect(usage.docs.map((d) => d.model)).toEqual(['test/changed-model'])
    } finally {
      if (envChain !== undefined) process.env.AI_TAGIMAGE_MODELS = envChain
      await payload.updateGlobal({ slug: 'aiSettings', data: { tagImage: [] } })
    }
  })
  describe('#216: storage read and visible failures', () => {
    const queueAndRun = async (id: number | string) => {
      await payload.jobs.queue({ task: 'tagImage', input: { mediaId: String(id) } })
      await payload.jobs.run()
      return payload.findByID({ collection: 'media', id, locale: 'tr' })
    }
    const NOW = Date.now()

    it('reads the image from storage: a CDN that answers 404 for its URL changes nothing', async () => {
      const m = await payload.create({ collection: 'media', data: {}, filePath: IMG })
      created.push({ collection: 'media', id: m.id })
      // Every http(s) request answers 404, as a CDN with a cached 404 for the reused key would.
      const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('not found', { status: 404 }))
      try {
        const tr = await queueAndRun(m.id)
        expect((tr.aiSuggestion as { at?: string }).at).toBeTruthy()
        expect(tr.aiFailure ?? null).toBeNull()
        expect(spy).not.toHaveBeenCalled()
      } finally {
        spy.mockRestore()
      }
      const usage = await payload.find({ collection: 'ai-usage', where: { docRef: { equals: `media:${m.id}` } } })
      usage.docs.forEach((d) => created.push({ collection: 'ai-usage', id: d.id }))
    })

    it('a storage read failure leaves a failed state the Galeri card shows; no model call, no cost row', async () => {
      const m = await payload.create({ collection: 'media', data: {}, filePath: IMG })
      created.push({ collection: 'media', id: m.id })
      const send = S3Client.prototype.send
      const spy = vi.spyOn(S3Client.prototype, 'send').mockImplementation(function (this: S3Client, command: unknown) {
        if (command instanceof GetObjectCommand) return Promise.reject(Object.assign(new Error('boom'), { name: 'NoSuchKey' }))
        return (send as (c: unknown) => Promise<unknown>).call(this, command) as never
      } as never)
      let tr
      try {
        tr = await queueAndRun(m.id)
      } finally {
        spy.mockRestore()
      }
      expect(tr.aiSuggestion ?? null).toBeNull()
      expect((tr.aiFailure as { code: string; at: string }).code).toBe('Media.StorageReadFailed')
      expect(mediaBadge(tr, NOW, true).label).toBe('AI önerisi alınamadı')
      const usage = await payload.find({ collection: 'ai-usage', where: { docRef: { equals: `media:${m.id}` } } })
      expect(usage.totalDocs).toBe(0)
    })

    it('a model failure is visible too, and still has its ai-usage row', async () => {
      const m = await payload.create({ collection: 'media', data: {}, filePath: IMG })
      created.push({ collection: 'media', id: m.id })
      fakeHooks.beforeAnswer = () => Promise.reject(new Error('provider down'))
      let tr
      try {
        tr = await queueAndRun(m.id)
      } finally {
        delete fakeHooks.beforeAnswer
      }
      expect((tr.aiFailure as { code: string }).code).toBeTruthy()
      expect(mediaBadge(tr, NOW, true).label).toBe('AI önerisi alınamadı')
      const usage = await payload.find({ collection: 'ai-usage', where: { docRef: { equals: `media:${m.id}` } } })
      usage.docs.forEach((d) => created.push({ collection: 'ai-usage', id: d.id }))
      expect(usage.docs.map((d) => d.ok)).toEqual([false])
    })

    const failed = async () => {
      const m = await payload.create({ collection: 'media', data: {}, filePath: IMG })
      created.push({ collection: 'media', id: m.id })
      await payload.update({ collection: 'media', id: m.id, locale: 'tr', context: { skipAi: true }, data: { aiFailure: { code: 'Media.StorageReadFailed', at: new Date().toISOString() } } })
      return m
    }
    const retry = async (id: number, over: { aiEnabled?: boolean } = {}) =>
      retryTagImage({ payload, req: await createLocalReq({}, payload), id, aiEnabled: over.aiEnabled ?? true, nowMs: Date.now() })
    const jobsFor = async (id: number) =>
      (await payload.find({ collection: 'payload-jobs', where: { taskSlug: { equals: 'tagImage' }, completedAt: { exists: false } }, limit: 500, depth: 0 })).docs.filter((j) => (j.input as { mediaId?: string }).mediaId === String(id))

    it('retry clears the failed state, queues the job, and the next run fills the photo', async () => {
      const m = await failed()
      const r = await retry(m.id)
      expect(r.ok && r.value).toEqual({ queued: true })
      const cleared = await payload.findByID({ collection: 'media', id: m.id, locale: 'tr' })
      expect(cleared.aiFailure ?? null).toBeNull()
      await payload.jobs.run()
      const tr = await payload.findByID({ collection: 'media', id: m.id, locale: 'tr' })
      expect((tr.aiSuggestion as { at?: string }).at).toBeTruthy()
      const usage = await payload.find({ collection: 'ai-usage', where: { docRef: { equals: `media:${m.id}` } } })
      usage.docs.forEach((d) => created.push({ collection: 'ai-usage', id: d.id }))
    })

    it('retry is refused unless the card shows the failed state: fresh, suggested, approved, hidden; nothing is queued or paid', async () => {
      const fresh = await payload.create({ collection: 'media', data: {}, filePath: IMG })
      const done = await payload.create({ collection: 'media', data: {}, filePath: IMG })
      const approved = await payload.create({ collection: 'media', data: { status: 'approved', alt: 'x', title: 'x' }, filePath: IMG, context: { skipAi: true } })
      const hidden = await failed()
      await payload.update({ collection: 'media', id: hidden.id, data: { status: 'hidden' }, context: { skipAi: true } })
      for (const m of [fresh, done, approved]) created.push({ collection: 'media', id: m.id })
      await queueAndRun(done.id)
      const before = (await payload.find({ collection: 'ai-usage', where: { docRef: { in: [fresh, done, approved, hidden].map((m) => `media:${m.id}`) } } })).totalDocs
      for (const m of [fresh, done, approved, hidden]) {
        const r = await retry(m.id)
        expect([m.id, !r.ok && r.errors[0]?.code]).toEqual([m.id, 'AI.RetryNotNeeded'])
        expect(await jobsFor(m.id)).toEqual([])
      }
      const after = await payload.find({ collection: 'ai-usage', where: { docRef: { in: [fresh, done, approved, hidden].map((m) => `media:${m.id}`) } } })
      expect(after.totalDocs).toBe(before)
      after.docs.forEach((d) => created.push({ collection: 'ai-usage', id: d.id }))
    })

    it('retry with AI off is refused; an unknown photo is NotFound', async () => {
      const m = await failed()
      const off = await retry(m.id, { aiEnabled: false })
      expect(!off.ok && off.errors[0]?.code).toBe('AI.Disabled')
      expect(await jobsFor(m.id)).toEqual([])
      const missing = await retry(987654321)
      expect(!missing.ok && missing.errors[0]?.code).toBe('Media.NotFound')
    })

    it('a tagImage job never fills an approved or hidden photo', async () => {
      const m = await payload.create({ collection: 'media', data: { status: 'approved', title: 'x', alt: 'x' }, filePath: IMG, context: { skipAi: true } })
      created.push({ collection: 'media', id: m.id })
      const job = await payload.jobs.queue({ task: 'tagImage', input: { mediaId: String(m.id) } })
      const { jobStatus } = await payload.jobs.run()
      expect(jobStatus?.[String(job.id)]?.status).toBe('success')
      const tr = await payload.findByID({ collection: 'media', id: m.id, locale: 'tr' })
      expect(tr.aiSuggestion ?? null).toBeNull()
    })

    it('POST /api/ai/tag-media: 401 without staff, 403 when AI is off, 200 queues for a failed photo', async () => {
      const post = async (user: unknown, id: number) => {
        const req = Object.assign(await createLocalReq({ user: user as never }, payload), { method: 'POST', body: {}, headers: new Headers({ 'content-type': 'application/json' }), text: async () => JSON.stringify({ id }) })
        return aiTagMediaEndpoint.handler(req as never)
      }
      const m = await failed()
      expect((await post(null, m.id)).status).toBe(401)
      const email = `tag-${Date.now()}@local.test`
      const user = await payload.create({ collection: 'users', data: { email, password: `pw-${Date.now()}`, name: 'Tag', role: 'admin' } })
      try {
        await payload.updateGlobal({ slug: 'aiSettings', data: { enabled: false } })
        const off = await post({ ...user, collection: 'users' }, m.id)
        expect([off.status, (await off.json()).code]).toEqual([403, 'AI.Disabled'])
        await payload.updateGlobal({ slug: 'aiSettings', data: { enabled: true } })
        const ok = await post({ ...user, collection: 'users' }, m.id)
        expect([ok.status, await ok.json()]).toEqual([200, { queued: true }])
        expect(await jobsFor(m.id)).toHaveLength(1)
      } finally {
        await payload.updateGlobal({ slug: 'aiSettings', data: { enabled: true } })
        await payload.delete({ collection: 'users', id: user.id }).catch(() => {})
      }
    })
  })
})
