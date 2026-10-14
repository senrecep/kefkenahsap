import type { Instrumentation } from 'next'

/**
 * Server errors (render, route handlers, server actions) → GlitchTip when SENTRY_DSN is set. No client SDK (JS budget).
 * shortcut: errors that Payload catches itself (REST/GraphQL endpoints, collection hooks) never reach here; add a Payload
 * `afterError` hook if admin/API 500s need tracking too.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const dsn = process.env.SENTRY_DSN
  if (!dsn || process.env.NEXT_RUNTIME !== 'nodejs') return
  const [{ reportError }, { SystemDateTimeProvider }] = await Promise.all([import('./lib/observability/report'), import('tsentials/time')])
  const r = await reportError(err, request, context.routePath, { dsn, environment: process.env.SITE_ENV ?? 'local', clock: SystemDateTimeProvider })
  if (!r.ok) console.error('error report failed:', r.errors[0]?.code)
}
