import { Err } from 'tsentials/errors'
import { fetchResult } from 'tsentials/http'
import { Result } from 'tsentials/result'
import { SystemDateTimeProvider, type DateTimeProvider } from 'tsentials/time'
import { z } from 'zod'

import { isFakeAi } from './models'

export type ModelInfo = { id: string; name: string }

const ListSchema = z.object({ data: z.array(z.object({ id: z.string().min(1), name: z.string().optional() })) })
const TTL_MS = 60 * 60 * 1000

/** OpenRouter model list for the admin picker, cached for an hour. A failure is not cached; the picker then takes free text. */
export function createModelCatalog({ fetchList, clock }: { fetchList: () => Promise<Result<unknown>>; clock: DateTimeProvider }) {
  let cache: { at: number; models: ModelInfo[] } | undefined
  return {
    async list(): Promise<Result<ModelInfo[]>> {
      if (cache && clock.utcNowMs() - cache.at < TTL_MS) return Result.success(cache.models)
      const res = await fetchList()
      if (!res.ok) return res
      const parsed = ListSchema.safeParse(res.value)
      if (!parsed.success) return Result.failure(Err.unexpected('AI.ModelListInvalid', 'OpenRouter model listesi okunamadı'))
      const models = parsed.data.data
        .map((m) => ({ id: m.id, name: m.name || m.id }))
        .sort((a, b) => a.id.localeCompare(b.id))
      cache = { at: clock.utcNowMs(), models }
      return Result.success(models)
    },
  }
}

// AI_FAKE_PROVIDER: local dev and tests never reach OpenRouter, not even the free /models list.
const FAKE_LIST = { data: [{ id: 'fake/model-a', name: 'Fake model A' }, { id: 'fake/model-b', name: 'Fake model B' }] }

export const modelCatalog = createModelCatalog({
  fetchList: () =>
    isFakeAi()
      ? Promise.resolve(Result.success(FAKE_LIST))
      : fetchResult.get<unknown>('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(5000) }),
  clock: SystemDateTimeProvider,
})
