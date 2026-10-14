import { APICallError, generateText, Output, type LanguageModel, type ModelMessage } from 'ai'
import { Err } from 'tsentials/errors'
import { Result } from 'tsentials/result'
import type { z } from 'zod'

export type Attempt = { model: string; ok: boolean; error?: string }
export type StructuredRun<T> = {
  output: T
  model: string
  costUsd?: number
  inputTokens?: number
  outputTokens?: number
  attempts: Attempt[]
}

type Args<S extends z.ZodType> = {
  /** Ordered model ids; the first schema-valid answer wins (geolyt pattern). */
  chain: string[]
  getModel: (id: string) => LanguageModel
  schema: S
  system: string
  prompt?: string
  messages?: ModelMessage[]
  temperature?: number
  maxRetries?: number
}

/**
 * Structured generation across a model fallback chain.
 * Schema failures and provider errors move on to the next model; 402 (no credit) stops the chain.
 */
export async function runStructured<S extends z.ZodType>(args: Args<S>): Promise<Result<StructuredRun<z.infer<S>>>> {
  if (!args.chain.length) return Result.failure(Err.validation('AI.NoModels', 'No model configured for this task'))
  const attempts: Attempt[] = []
  for (const id of args.chain) {
    try {
      const res = await generateText({
        model: args.getModel(id),
        system: args.system,
        ...(args.messages ? { messages: args.messages } : { prompt: args.prompt ?? '' }),
        output: Output.object({ schema: args.schema }),
        temperature: args.temperature ?? 0.2,
        maxRetries: args.maxRetries ?? 1,
      })
      attempts.push({ model: id, ok: true })
      const cost = (res.providerMetadata?.openrouter as { usage?: { cost?: number } } | undefined)?.usage?.cost
      return Result.success({
        output: res.output as z.infer<S>,
        model: id,
        ...(cost !== undefined ? { costUsd: cost } : {}),
        inputTokens: res.usage.inputTokens,
        outputTokens: res.usage.outputTokens,
        attempts,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message.slice(0, 300) : String(err)
      attempts.push({ model: id, ok: false, error: message })
      if (APICallError.isInstance(err) && err.statusCode === 402)
        return Result.failure(Err.unexpected('AI.PaymentRequired', 'OpenRouter credit exhausted (402)'))
    }
  }
  return Result.failure(
    Err.unexpected('AI.AllModelsFailed', `All models failed: ${attempts.map((a) => `${a.model}: ${a.error}`).join(' | ')}`),
  )
}
