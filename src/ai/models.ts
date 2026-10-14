import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import type { LanguageModel } from 'ai'

import { fakeModel } from './fake'

export type AiTask = 'tagImage' | 'translate' | 'draftGuide' | 'draftProjectStory'
export const AI_TASKS: AiTask[] = ['tagImage', 'translate', 'draftGuide', 'draftProjectStory']

/** Defaults verified in the F0 spike (docs/SPIKE.md); admins override per task in aiSettings. */
export const DEFAULT_CHAINS: Record<AiTask, string[]> = {
  tagImage: ['google/gemini-3.8-flash', 'anthropic/claude-haiku-5.5'],
  translate: ['anthropic/claude-sonnet-5.5', 'google/gemini-3.8-flash'],
  draftGuide: ['anthropic/claude-sonnet-5.5', 'google/gemini-3.8-flash'],
  draftProjectStory: ['anthropic/claude-sonnet-5.5', 'google/gemini-3.8-flash'],
}

const clean = (ids: readonly (string | null | undefined)[]) => ids.map((s) => s?.trim() ?? '').filter(Boolean)

/** Model chain for a task: env (AI_<TASK>_MODELS) > admin settings > defaults. */
export function resolveChain(
  task: AiTask,
  settings: Partial<Record<AiTask, readonly (string | null | undefined)[] | null | undefined>>,
  env: Record<string, string | undefined>,
): string[] {
  const fromEnv = clean((env[`AI_${task.toUpperCase()}_MODELS`] ?? '').split(','))
  if (fromEnv.length) return fromEnv
  const fromSettings = clean(settings[task] ?? [])
  return fromSettings.length ? fromSettings : DEFAULT_CHAINS[task]
}

let provider: ReturnType<typeof createOpenRouter> | undefined
/** OpenRouter model with usage accounting (cost comes back in providerMetadata). */
export function openRouterModel(id: string): LanguageModel {
  provider ??= createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    headers: { 'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.kefkenahsap.com', 'X-Title': 'kefkenahsap.com' },
  })
  return provider(id, { usage: { include: true } })
}

/** Local dev, tests and CI set AI_FAKE_PROVIDER=1: no call ever reaches OpenRouter. The deployed app never sets it. */
export const isFakeAi = () => process.env.AI_FAKE_PROVIDER === '1'

/** The one model getter every AI task uses: OpenRouter, or the deterministic fake under AI_FAKE_PROVIDER. */
export function aiModel(task: AiTask): (id: string) => LanguageModel {
  return (id) => (isFakeAi() ? fakeModel(task, id) : openRouterModel(id))
}
