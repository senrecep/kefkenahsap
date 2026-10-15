// #158: the admin's main button publishes only the language on screen (localization.defaultLocalePublishOption 'active'
// → Payload's publishSpecificLocale). An AI translation saved as a draft must not go live when Turkish is published.
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'

let payload: Payload
const stamp = Date.now()
const ids: number[] = []

beforeAll(async () => {
  payload = await getPayload({ config: await config })
})
afterAll(async () => {
  for (const id of ids) await payload.delete({ collection: 'guides', id }).catch(() => {})
})

const read = (id: number, locale: 'tr' | 'en', draft: boolean) =>
  payload.findByID({ collection: 'guides', id, locale, fallbackLocale: false, draft, depth: 0 })

describe('publish one language', () => {
  it('the admin defaults to publishing the active locale', async () => {
    const { localization } = await config
    expect(localization && localization.defaultLocalePublishOption).toBe('active')
  })

  it('publishing TR leaves an EN draft unpublished (already-published doc)', async () => {
    const g = await payload.create({ collection: 'guides', locale: 'tr', data: { title: `Yayın TR ${stamp}`, _status: 'published' } })
    ids.push(g.id)
    await payload.update({ collection: 'guides', id: g.id, locale: 'en', draft: true, data: { title: `[EN] Draft ${stamp}` } })

    await payload.update({ collection: 'guides', id: g.id, locale: 'tr', publishSpecificLocale: 'tr', data: { excerpt: 'Yeni giriş', _status: 'published' } })

    expect((await read(g.id, 'tr', false)).excerpt).toBe('Yeni giriş')
    expect((await read(g.id, 'en', false)).title ?? null).toBeNull()
    expect((await read(g.id, 'en', true)).title).toBe(`[EN] Draft ${stamp}`)
  })

  it('first publish of TR on a never-published doc does not publish its EN draft', async () => {
    const g = await payload.create({ collection: 'guides', locale: 'tr', draft: true, data: { title: `Taslak TR ${stamp}` } })
    ids.push(g.id)
    await payload.update({ collection: 'guides', id: g.id, locale: 'en', draft: true, data: { title: `[EN] First ${stamp}` } })

    await payload.update({ collection: 'guides', id: g.id, locale: 'tr', publishSpecificLocale: 'tr', data: { _status: 'published' } })

    const tr = await read(g.id, 'tr', false)
    expect(tr._status).toBe('published')
    expect(tr.title).toBe(`Taslak TR ${stamp}`)
    expect((await read(g.id, 'en', false)).title ?? null).toBeNull()
  })
})
