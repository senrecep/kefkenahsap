import { Err } from 'tsentials/errors'
import { fetchResult } from 'tsentials/http'
import { Result } from 'tsentials/result'
import type { DateTimeProvider } from 'tsentials/time'

/**
 * Fixed-window counter per key (client IP).
 * shortcut: in-memory, per process — resets on restart and isn't shared across replicas; move to Redis/DB if we scale out.
 */
export function createRateLimiter({ limit, windowMs, clock, maxKeys = 10_000 }: { limit: number; windowMs: number; clock: DateTimeProvider; maxKeys?: number }) {
  const hits = new Map<string, { start: number; count: number }>()
  return {
    /** Records a hit; false when the key is over its limit in the current window. */
    hit(key: string): boolean {
      const now = clock.utcNowMs()
      const w = hits.get(key)
      if (!w || now - w.start > windowMs) {
        // Re-insert so Map order = window start order; the oldest keys go first when memory is bounded.
        hits.delete(key)
        hits.set(key, { start: now, count: 1 })
        while (hits.size > maxKeys) hits.delete(hits.keys().next().value!)
        return true
      }
      w.count++
      return w.count <= limit
    },
  }
}

/**
 * Client IP for rate limiting. Production sits behind Cloudflare, so only `cf-connecting-ip` is trusted (X-Forwarded-For
 * can be spoofed); a request without it shares one 'no-cf' bucket. Dev: last X-Forwarded-For hop (added by our own proxy).
 */
export function clientIp(h: Headers, production: boolean): string {
  const cf = h.get('cf-connecting-ip')?.trim()
  if (cf) return cf
  if (production) return 'no-cf'
  return h.get('x-forwarded-for')?.split(',').at(-1)?.trim() || 'unknown'
}

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const spam = () => Err.validation('Lead.SpamCheckFailed', 'Güvenlik doğrulaması başarısız.')

/** Cloudflare Turnstile server-side check. Fails closed: a missing secret or token is a failure. */
export async function verifyTurnstile(args: { token: string; secret: string | undefined; ip?: string }): Promise<Result<void>> {
  if (!args.token || !args.secret) return Result.failure(spam())
  const r = await fetchResult.post<{ success?: boolean }>(
    SITEVERIFY,
    { secret: args.secret, response: args.token, ...(args.ip ? { remoteip: args.ip } : {}) },
    { signal: AbortSignal.timeout(5000) }, // a timeout is a failure too (fails closed)
  )
  return r.ok && r.value?.success === true ? Result.ok() : Result.failure(spam())
}

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']

/** Campaign parameters from the page URL, stored on the lead: the five standard keys only, plain text, bounded. */
export function pickUtm(params: Record<string, string | string[] | undefined>): Record<string, string> | undefined {
  const out: Record<string, string> = {}
  for (const k of UTM_KEYS) {
    const v = params[k]
    const s = (Array.isArray(v) ? v[0] : v)?.replace(/[\u0000-\u001f\u007f]/g, '').trim()
    if (s) out[k] = s.slice(0, 200)
  }
  return Object.keys(out).length ? out : undefined
}
