import { Err } from 'tsentials/errors'
import { fetchResult } from 'tsentials/http'
import { Result } from 'tsentials/result'
import type { DateTimeProvider } from 'tsentials/time'

/**
 * Fixed-window counter per key (client IP).
 * shortcut: in-memory, per process — resets on restart and isn't shared across replicas; move to Redis/DB if we scale out.
 */
export function createRateLimiter({ limit, windowMs, clock }: { limit: number; windowMs: number; clock: DateTimeProvider }) {
  const hits = new Map<string, { start: number; count: number }>()
  return {
    /** Records a hit; false when the key is over its limit in the current window. */
    hit(key: string): boolean {
      const now = clock.utcNowMs()
      const w = hits.get(key)
      if (!w || now - w.start > windowMs) {
        if (hits.size > 10_000) hits.clear() // bound memory under a flood of distinct IPs
        hits.set(key, { start: now, count: 1 })
        return true
      }
      w.count++
      return w.count <= limit
    },
  }
}

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const spam = () => Err.validation('Lead.SpamCheckFailed', 'Güvenlik doğrulaması başarısız.')

/** Cloudflare Turnstile server-side check. Fails closed: a missing secret or token is a failure. */
export async function verifyTurnstile(args: { token: string; secret: string | undefined; ip?: string }): Promise<Result<void>> {
  if (!args.token || !args.secret) return Result.failure(spam())
  const r = await fetchResult.post<{ success?: boolean }>(SITEVERIFY, {
    secret: args.secret,
    response: args.token,
    ...(args.ip ? { remoteip: args.ip } : {}),
  })
  return r.ok && r.value?.success === true ? Result.ok() : Result.failure(spam())
}

/** Campaign parameters from the page URL, stored on the lead (strings only, bounded). */
export function pickUtm(params: Record<string, string | string[] | undefined>): Record<string, string> | undefined {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(params)) {
    const s = Array.isArray(v) ? v[0] : v
    if (k.startsWith('utm_') && typeof s === 'string' && s.trim()) out[k] = s.trim().slice(0, 200)
  }
  return Object.keys(out).length ? out : undefined
}
