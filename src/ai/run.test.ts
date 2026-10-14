import { describe, expect, it } from 'vitest'
import { MockLanguageModelV4 } from 'ai/test'
import { APICallError } from 'ai'
import { Result } from 'tsentials/result'
import { z } from 'zod'

import { runStructured } from './run'

const usage = {
  inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 20, text: 20, reasoning: 0 },
}
const reply = (text: string, cost?: number) =>
  new MockLanguageModelV4({
    doGenerate: {
      content: [{ type: 'text', text }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage,
      warnings: [],
      ...(cost !== undefined ? { providerMetadata: { openrouter: { usage: { cost } } } } : {}),
    } as never,
  })
const failing = (status: number) =>
  new MockLanguageModelV4({
    doGenerate: async () => {
      throw new APICallError({ message: `HTTP ${status}`, url: 'x', requestBodyValues: {}, statusCode: status, isRetryable: false })
    },
  })

const schema = z.object({ title: z.string().min(1) })
const base = { schema, system: 's', prompt: 'p', maxRetries: 0 }

describe('runStructured', () => {
  it('returns the first model that produces schema-valid output, with model id and cost', async () => {
    const models: Record<string, MockLanguageModelV4> = { a: reply('{"nope":1}'), b: reply('{"title":"Iroko deck"}', 0.004) }
    const r = await runStructured({ ...base, chain: ['a', 'b'], getModel: (id) => models[id]! })
    expect(Result.isSuccess(r)).toBe(true)
    if (Result.isSuccess(r)) {
      expect(r.value.output).toEqual({ title: 'Iroko deck' })
      expect(r.value.model).toBe('b')
      expect(r.value.costUsd).toBe(0.004)
      expect(r.value.attempts.map((a) => a.model)).toEqual(['a', 'b'])
    }
  })

  it('falls through provider errors (e.g. 500) to the next model', async () => {
    const models: Record<string, MockLanguageModelV4> = { a: failing(500), b: reply('{"title":"ok"}') }
    const r = await runStructured({ ...base, chain: ['a', 'b'], getModel: (id) => models[id]! })
    expect(Result.isSuccess(r) && r.value.model).toBe('b')
  })

  it('stops the chain on 402 (no credit) instead of burning the next model', async () => {
    const b = reply('{"title":"ok"}')
    const models: Record<string, MockLanguageModelV4> = { a: failing(402), b }
    const r = await runStructured({ ...base, chain: ['a', 'b'], getModel: (id) => models[id]! })
    expect(Result.isFailure(r) && r.errors[0]?.code).toBe('AI.PaymentRequired')
    expect(b.doGenerateCalls).toHaveLength(0)
  })

  it('fails with AI.AllModelsFailed when every model fails', async () => {
    const models: Record<string, MockLanguageModelV4> = { a: reply('x'), b: failing(500) }
    const r = await runStructured({ ...base, chain: ['a', 'b'], getModel: (id) => models[id]! })
    expect(Result.isFailure(r) && r.errors[0]?.code).toBe('AI.AllModelsFailed')
  })

  it('fails fast on an empty chain', async () => {
    const r = await runStructured({ ...base, chain: [], getModel: () => reply('{}') })
    expect(Result.isFailure(r) && r.errors[0]?.code).toBe('AI.NoModels')
  })
})
