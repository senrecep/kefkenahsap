import { describe, expect, it } from 'vitest'
import { Result } from 'tsentials/result'

import { databaseHost, fixtureTarget, isLocalHost } from './target'

describe('isLocalHost', () => {
  it('accepts loopback names only', () => {
    expect(isLocalHost('localhost')).toBe(true)
    expect(isLocalHost('127.0.0.1')).toBe(true)
    expect(isLocalHost('::1')).toBe(true)
    expect(isLocalHost('db.example.com')).toBe(false)
    expect(isLocalHost('10.0.0.5')).toBe(false)
  })
})

describe('databaseHost', () => {
  it('reads the host from a postgres URL, IPv6 brackets removed', () => {
    expect(databaseHost('postgres://u:p@localhost:5433/kefken')).toBe('localhost')
    expect(databaseHost('postgres://u:p@[::1]:5432/db')).toBe('::1')
    expect(databaseHost('postgres://u:p@pg.internal:5432/db')).toBe('pg.internal')
  })
  it('is empty for a missing or broken URL', () => {
    expect(databaseHost(undefined)).toBe('')
    expect(databaseHost('not a url')).toBe('')
  })
})

describe('fixtureTarget', () => {
  const local = 'postgres://u:p@127.0.0.1:5433/kefken'
  const remote = 'postgres://u:p@10.0.1.7:5432/kefken'
  it('allows a local database', () => {
    expect(Result.isSuccess(fixtureTarget({ databaseUrl: local }))).toBe(true)
  })
  it('allows CI whatever the host (its database is the job service)', () => {
    expect(Result.isSuccess(fixtureTarget({ databaseUrl: remote, ci: 'true' }))).toBe(true)
  })
  it('refuses a remote database outside CI', () => {
    expect(Result.isSuccess(fixtureTarget({ databaseUrl: remote }))).toBe(false)
  })
  it('refuses production even locally or in CI', () => {
    expect(Result.isSuccess(fixtureTarget({ databaseUrl: local, siteEnv: 'production' }))).toBe(false)
    expect(Result.isSuccess(fixtureTarget({ databaseUrl: local, ci: 'true', siteEnv: 'production' }))).toBe(false)
  })
})
