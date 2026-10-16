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
  tags: { type: [] as string[], wood: [], setting: ['havuz kenarı'], finish: ['doğal'], stage: ['finished'] },
  categoryAgrees: true,
  confidence: 0.9,
}

/** The part of the provider call a responder reads: the prompt messages (system + user). */
export type FakeCall = { prompt: { role: string; content: unknown }[] }
type Responder = (call: FakeCall) => unknown

const userText = (call: FakeCall) =>
  call.prompt
    .filter((m) => m.role === 'user')
    .flatMap((m) => (Array.isArray(m.content) ? m.content : []))
    .map((p: { type?: string; text?: string }) => (p.type === 'text' ? p.text : ''))
    .join('')

const RESPONDERS: Partial<Record<AiTask, Responder>> = {
  // #171: answers with the first offered product type plus an invented one, which the job must drop.
  tagImage: (call) => {
    const offered = /Ürün türleri: (\[.*\])/.exec(userText(call))?.[1]
    const first = offered ? (JSON.parse(offered) as string[])[0] : undefined
    return { ...FAKE_TAG_IMAGE, tags: { ...FAKE_TAG_IMAGE.tags, type: [...(first ? [first] : []), 'Uydurma tür'] } }
  },
  // "[EN] <source text, trimmed like a real model would>" per segment and target locale: deterministic and easy to assert.
  translate: (call) => {
    const input = JSON.parse(userText(call)) as { targets: string[]; segments: { id: string; text: string }[] }
    return {
      items: input.segments.map((s) => ({ id: s.id, ...Object.fromEntries(input.targets.map((t) => [t, `[${t.toUpperCase()}] ${s.text.trim()}`])) })),
    }
  },
  // Drafts restate the notes; the extra `_status` proves the caller drops anything outside the schema.
  draftGuide: (call) => {
    const input = JSON.parse(userText(call)) as { title: string; notes: string[] }
    return { excerpt: `Taslak: ${input.title}`, sections: [{ heading: input.notes[0], paragraphs: input.notes, bullets: [] }], _status: 'published' }
  },
  draftProjectStory: (call) => {
    const input = JSON.parse(userText(call)) as { notes: string[]; photos: string[] }
    return { paragraphs: [input.notes.join(' '), ...(input.photos.length ? [`Fotoğraflar: ${input.photos.join('; ')}`] : [])], _status: 'published' }
  },
}

/** The last fake calls (system prompt + model id), newest last; tests read what the model was told. */
export const fakeCalls: { task: AiTask; model: string; system: string }[] = []
const systemText = (call: FakeCall) =>
  call.prompt.filter((m) => m.role === 'system').map((m) => (typeof m.content === 'string' ? m.content : '')).join('\n')

/** Deterministic stand-in for an OpenRouter model (AI_FAKE_PROVIDER=1). Answers with the model id it was asked for. */
export function fakeModel(task: AiTask, id: string): LanguageModel {
  return new MockLanguageModelV4({
    provider: 'fake',
    modelId: id,
    doGenerate: async (call) => {
      const respond = RESPONDERS[task]
      if (!respond) throw new Error(`No fake response for task ${task}`)
      fakeCalls.push({ task, model: id, system: systemText(call as FakeCall) })
      if (fakeCalls.length > 20) fakeCalls.shift()
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
