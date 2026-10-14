import type { LanguageModel } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'

import type { AiTask } from './models'

/** Fixed cost per fake call, so budget and cost-panel paths see real numbers. */
export const FAKE_COST_USD = 0.0042

export const FAKE_TAG_IMAGE = {
  title: { tr: 'Havuz kenarı ahşap deck', en: 'Poolside timber deck' },
  alt: { tr: 'Havuz kenarında açık renkli ahşap deck zemin', en: 'Light timber decking beside a pool' },
  caption: { tr: 'Bahçe havuzu çevresine döşenen deck.', en: 'Decking laid around a garden pool.' },
  seoFilename: 'havuz-kenari-ahsap-deck',
  tags: { wood: [], setting: ['havuz kenarı'], finish: ['doğal'], stage: ['finished'] },
  categoryAgrees: true,
  confidence: 0.9,
}

/** The part of the provider call a responder reads: the prompt messages (system + user). */
export type FakeCall = { prompt: { role: string; content: unknown }[] }
type Responder = (call: FakeCall) => unknown

const RESPONDERS: Partial<Record<AiTask, Responder>> = {
  tagImage: () => FAKE_TAG_IMAGE,
}

/** Deterministic stand-in for an OpenRouter model (AI_FAKE_PROVIDER=1). Answers with the model id it was asked for. */
export function fakeModel(task: AiTask, id: string): LanguageModel {
  return new MockLanguageModelV4({
    provider: 'fake',
    modelId: id,
    doGenerate: async (call) => {
      const respond = RESPONDERS[task]
      if (!respond) throw new Error(`No fake response for task ${task}`)
      return {
        content: [{ type: 'text', text: JSON.stringify(respond(call as FakeCall)) }],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: 1000, noCache: 1000, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 200, text: 200, reasoning: 0 },
        },
        warnings: [],
        providerMetadata: { openrouter: { usage: { cost: FAKE_COST_USD } } },
      }
    },
  })
}
