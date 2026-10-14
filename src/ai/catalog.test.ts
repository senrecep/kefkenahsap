import { describe, expect, it } from 'vitest'
import { Err } from 'tsentials/errors'
import { Result } from 'tsentials/result'
import { createFakeDateTimeProvider } from 'tsentials/time'

import { createModelCatalog } from './catalog'

const HOUR = 60 * 60 * 1000
const body = { data: [{ id: 'google/gemini-3.8-flash', name: 'Gemini 3.8 Flash' }, { id: 'anthropic/claude-haiku-5.5' }] }

function setup(responses: Result<unknown>[]) {
  const clock = createFakeDateTimeProvider(new Date('2026-10-14T10:00:00Z'))
  let calls = 0
  const catalog = createModelCatalog({
    fetchList: async () => responses[Math.min(calls++, responses.length - 1)]!,
    clock,
  })
  return { clock, catalog, calls: () => calls }
}

describe('OpenRouter model catalog', () => {
  it('returns id + name (name falls back to the id), sorted by id', async () => {
    const { catalog } = setup([Result.success(body)])
    const r = await catalog.list()
    expect(Result.isSuccess(r) && r.value).toEqual([
      { id: 'anthropic/claude-haiku-5.5', name: 'anthropic/claude-haiku-5.5' },
      { id: 'google/gemini-3.8-flash', name: 'Gemini 3.8 Flash' },
    ])
  })

  it('serves the cached list for an hour, then fetches again', async () => {
    const { catalog, clock, calls } = setup([Result.success(body)])
    await catalog.list()
    clock.advance(HOUR - 1)
    await catalog.list()
    expect(calls()).toBe(1)
    clock.advance(2)
    await catalog.list()
    expect(calls()).toBe(2)
  })

  it('keeps a failure for 60 s (no retry storm), then tries again', async () => {
    const { catalog, clock, calls } = setup([Result.failure(Err.unexpected('Http.500', 'boom')), Result.success(body)])
    const first = await catalog.list()
    expect(Result.isFailure(first) && first.errors[0]?.code).toBe('Http.500')
    clock.advance(59_999)
    expect(Result.isFailure(await catalog.list())).toBe(true)
    expect(calls()).toBe(1)
    clock.advance(2)
    expect(Result.isSuccess(await catalog.list())).toBe(true)
    expect(calls()).toBe(2)
  })

  it('concurrent callers share one in-flight fetch', async () => {
    const { catalog, calls } = setup([Result.success(body)])
    const [a, b, c] = await Promise.all([catalog.list(), catalog.list(), catalog.list()])
    expect(calls()).toBe(1)
    expect(Result.isSuccess(a) && Result.isSuccess(b) && Result.isSuccess(c)).toBe(true)
  })

  it('rejects a response that is not a model list (fallback to free text)', async () => {
    const { catalog } = setup([Result.success({ error: 'nope' })])
    const r = await catalog.list()
    expect(Result.isFailure(r) && r.errors[0]?.code).toBe('AI.ModelListInvalid')
  })
})
