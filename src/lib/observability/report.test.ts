import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFakeDateTimeProvider } from 'tsentials/time'

import { buildEvent, createReporter, debugErrorAllowed, parseDsn, reportError, scrub } from './report'

describe('parseDsn', () => {
  it('turns a DSN into the store endpoint and public key', () => {
    const r = parseDsn('https://k3y@glitchtip-dev.kefkenahsap.com/7')
    expect(r.ok && r.value).toEqual({ storeUrl: 'https://glitchtip-dev.kefkenahsap.com/api/7/store/', publicKey: 'k3y' })
  })

  it.each(['', 'not a url', 'https://glitchtip-dev.kefkenahsap.com/7', 'https://k3y@glitchtip-dev.kefkenahsap.com/', 'ftp://k3y@gt.example/1', 'javascript://k3y@x/1'])('rejects %j', (dsn) => {
    const r = parseDsn(dsn)
    expect(r.ok).toBe(false)
    expect(!r.ok && r.errors[0].code).toBe('Observability.InvalidDsn')
  })
})

describe('buildEvent', () => {
  it('keeps only the error, path without query, method and route; no headers', () => {
    const err = new TypeError('boom')
    const e = buildEvent(err, { path: '/api/x?email=a@b.c', method: 'POST' }, 'app/api/x', {
      environment: 'development',
      eventId: 'a'.repeat(32),
      timestampMs: Date.UTC(2026, 9, 14, 12, 0, 0),
    })
    expect(e).toEqual({
      event_id: 'a'.repeat(32),
      timestamp: 1791979200,
      platform: 'node',
      level: 'error',
      environment: 'development',
      transaction: 'app/api/x',
      request: { url: '/api/x', method: 'POST' },
      exception: { values: [{ type: 'TypeError', value: 'boom' }] },
      extra: { stack: err.stack },
    })
  })

  it('scrubs personal data from the message and stack', () => {
    const err = new Error('lead failed for ayse.yilmaz@example.com.tr, phone +90 532 123 45 67')
    err.stack = `Error: mail ali@x.io\n    at f (/app/a.js:12:34)\n    tc 12345678901`
    const e = buildEvent(err, { path: '/', method: 'GET' }, '/', { environment: 'x', eventId: 'c'.repeat(32), timestampMs: 0 })
    expect(e.exception.values[0].value).toBe('lead failed for [email], phone [num]')
    expect(e.extra).toEqual({ stack: 'Error: mail [email]\n    at f (/app/a.js:12:34)\n    tc [num]' })
  })

  it('caps the message at 500 chars and the stack at 8 KB', () => {
    const err = new Error('x'.repeat(600))
    err.stack = 'y'.repeat(9000)
    const e = buildEvent(err, { path: '/', method: 'GET' }, '/', { environment: 'x', eventId: 'd'.repeat(32), timestampMs: 0 })
    expect(e.exception.values[0].value).toHaveLength(500)
    expect(e.extra.stack).toHaveLength(8192)
  })

  it('handles non-Error throws', () => {
    const e = buildEvent('plain', { path: '/', method: 'GET' }, '/', { environment: 'x', eventId: 'b'.repeat(32), timestampMs: 0 })
    expect(e.exception.values[0]).toEqual({ type: 'Error', value: 'plain' })
    expect(e.extra).toEqual({})
  })
})

describe('reportError', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('POSTs the event to the store endpoint with the Sentry auth header', async () => {
    const fetch = vi.fn(async () => Response.json({ id: 'x' }))
    vi.stubGlobal('fetch', fetch)
    const r = await reportError(new Error('boom'), { path: '/p', method: 'GET' }, '/p', {
      dsn: 'https://k3y@gt.example/2',
      environment: 'development',
      clock: createFakeDateTimeProvider(new Date(Date.UTC(2026, 0, 1))),
    })
    expect(r.ok).toBe(true)
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://gt.example/api/2/store/')
    expect(new Headers(init.headers).get('x-sentry-auth')).toBe('Sentry sentry_version=7, sentry_key=k3y, sentry_client=kefken/1')
    const body = JSON.parse(String(init.body))
    expect(body.timestamp).toBe(1767225600)
    expect(body.event_id).toMatch(/^[0-9a-f]{32}$/)
  })

  it('fails without sending when the DSN is invalid', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const r = await reportError(new Error('x'), { path: '/', method: 'GET' }, '/', { dsn: 'nope', environment: 'x', clock: createFakeDateTimeProvider(new Date(0)) })
    expect(r.ok).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('scrub', () => {
  it.each([
    ['call 0532 123 45 67 now', 'call [num] now'],
    ['iban TR33 0006 1005 1978 6457 8413 26', 'iban TR[num]'],
    ['date 2026-10-14 and port 3000 stay', 'date 2026-10-14 and port 3000 stay'],
    ['a.b+c@d.co', '[email]'],
  ])('%j → %j', (input, out) => expect(scrub(input)).toBe(out))
})

describe('createReporter', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sends at most 5 reports per minute for the same error, without blocking the caller', async () => {
    const fetch = vi.fn(async () => Response.json({}))
    vi.stubGlobal('fetch', fetch)
    const clock = createFakeDateTimeProvider(new Date(Date.UTC(2026, 0, 1)))
    const report = createReporter({ dsn: 'https://k@gt.example/1', environment: 'x', clock })
    const results = Array.from({ length: 7 }, () => report(new Error('same'), { path: '/', method: 'GET' }, '/'))
    report(new Error('other'), { path: '/', method: 'GET' }, '/')
    expect(results).toEqual([true, true, true, true, true, false, false])
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(6))
  })

  it('never throws when sending fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))
    const report = createReporter({ dsn: 'https://k@gt.example/1', environment: 'x', clock: createFakeDateTimeProvider(new Date(0)) })
    expect(() => report(new Error('e'), { path: '/', method: 'GET' }, '/')).not.toThrow()
  })
})

describe('debugErrorAllowed', () => {
  it.each([
    ['s3cret', 's3cret', 'development', true],
    ['s3cret', 's3cret', undefined, false],
    ['s3cret', 's3cret', 'production', false],
    ['s3cret', 's3cret', 'Production', false],
    ['s3cret', 's3cret', 'prod', false],
    ['s3cret', 's3cret', '', false],
    ['s3cret', '', 'development', false],
    ['', '', 'development', false],
    [null, 's3cret', 'development', false],
    ['s3cre', 's3cret', 'development', false],
  ])('header %j, token %j, env %j → %s', (header, token, env, allowed) => {
    expect(debugErrorAllowed(header, token, env)).toBe(allowed)
  })
})
