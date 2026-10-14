import type { Payload, PayloadRequest } from 'payload'
import { Err, type AppError } from 'tsentials/errors'
import { Result } from 'tsentials/result'
import { SystemDateTimeProvider } from 'tsentials/time'

import { roleOf } from '@/access'
import { createRateLimiter } from '@/lib/leads/guard'
import { checkBudget } from './budget'
import { monthUsage } from './usage'

export type AiLimiter = ReturnType<typeof createRateLimiter>
/** Per staff user: 10 AI button presses per 10 minutes (each press is one paid model call). */
export const aiLimiter = (): AiLimiter => createRateLimiter({ limit: 10, windowMs: 10 * 60_000, clock: SystemDateTimeProvider, maxKeys: 100 })

/** Every AI button endpoint passes here first: signed-in staff, under the rate limit, under the monthly budget. */
export async function aiGate(payload: Payload, req: PayloadRequest, limiter: AiLimiter) {
  const user = req.user
  if (!user || !roleOf(user)) return Result.failure(Err.unauthorized('Auth.Required', 'Bu işlem için yönetim paneline giriş yapın.'))
  if (!limiter.hit(`${user.collection}:${user.id}`))
    return Result.failure(Err.forbidden('AI.RateLimited', 'Kısa sürede çok fazla istek gönderildi. Birkaç dakika sonra tekrar deneyin.'))
  const settings = await payload.findGlobal({ slug: 'aiSettings', depth: 0 })
  const spent = (await monthUsage(payload, undefined, SystemDateTimeProvider)).reduce((s, d) => s + (d.costUsd ?? 0), 0)
  const budget = checkBudget(spent, settings.monthlyBudgetUsd)
  return Result.isFailure(budget) ? Result.failure(budget.errors[0]!) : Result.success(settings)
}

const STATUS: Record<string, number> = { Unauthorized: 401, Forbidden: 403, Validation: 400, NotFound: 404, Conflict: 409 }

/** Edge mapping for the AI endpoints: a Turkish message the admin button shows as is. */
export function aiErrorResponse(err: AppError): Response {
  const status = err.code === 'AI.RateLimited' ? 429 : (STATUS[String(err.type)] ?? 502)
  return Response.json({ error: err.description, code: err.code }, { status })
}
