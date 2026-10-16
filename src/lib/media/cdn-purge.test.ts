import { describe, expect, it } from 'vitest'
import { Err } from 'tsentials/errors'
import { Result } from 'tsentials/result'

import { createCdnPurger, mediaPublicURLs } from './cdn-purge'

const BASE = 'https://cdn.kefkenahsap.com'

describe('mediaPublicURLs (#185)', () => {
  it('lists the main file and every size, under the prefix', () => {
    const doc = { filename: 'deck.webp', prefix: 'media', sizes: { w320: { filename: 'deck-320x240.webp' }, portrait: { filename: 'deck-400x711.webp' } } }
    expect(mediaPublicURLs(doc, BASE)).toEqual([
      'https://cdn.kefkenahsap.com/media/deck.webp',
      'https://cdn.kefkenahsap.com/media/deck-320x240.webp',
      'https://cdn.kefkenahsap.com/media/deck-400x711.webp',
    ])
  })

  it('skips sizes without a file and repeats, works without a prefix', () => {
    const doc = { filename: 'a.webp', prefix: null, sizes: { w320: { filename: null }, w480: undefined, w1920: { filename: 'a.webp' } } }
    expect(mediaPublicURLs(doc, BASE)).toEqual(['https://cdn.kefkenahsap.com/a.webp'])
  })

  it('returns nothing for a document without a file', () => {
    expect(mediaPublicURLs({ filename: null, sizes: { w320: { filename: 'x.webp' } } }, BASE)).toEqual([])
  })
})

describe('createCdnPurger (#185)', () => {
  const urls = Array.from({ length: 65 }, (_, i) => `${BASE}/f${i}.webp`)

  it('posts the files to the zone in chunks of 30 with the token', async () => {
    const calls: { url: string; body: unknown; auth: unknown }[] = []
    const purge = createCdnPurger({
      zoneId: 'zone1',
      token: 'tok',
      post: async (url, body, init) => {
        calls.push({ url, body, auth: (init.headers as Record<string, string>).Authorization })
        return Result.success({ success: true })
      },
    })
    expect(Result.isSuccess(await purge(urls))).toBe(true)
    expect(calls.map((c) => (c.body as { files: string[] }).files.length)).toEqual([30, 30, 5])
    expect(calls[0]).toMatchObject({ url: 'https://api.cloudflare.com/client/v4/zones/zone1/purge_cache', auth: 'Bearer tok' })
    expect(calls.flatMap((c) => (c.body as { files: string[] }).files)).toEqual(urls)
  })

  it('does nothing for an empty list', async () => {
    let called = false
    const purge = createCdnPurger({ zoneId: 'z', token: 't', post: async () => ((called = true), Result.success({ success: true })) })
    expect(Result.isSuccess(await purge([]))).toBe(true)
    expect(called).toBe(false)
  })

  it('fails with Cloudflare.PurgeFailed on an HTTP error or success:false, still trying every chunk', async () => {
    let n = 0
    const purge = createCdnPurger({
      zoneId: 'z',
      token: 't',
      post: async () => {
        n++
        if (n === 1) return Result.failure(Err.unexpected('Http.Forbidden', '403'))
        if (n === 2) return Result.success({ success: false, errors: [{ code: 10000, message: 'Authentication error' }] })
        return Result.success({ success: true })
      },
    })
    const r = await purge(urls)
    expect(n).toBe(3)
    expect(Result.isFailure(r) && r.errors.map((e) => e.code)).toEqual(['Cloudflare.PurgeFailed', 'Cloudflare.PurgeFailed'])
  })
})
