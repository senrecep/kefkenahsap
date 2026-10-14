// #28 tagImage job against a mock model (no network to OpenRouter in tests).
import { mkdirSync } from 'fs'
import os from 'os'
import path from 'path'
import { getPayload, type Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FAKE_TAG_IMAGE } from '@/ai/fake'

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
})
afterAll(async () => {
  for (const c of created.reverse()) await payload.delete({ collection: c.collection, id: c.id }).catch(() => {})
  await payload.updateGlobal({ slug: 'aiSettings', data: { monthlyBudgetUsd: 10, tagImage: [] } })
})

describe('tagImage job', () => {
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
    await payload.updateGlobal({ slug: 'aiSettings', data: { monthlyBudgetUsd: 1000 } })
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
})
