import type { Instrumentation } from 'next'

let report: ((err: unknown, req: { path: string; method: string }, route: string) => boolean) | undefined

/**
 * Server errors (render, route handlers, server actions) → GlitchTip when SENTRY_DSN is set. No client SDK (JS budget).
 * Fire-and-forget: the erroring request never waits on, or fails because of, reporting.
 * shortcut: errors that Payload catches itself (REST/GraphQL endpoints, collection hooks) never reach here; add a Payload
 * `afterError` hook if admin/API 500s need tracking too.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  try {
    const dsn = process.env.SENTRY_DSN
    if (!dsn || process.env.NEXT_RUNTIME !== 'nodejs') return
    if (!report) {
      const [{ createReporter }, { SystemDateTimeProvider }] = await Promise.all([import('./lib/observability/report'), import('tsentials/time')])
      report ??= createReporter({ dsn, environment: process.env.SITE_ENV ?? 'local', clock: SystemDateTimeProvider })
    }
    report(err, request, context.routePath)
  } catch {
    // Reporting must never break the request.
  }
}
