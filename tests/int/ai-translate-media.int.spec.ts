// #203: a TR title/alt/caption edit re-translates the other locales (translateMedia job, fake model), keeps a
// hand-edited locale and flags it stale; the explicit button overwrites; the job's own writes never queue another job.
import { mkdirSync } from 'fs'
import os from 'os'
import path from 'path'
import { createLocalReq, getPayload, type Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FAKE_TAG_IMAGE, fakeHooks } from '@/ai/fake'
import { syncMediaLocales } from '@/ai/translate/media'
import { releaseStuckMediaJobs, STUCK_AFTER_MS } from '@/jobs/releaseStuck'
import type { I18nSync } from '@/lib/media/i18nSync'
import { createFakeDateTimeProvider } from 'tsentials/time'

let payload: Payload
const IMG = path.join(os.tmpdir(), 'kefken-ai', 'translate-media.webp')
const created: { collection: 'media' | 'ai-usage'; id: number | string }[] = []
const OTHERS = ['en', 'ru', 'de', 'ar'] as const

beforeAll(async () => {
  mkdirSync(path.dirname(IMG), { recursive: true })
  await sharp({ create: { width: 640, height: 480, channels: 3, background: { r: 150, g: 110, b: 60 } } }).webp().toFile(IMG)
  const { default: config } = await import('@/payload.config')
  payload = await getPayload({ config: await config })
  await payload.updateGlobal({ slug: 'aiSettings', data: { monthlyBudgetUsd: 1000, tagImage: [], translate: [], enabled: true } })
})
afterAll(async () => {
  for (const c of created.reverse()) await payload.delete({ collection: c.collection, id: c.id }).catch(() => {})
  await payload.updateGlobal({ slug: 'aiSettings', data: { monthlyBudgetUsd: 10, tagImage: [], translate: [] } })
})

/** A photo whose every locale was written by tagImage (so each has AI provenance). */
async function aiPhoto() {
  const m = await payload.create({ collection: 'media', data: {}, filePath: IMG })
  created.push({ collection: 'media', id: m.id })
  const job = await payload.jobs.queue({ task: 'tagImage', input: { mediaId: String(m.id) } })
  await payload.jobs.runByID({ id: job.id })
  return m.id
}

/** Unfinished translateMedia jobs for one photo. */
async function openJobs(id: number) {
  const { docs } = await payload.find({ collection: 'payload-jobs', where: { taskSlug: { equals: 'translateMedia' } }, sort: '-createdAt', limit: 200, depth: 0 })
  return docs.filter((j) => !j.completedAt && (j.input as { mediaId?: string }).mediaId === String(id))
}

async function runQueued(id: number) {
  const jobs = await openJobs(id)
  expect(jobs).toHaveLength(1)
  await payload.jobs.runByID({ id: jobs[0]!.id })
}

