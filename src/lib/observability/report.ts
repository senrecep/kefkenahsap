import { Err } from 'tsentials/errors'
import { fetchResult } from 'tsentials/http'
import { Result } from 'tsentials/result'
import type { DateTimeProvider } from 'tsentials/time'

import { constantTimeEqual } from '../http/basic-auth'

/**
 * Minimal server-side error reporter speaking the Sentry store protocol (GlitchTip accepts it), so no SDK ships.
 * Privacy (KVKK, PLAN §10): only the error, the path without its query, the method and the route go out —
 * never headers (Authorization carries the dev basic-auth credential), cookies, bodies or query strings.
 */

type Req = { path: string; method: string }

export function parseDsn(dsn: string): Result<{ storeUrl: string; publicKey: string }> {
  const invalid = Result.failure<{ storeUrl: string; publicKey: string }>(Err.validation('Observability.InvalidDsn', 'SENTRY_DSN is not a valid DSN.'))
  if (!URL.canParse(dsn)) return invalid
  const u = new URL(dsn)
  const projectId = u.pathname.split('/').filter(Boolean).at(-1)
  if (!u.username || !projectId) return invalid
  return Result.success({ storeUrl: `${u.protocol}//${u.host}/api/${projectId}/store/`, publicKey: u.username })
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
    exception: { values: [{ type: e?.name ?? 'Error', value: e?.message ?? String(err) }] },
    extra: e?.stack ? { stack: e.stack } : {},
  }
}

export async function reportError(err: unknown, req: Req, route: string, o: { dsn: string; environment: string; clock: DateTimeProvider }): Promise<Result<void>> {
  const dsn = parseDsn(o.dsn)
  if (!dsn.ok) return Result.failure(...dsn.errors)
  const event = buildEvent(err, req, route, { environment: o.environment, eventId: crypto.randomUUID().replaceAll('-', ''), timestampMs: o.clock.utcNowMs() })
  const r = await fetchResult.post(dsn.value.storeUrl, event, {
    headers: { 'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${dsn.value.publicKey}, sentry_client=kefken/1` },
    signal: AbortSignal.timeout(5000),
  })
  return r.ok ? Result.ok() : Result.failure(...r.errors)
}

const enc = new TextEncoder()

/** The debug-error route works only outside production, with a non-empty DEBUG_ERROR_TOKEN sent back in a header. */
export function debugErrorAllowed(header: string | null, token: string | undefined, siteEnv: string | undefined): boolean {
  if (siteEnv === 'production' || !token || !header) return false
  return constantTimeEqual(enc.encode(header), enc.encode(token))
}
