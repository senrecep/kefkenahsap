import { Err } from 'tsentials/errors'
import { fetchResult } from 'tsentials/http'
import { Result } from 'tsentials/result'
import { SystemDateTimeProvider, type DateTimeProvider } from 'tsentials/time'
import { z } from 'zod'

import { isFakeAi } from './models'

export type ModelInfo = { id: string; name: string }

const ListSchema = z.object({ data: z.array(z.object({ id: z.string().min(1), name: z.string().optional() })) })
const TTL_MS = 60 * 60 * 1000
const FAIL_TTL_MS = 60 * 1000

/**
 * OpenRouter model list for the admin picker, cached for an hour. A failure is kept for 60 s (then retried); the picker
 * takes free text meanwhile. Concurrent callers share one in-flight fetch.
 */
export function createModelCatalog({ fetchList, clock }: { fetchList: () => Promise<Result<unknown>>; clock: DateTimeProvider }) {
  let cache: { at: number; ttl: number; result: Result<ModelInfo[]> } | undefined
  let inFlight: Promise<Result<ModelInfo[]>> | undefined

  async function load(): Promise<Result<ModelInfo[]>> {
    const res = await fetchList()
    let result: Result<ModelInfo[]>
    if (!res.ok) result = res
    else {
      const parsed = ListSchema.safeParse(res.value)
      result = parsed.success
        ? Result.success(parsed.data.data.map((m) => ({ id: m.id, name: m.name || m.id })).sort((a, b) => a.id.localeCompare(b.id)))
        : Result.failure(Err.unexpected('AI.ModelListInvalid', 'OpenRouter model listesi okunamadı'))
    }
    cache = { at: clock.utcNowMs(), ttl: result.ok ? TTL_MS : FAIL_TTL_MS, result }
    return result
  }

  return {
    list(): Promise<Result<ModelInfo[]>> {
      if (cache && clock.utcNowMs() - cache.at < cache.ttl) return Promise.resolve(cache.result)
      inFlight ??= load().finally(() => (inFlight = undefined))
      return inFlight
    },
  }
}

// AI_FAKE_PROVIDER: local dev and tests never reach OpenRouter, not even the free /models list.
const FAKE_LIST = { data: [{ id: 'fake/model-a', name: 'Fake model A' }, { id: 'fake/model-b', name: 'Fake model B' }] }

export const modelCatalog = createModelCatalog({
  fetchList: () =>
    isFakeAi()
      ? Promise.resolve(Result.success(FAKE_LIST))
      : fetchResult.get<unknown>('https://openrouter.ai/api/v1/models', { timeout: 5000 }),
  clock: SystemDateTimeProvider,
})