const read = (id: number, locale: 'tr' | (typeof OTHERS)[number]) => payload.findByID({ collection: 'media', id, locale, fallbackLocale: false, depth: 0 })
const usage = async (id: number) => {
  const r = await payload.find({ collection: 'ai-usage', where: { docRef: { equals: `media:${id}` }, task: { equals: 'translate' } }, depth: 0 })
  r.docs.forEach((d) => created.push({ collection: 'ai-usage', id: d.id }))
  return r.totalDocs
}
describe('translateMedia (#203)', () => {
  it('tagImage records AI provenance for every non-TR locale it fills', async () => {
    const id = await aiPhoto()
    const sync = (await read(id, 'tr')).i18nSync as I18nSync
    expect(Object.keys(sync.prov ?? {}).sort()).toEqual([...OTHERS].sort())
    expect(Object.keys(sync.prov!.de!).sort()).toEqual(['alt', 'caption', 'title'])
  })

  it('a TR alt edit queues the job, which rewrites only alt in every other locale', async () => {
    const id = await aiPhoto()
    await payload.update({ collection: 'media', id, locale: 'tr', data: { alt: 'Bahçede yeni iroko deck' } })
    expect(((await read(id, 'tr')).i18nSync as I18nSync).pending).toEqual(['alt'])
    await runQueued(id)

    for (const l of OTHERS) {
      const doc = await read(id, l)
      expect(doc.alt).toBe(`[${l.toUpperCase()}] Bahçede yeni iroko deck`)
      expect(doc.title).toBe(FAKE_TAG_IMAGE.title[l])
    }
    const sync = (await read(id, 'tr')).i18nSync as I18nSync
    expect(sync.pending).toBeUndefined()
    expect(sync.stale).toBeUndefined()
    expect(await usage(id)).toBe(1)
    // The job's own writes queued nothing.
    expect(await openJobs(id)).toHaveLength(0)
  })

  it('keeps a hand-edited DE text and marks DE stale; the explicit button then overwrites it', async () => {
    const id = await aiPhoto()
    await payload.update({ collection: 'media', id, locale: 'de', data: { alt: 'Von Hand geschriebener Alt-Text' } })
    // An edit outside TR queues nothing.
    expect(await openJobs(id)).toHaveLength(0)
    await payload.update({ collection: 'media', id, locale: 'tr', data: { alt: 'Havuz kenarında teak deck' } })
    await runQueued(id)

    expect((await read(id, 'de')).alt).toBe('Von Hand geschriebener Alt-Text')
    expect((await read(id, 'en')).alt).toBe('[EN] Havuz kenarında teak deck')
    expect(((await read(id, 'tr')).i18nSync as I18nSync).stale).toEqual({ de: 'edited' })

    const r = await syncMediaLocales({ payload, req: await createLocalReq({}, payload), id, force: true })
    expect(r.ok).toBe(true)
    const de = await read(id, 'de')
    expect(de.alt).toBe('[DE] Havuz kenarında teak deck')
    expect(de.title).toBe(`[DE] ${FAKE_TAG_IMAGE.title.tr}`)
    expect(((await read(id, 'tr')).i18nSync as I18nSync).stale).toBeUndefined()
    expect(await openJobs(id)).toHaveLength(0)
  })

  it('a person fixing the stale locale takes it off the stale list', async () => {
    const id = await aiPhoto()
    await payload.update({ collection: 'media', id, locale: 'de', data: { alt: 'Von Hand' } })
    await payload.update({ collection: 'media', id, locale: 'tr', data: { alt: 'Çam pergola' } })
    await runQueued(id)
    expect(((await read(id, 'tr')).i18nSync as I18nSync).stale).toEqual({ de: 'edited' })
    await payload.update({ collection: 'media', id, locale: 'de', data: { alt: 'Kiefernpergola' } })
    expect(((await read(id, 'tr')).i18nSync as I18nSync).stale).toEqual({})
  })

  it('stops before the model call when the monthly budget is used up and marks the locales not translated', async () => {
    const id = await aiPhoto()
    await payload.updateGlobal({ slug: 'aiSettings', data: { monthlyBudgetUsd: 0 } })
    try {
      await payload.update({ collection: 'media', id, locale: 'tr', data: { alt: 'Bütçe bitince çevrilmez' } })
      await runQueued(id)
    } finally {
      await payload.updateGlobal({ slug: 'aiSettings', data: { monthlyBudgetUsd: 1000 } })
    }
    expect(await usage(id)).toBe(0)
    expect((await read(id, 'en')).alt).toBe(FAKE_TAG_IMAGE.alt.en)
    const sync = (await read(id, 'tr')).i18nSync as I18nSync
    expect(sync.pending).toBeUndefined()
    expect(sync.stale).toEqual({ en: 'failed', ru: 'failed', de: 'failed', ar: 'failed' })
  })

  it('a save during the model call wins: the hand-edited locale is kept and stale, a TR edit made meanwhile stays pending', async () => {
    const id = await aiPhoto()
    await payload.update({ collection: 'media', id, locale: 'tr', data: { alt: 'Teak iskele' } })
    fakeHooks.beforeAnswer = async () => {
      fakeHooks.beforeAnswer = undefined
      await payload.update({ collection: 'media', id, locale: 'de', data: { alt: 'Steg aus Teak, von Hand' } })
      await payload.update({ collection: 'media', id, locale: 'tr', data: { title: 'Yeni başlık' } })
    }
    try {
      const jobs = await openJobs(id)
      // The TR title edit inside the hook queued a second job; run the first one.
      await payload.jobs.runByID({ id: jobs.at(-1)!.id })
    } finally {
      fakeHooks.beforeAnswer = undefined
    }
    expect((await read(id, 'de')).alt).toBe('Steg aus Teak, von Hand')
    expect((await read(id, 'en')).alt).toBe('[EN] Teak iskele')
    const sync = (await read(id, 'tr')).i18nSync as I18nSync
    expect(sync.stale).toEqual({ de: 'edited' })
    expect(sync.pending).toEqual(['title'])
    // The run the title edit queued is still there and translates it.
    await runQueued(id)
    expect((await read(id, 'en')).title).toBe('[EN] Yeni başlık')
    expect(((await read(id, 'tr')).i18nSync as I18nSync).pending).toBeUndefined()
  })

  it('a photo job left "processing" by a dead process is released at startup after 15 minutes', async () => {
    const job = await payload.jobs.queue({ task: 'translateMedia', input: { mediaId: '987654320' } })
    await payload.update({ collection: 'payload-jobs', id: job.id, data: { processing: true } })
    const soon = createFakeDateTimeProvider(new Date(Date.now() + STUCK_AFTER_MS - 60_000))
    const later = createFakeDateTimeProvider(new Date(Date.now() + STUCK_AFTER_MS + 60_000))
    expect(await releaseStuckMediaJobs(payload, soon)).toBe(0)
    expect(await releaseStuckMediaJobs(payload, later)).toBeGreaterThanOrEqual(1)
    expect((await payload.findByID({ collection: 'payload-jobs', id: job.id, depth: 0 })).processing).toBe(false)
    await payload.delete({ collection: 'payload-jobs', id: job.id })
  })

  it('a client cannot overwrite the record (the edit form resubmits the hidden field)', async () => {
    const id = await aiPhoto()
    const before = (await read(id, 'tr')).i18nSync
    await payload.update({ collection: 'media', id, locale: 'tr', data: { i18nSync: { stale: { en: 'edited' } } } })
    expect((await read(id, 'tr')).i18nSync).toEqual(before)
  })
})
