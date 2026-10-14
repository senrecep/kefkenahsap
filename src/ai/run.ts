import { APICallError, generateText, NoObjectGeneratedError, Output, type LanguageModel, type ModelMessage } from 'ai'
import { Err, ErrorMetadata, type AppError } from 'tsentials/errors'
import { Result } from 'tsentials/result'
import type { z } from 'zod'

export type Attempt = { model: string; ok: boolean; error?: string; costUsd: number }
export type StructuredRun<T> = {
  output: T
  model: string
  /** Cost of the whole run: every attempt, failed ones included (provider-reported, else estimated). */
  costUsd: number
  inputTokens?: number
  outputTokens?: number
  attempts: Attempt[]
}

type Args<S extends z.ZodType> = {
  /** Ordered model ids; the first schema-valid answer wins (geolyt pattern). */
  chain: string[]
  getModel: (id: string) => LanguageModel | Promise<LanguageModel>
  schema: S
  system: string
  prompt?: string
  messages?: ModelMessage[]
  temperature?: number
  maxRetries?: number
}

/**
 * Fallback price when the provider reports no cost: Sonnet-class list price, the most expensive model in our chains.
 * shortcut: one flat rate, may overcount cheap models; read per-model pricing from the /models catalog if that matters.
 */
const USD_PER_INPUT_TOKEN = 3 / 1e6
const USD_PER_OUTPUT_TOKEN = 15 / 1e6
const IMAGE_TOKENS = 1000

export const estimateCost = (inputTokens: number, outputTokens: number) => inputTokens * USD_PER_INPUT_TOKEN + outputTokens * USD_PER_OUTPUT_TOKEN

/** Input size when the provider returned no usage (failed call): ~4 characters per token, a flat amount per file. */
function estimateInputTokens(args: { system: string; prompt?: string; messages?: ModelMessage[] }): number {
  let chars = args.system.length + (args.prompt?.length ?? 0)
  let files = 0
  for (const m of args.messages ?? []) {
    if (typeof m.content === 'string') chars += m.content.length
    else
      for (const part of m.content) {
        if (part.type === 'text') chars += part.text.length
        else files++
      }
  }
  return Math.ceil(chars / 4) + files * IMAGE_TOKENS
}

/** Cost of a failed run, carried in the error metadata (budget rows are written on failure too). */
export function failureUsage(errors: readonly AppError[]): { costUsd: number } {
  const v = errors[0]?.metadata?.get('costUsd')
  return { costUsd: typeof v === 'number' ? v : 0 }
}

const total = (attempts: Attempt[]) => attempts.reduce((s, a) => s + a.costUsd, 0)
const failed = (code: string, description: string, attempts: Attempt[], type: 'unexpected' | 'validation' = 'unexpected') =>
  Result.failure(Err[type](code, description, ErrorMetadata.fromRecord({ costUsd: total(attempts) })))

/**
 * Structured generation across a model fallback chain.
 * Schema failures and provider errors move on to the next model; 402 (no credit) stops the chain.
 * Every attempt is costed: the provider's reported cost, else an estimate from tokens.
 */
export async function runStructured<S extends z.ZodType>(args: Args<S>): Promise<Result<StructuredRun<z.infer<S>>>> {
  if (!args.chain.length) return failed('AI.NoModels', 'No model configured for this task', [], 'validation')
  const attempts: Attempt[] = []
  for (const id of args.chain) {
    try {
      const res = await generateText({
        model: await args.getModel(id),
        system: args.system,
        ...(args.messages ? { messages: args.messages } : { prompt: args.prompt ?? '' }),
        output: Output.object({ schema: args.schema }),
        temperature: args.temperature ?? 0.2,
        maxRetries: args.maxRetries ?? 1,
      })
      const reported = (res.providerMetadata?.openrouter as { usage?: { cost?: number } } | undefined)?.usage?.cost
      attempts.push({ model: id, ok: true, costUsd: reported ?? estimateCost(res.usage.inputTokens ?? 0, res.usage.outputTokens ?? 0) })
      return Result.success({
        output: res.output as z.infer<S>,
        model: id,
        costUsd: total(attempts),
        inputTokens: res.usage.inputTokens,
        outputTokens: res.usage.outputTokens,
        attempts,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message.slice(0, 300) : String(err)
      // A schema-invalid answer was generated and billed: its usage is on the error. Otherwise estimate the input.
      const usage = NoObjectGeneratedError.isInstance(err) ? err.usage : undefined
      const costUsd = usage ? estimateCost(usage.inputTokens ?? 0, usage.outputTokens ?? 0) : estimateCost(estimateInputTokens(args), 0)
      attempts.push({ model: id, ok: false, error: message, costUsd })
      if (APICallError.isInstance(err) && err.statusCode === 402) return failed('AI.PaymentRequired', 'OpenRouter credit exhausted (402)', attempts)
    }
  }
  return failed('AI.AllModelsFailed', `All models failed: ${attempts.map((a) => `${a.model}: ${a.error}`).join(' | ')}`, attempts)
}
