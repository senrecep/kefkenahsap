// #28 tagImage job against a mock model (no network to OpenRouter in tests).
import { mkdirSync } from 'fs'
import os from 'os'
import path from 'path'
import { getPayload, type Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const SUGGESTION = {
  title: { tr: 'Havuz kenarı ahşap deck', en: 'Poolside timber deck' },
  alt: { tr: 'Havuz kenarında açık renkli ahşap deck zemin', en: 'Light timber decking beside a pool' },
  caption: { tr: 'Bahçe havuzu çevresine döşenen deck.', en: 'Decking laid around a garden pool.' },
  seoFilename: 'havuz-kenari-ahsap-deck',
  tags: { wood: [], setting: ['havuz kenarı'], finish: ['doğal'], stage: ['finished'] },
  categoryAgrees: true,
  confidence: 0.9,
}

vi.mock('@/ai/models', async (orig) => {
  const real = await orig<typeof import('@/ai/models')>()
  const { MockLanguageModelV4 } = await import('ai/test')
  return {
    ...real,
    openRouterModel: (id: string) =>
      new MockLanguageModelV4({
        modelId: id,
        doGenerate: {
          content: [{ type: 'text', text: JSON.stringify(SUGGESTION) }],
          finishReason: { unified: 'stop', raw: 'stop' },
          usage: { inputTokens: { total: 1000, noCache: 1000, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 200, text: 200, reasoning: 0 } },
          warnings: [],
          providerMetadata: { openrouter: { usage: { cost: 0.0042 } } },
        } as never,
      }),
  }
})

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
  await payload.updateGlobal({ slug: 'aiSettings', data: { monthlyBudgetUsd: 10 } })
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
})
