import { Err } from 'tsentials/errors'
import { Result, type VoidResult } from 'tsentials/result'

const LOCAL = new Set(['localhost', '127.0.0.1', '::1'])

export const isLocalHost = (host: string) => LOCAL.has(host)

/** Host of a postgres URL (IPv6 brackets removed), '' when missing or unparsable. */
export function databaseHost(url: string | undefined): string {
  try {
    return url ? new URL(url).hostname.replace(/^\[(.*)\]$/, '$1') : ''
  } catch {
    return ''
  }
}

/**
 * Quality fixtures publish test content, so they run only against a throwaway database: CI's job service or a local
 * one. Never production, wherever it is reached from.
 */
export function fixtureTarget(env: { databaseUrl?: string; ci?: string; siteEnv?: string }): VoidResult {
  if (env.siteEnv === 'production') return Result.failure(Err.forbidden('Quality.ProductionTarget', 'Refusing to write quality fixtures with SITE_ENV=production.'))
  const host = databaseHost(env.databaseUrl)
  if (env.ci || isLocalHost(host)) return Result.ok()
  return Result.failure(Err.forbidden('Quality.RemoteTarget', `Refusing to write quality fixtures to ${host || 'an unknown host'}: only CI or a local database.`))
}
