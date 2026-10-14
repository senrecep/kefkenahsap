import { Err } from 'tsentials/errors'
import { fetchResult } from 'tsentials/http'
import { Result } from 'tsentials/result'
import type { DateTimeProvider } from 'tsentials/time'

import { constantTimeEqual } from '../http/basic-auth'
import { createRateLimiter } from '../leads/guard'

/**
 * Minimal server-side error reporter speaking the Sentry store protocol (GlitchTip accepts it), so no SDK ships.
 * Privacy (KVKK, PLAN §10): only the error, the path without its query, the method and the route go out —
 * never headers (Authorization carries the dev basic-auth credential), cookies, bodies or query strings.
 * Message and stack are scrubbed of emails and phone/ID-like numbers and capped.
 */

type Req = { path: string; method: string }

export function parseDsn(dsn: string): Result<{ storeUrl: string; publicKey: string }> {
  const invalid = Result.failure<{ storeUrl: string; publicKey: string }>(Err.validation('Observability.InvalidDsn', 'SENTRY_DSN is not a valid DSN.'))
  if (!URL.canParse(dsn)) return invalid
  const u = new URL(dsn)
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return invalid
  const projectId = u.pathname.split('/').filter(Boolean).at(-1)
  if (!u.username || !projectId) return invalid
  return Result.success({ storeUrl: `${u.protocol}//${u.host}/api/${projectId}/store/`, publicKey: u.username })
}

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g
const NUMBER_RUN = /\+?\d[\d\s().-]*\d/g

/** Emails → [email]; runs of 9+ digits (phones, TC kimlik, IBAN) → [num]. Dates, ports and line:col survive. */
export function scrub(s: string): string {
  return s.replace(EMAIL, '[email]').replace(NUMBER_RUN, (m) => (m.replace(/\D/g, '').length >= 9 ? '[num]' : m))
}

export function buildEvent(err: unknown, req: Req, route: string, o: { environment: string; eventId: string; timestampMs: number }) {
  const e = err instanceof Error ? err : undefined
  return {
    event_id: o.eventId,
    timestamp: o.timestampMs / 1000,
    platform: 'node',
    level: 'error',
    environment: o.environment,
    transaction: route,
    request: { url: req.path.split('?')[0], method: req.method },
    exception: { values: [{ type: e?.name ?? 'Error', value: scrub(e?.message ?? String(err)).slice(0, 500) }] },
    extra: e?.stack ? { stack: scrub(e.stack).slice(0, 8192) } : {},
  }
}

export async function reportError(err: unknown, req: Req, route: string, o: { dsn: string; environment: string; clock: DateTimeProvider }): Promise<Result<void>> {
  const dsn = parseDsn(o.dsn)
  if (!dsn.ok) return Result.failure(...dsn.errors)
  const event = buildEvent(err, req, route, { environment: o.environment, eventId: crypto.randomUUID().replaceAll('-', ''), timestampMs: o.clock.utcNowMs() })
  const r = await fetchResult.post(dsn.value.storeUrl, event, {
    headers: { 'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${dsn.value.publicKey}, sentry_client=kefken/1` },
    signal: AbortSignal.timeout(2000),
  })
  return r.ok ? Result.ok() : Result.failure(...r.errors)
}

/**
 * Fire-and-forget reporting, capped per error (name + message) per minute so an error storm can't flood GlitchTip
 * or pile up sockets. Returns whether the report was sent. Never throws.
 * shortcut: in-process cap; fine for one app container.
 */
export function createReporter(o: { dsn: string; environment: string; clock: DateTimeProvider; perMinute?: number }) {
  const limiter = createRateLimiter({ limit: o.perMinute ?? 5, windowMs: 60_000, clock: o.clock, maxKeys: 1000 })
  return (err: unknown, req: Req, route: string): boolean => {
    if (!limiter.hit(err instanceof Error ? `${err.name}:${err.message}` : String(err))) return false
    reportError(err, req, route, o).then(
      (r) => r.ok || console.error('error report failed:', r.errors[0]?.code),
      () => console.error('error report failed'),
    )
    return true
  }
}

const enc = new TextEncoder()

/** The debug-error route works only when SITE_ENV is exactly 'development', with a non-empty DEBUG_ERROR_TOKEN in a header. */
export function debugErrorAllowed(header: string | null, token: string | undefined, siteEnv: string | undefined): boolean {
  if (siteEnv !== 'development' || !token || !header) return false
  return constantTimeEqual(enc.encode(header), enc.encode(token))
}
