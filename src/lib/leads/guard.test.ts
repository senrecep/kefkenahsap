import { afterEach, describe, expect, it, vi } from 'vitest'
import { Result } from 'tsentials/result'
import { createFakeDateTimeProvider } from 'tsentials/time'

import { clientIp, createRateLimiter, pickUtm, verifyTurnstile } from './guard'

describe('createRateLimiter (5 per 10 minutes per key)', () => {
  it('allows 5 hits, blocks the 6th, and frees up after the window', () => {
    const clock = createFakeDateTimeProvider(new Date('2026-10-14T10:00:00Z'))
    const limiter = createRateLimiter({ limit: 5, windowMs: 10 * 60_000, clock })
    for (let i = 0; i < 5; i++) expect(limiter.hit('1.2.3.4')).toBe(true)
    expect(limiter.hit('1.2.3.4')).toBe(false)
    expect(limiter.hit('5.6.7.8')).toBe(true)
    clock.advance(10 * 60_000 + 1)
    expect(limiter.hit('1.2.3.4')).toBe(true)
  })

  it('evicts the oldest keys instead of forgetting everyone when full', () => {
    const clock = createFakeDateTimeProvider(new Date('2026-10-14T10:00:00Z'))
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, clock, maxKeys: 2 })
    expect(limiter.hit('a')).toBe(true)
    expect(limiter.hit('b')).toBe(true)
    expect(limiter.hit('c')).toBe(true) // evicts a
    expect(limiter.hit('b')).toBe(false) // b is still remembered and over its limit
    expect(limiter.hit('a')).toBe(true) // a was evicted, starts fresh
  })
})

describe('clientIp', () => {
  const h = (o: Record<string, string>) => new Headers(o)
  it('uses only cf-connecting-ip in production; missing → one shared bucket', () => {
    expect(clientIp(h({ 'cf-connecting-ip': '1.2.3.4', 'x-forwarded-for': '9.9.9.9' }), true)).toBe('1.2.3.4')
    expect(clientIp(h({ 'x-forwarded-for': '9.9.9.9, 8.8.8.8' }), true)).toBe('no-cf')
  })
  it('in development falls back to the last X-Forwarded-For entry (the one our proxy appended)', () => {
    expect(clientIp(h({ 'x-forwarded-for': 'spoofed, 8.8.8.8' }), false)).toBe('8.8.8.8')
    expect(clientIp(h({}), false)).toBe('unknown')
  })
})

describe('verifyTurnstile', () => {
  afterEach(() => vi.unstubAllGlobals())
  const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })

  it('succeeds when Cloudflare says success and sends secret, token and IP', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ success: true }))
    vi.stubGlobal('fetch', fetchMock)
    const r = await verifyTurnstile({ token: 'tok', secret: 'sec', ip: '1.2.3.4' })
    expect(Result.isSuccess(r)).toBe(true)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify')
    expect(JSON.parse(init.body)).toEqual({ secret: 'sec', response: 'tok', remoteip: '1.2.3.4' })
    expect(init.signal).toBeInstanceOf(AbortSignal) // bounded wait (5 s)
  })

  it('fails when Cloudflare rejects the token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ success: false, 'error-codes': ['invalid-input-response'] })))
    const r = await verifyTurnstile({ token: 'bad', secret: 'sec' })
    expect(Result.isFailure(r) && r.errors[0]!.code).toBe('Lead.SpamCheckFailed')
  })

  it('fails without calling Cloudflare when the token or secret is missing', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(Result.isFailure(await verifyTurnstile({ token: '', secret: 'sec' }))).toBe(true)
    expect(Result.isFailure(await verifyTurnstile({ token: 'tok', secret: undefined }))).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails when the network call fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(Result.isFailure(await verifyTurnstile({ token: 'tok', secret: 'sec' }))).toBe(true)
  })

  it('fails closed (no throw) when Cloudflare does not answer within 5 s', async () => {
    vi.useFakeTimers()
    try {
      const hang = (_: unknown, init: RequestInit) => new Promise<Response>((_, rej) => init.signal!.addEventListener('abort', () => rej(init.signal!.reason)))
      vi.stubGlobal('fetch', vi.fn(hang))
      const p = verifyTurnstile({ token: 'tok', secret: 'sec' })
      await vi.advanceTimersByTimeAsync(5000)
      const r = await p
      expect(Result.isFailure(r) && r.errors[0]!.code).toBe('Lead.SpamCheckFailed')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('pickUtm', () => {
  it('keeps only the five standard utm keys, trimmed and capped at 200 chars', () => {
    expect(
      pickUtm({ utm_source: 'gbp', utm_campaign: ['a', 'b'], q: 'x', utm_term: 'y'.repeat(300), utm_medium: undefined, utm_evil: 'x' }),
    ).toEqual({ utm_source: 'gbp', utm_campaign: 'a', utm_term: 'y'.repeat(200) })
  })

  it('strips control characters', () => {
    expect(pickUtm({ utm_source: 'g\u0000b\np\u007f', utm_content: '\t' })).toEqual({ utm_source: 'gbp' })
  })

  it('returns undefined when there is nothing to keep', () => {
    expect(pickUtm({ q: 'x' })).toBeUndefined()
  })
})
