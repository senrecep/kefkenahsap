// #158: the admin's main button publishes only the language on screen (localization.defaultLocalePublishOption 'active'
// → Payload's publishSpecificLocale). An AI translation saved as a draft must not go live when Turkish is published.
import { getPayload, type Payload, type TypeWithVersion } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import type { Homepage } from '@/payload-types'

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
    const g = await payload.create({
      collection: 'guides',
      locale: 'tr',
      data: { title: `Yayın TR ${stamp}`, _status: 'published' },
    })
    ids.push(g.id)
    await payload.update({
      collection: 'guides',
      id: g.id,
      locale: 'en',
      draft: true,
      data: { title: `[EN] Draft ${stamp}` },
    })

    await payload.update({
      collection: 'guides',
      id: g.id,
      locale: 'tr',
      publishSpecificLocale: 'tr',
      data: { excerpt: 'Yeni giriş', _status: 'published' },
    })

    expect((await read(g.id, 'tr', false)).excerpt).toBe('Yeni giriş')
    expect((await read(g.id, 'en', false)).title ?? null).toBeNull()
    expect((await read(g.id, 'en', true)).title).toBe(`[EN] Draft ${stamp}`)
  })

  it('first publish of TR on a never-published doc does not publish its EN draft', async () => {
    const g = await payload.create({
      collection: 'guides',
      locale: 'tr',
      draft: true,
      data: { title: `Taslak TR ${stamp}` },
    })
    ids.push(g.id)
    await payload.update({
      collection: 'guides',
      id: g.id,
      locale: 'en',
      draft: true,
      data: { title: `[EN] First ${stamp}` },
    })

    await payload.update({
      collection: 'guides',
      id: g.id,
      locale: 'tr',
      publishSpecificLocale: 'tr',
      data: { _status: 'published' },
    })

    const tr = await read(g.id, 'tr', false)
    expect(tr._status).toBe('published')
    expect(tr.title).toBe(`Taslak TR ${stamp}`)
    expect((await read(g.id, 'en', false)).title ?? null).toBeNull()
  })
})

describe('publish one language: the edges', () => {
  it('a live EN with a newer EN draft: publishing TR keeps the live EN text, the draft stays a draft', async () => {
    const g = await payload.create({
      collection: 'guides',
      locale: 'tr',
      data: { title: `Canlı TR ${stamp}`, _status: 'published' },
    })
    ids.push(g.id)
    await payload.update({
      collection: 'guides',
      id: g.id,
      locale: 'en',
      data: { title: `Live EN ${stamp}`, _status: 'published' },
    })
    await payload.update({
      collection: 'guides',
      id: g.id,
      locale: 'en',
      draft: true,
      data: { title: `Newer EN draft ${stamp}` },
    })

    await payload.update({
      collection: 'guides',
      id: g.id,
      locale: 'tr',
      publishSpecificLocale: 'tr',
      data: { excerpt: 'TR düzeltme', _status: 'published' },
    })

    expect((await read(g.id, 'en', false)).title).toBe(`Live EN ${stamp}`)
    expect((await read(g.id, 'en', true)).title).toBe(`Newer EN draft ${stamp}`)
  })

  it('the public read path (no user, published only) sees TR but not the EN draft', async () => {
    const g = await payload.create({
      collection: 'guides',
      locale: 'tr',
      data: { title: `Halka açık ${stamp}`, _status: 'published' },
    })
    ids.push(g.id)
    await payload.update({
      collection: 'guides',
      id: g.id,
      locale: 'en',
      draft: true,
      data: { title: `[EN] Public ${stamp}` },
    })
    await payload.update({
      collection: 'guides',
      id: g.id,
      locale: 'tr',
      publishSpecificLocale: 'tr',
      data: { _status: 'published' },
    })

    const pub = (locale: 'tr' | 'en') =>
      payload.find({
        collection: 'guides',
        locale,
        fallbackLocale: false,
        draft: false,
        overrideAccess: false,
        depth: 0,
        where: { id: { equals: g.id } },
      })
    expect((await pub('tr')).docs[0]?.title).toBe(`Halka açık ${stamp}`)
    expect((await pub('en')).docs[0]?.title ?? null).toBeNull()
  })

  it('only the homepage has per-language fields inside shared rows/sections (merged by position on a one-language publish)', async () => {
    type F = {
      type: string
      name?: string
      localized?: boolean
      fields?: F[]
      blocks?: { fields: F[] }[]
      tabs?: { fields: F[] }[]
    }
    const hits = (fields: F[], inShared: boolean): boolean =>
      fields.some((f) => {
        if ((f.type === 'array' || f.type === 'blocks') && !f.localized)
          return hits(f.fields ?? (f.blocks ?? []).flatMap((b) => b.fields), true)
        if (f.localized) return inShared
        if (f.tabs) return f.tabs.some((t) => hits(t.fields, inShared))
        return f.fields ? hits(f.fields, inShared) : false
      })
    const c = await config
    const risky = [...c.collections, ...c.globals]
      .filter((e) => e.versions && e.versions.drafts && hits(e.fields as F[], false))
      .map((e) => e.slug)
    expect(risky).toEqual(['homepage'])
  })
})

describe('homepage always publishes every language', () => {
  // Shared dev DB: restore the published homepage and its latest version exactly (db-level, every locale), as home-access does.
  let beforeMain: Homepage
  let beforeLatest: TypeWithVersion<Homepage> | undefined
  const readHome = (locale: 'tr' | 'en', draft = false) =>
    payload.findGlobal({ slug: 'homepage', locale, fallbackLocale: false, draft, depth: 0 })
  const headings = (layout: Homepage['layout']) =>
    (layout ?? []).map((b) => `${b.blockType}:${'heading' in b ? (b.heading ?? '') : ''}`)

  beforeAll(async () => {
    beforeMain = await payload.findGlobal({
      slug: 'homepage',
      draft: false,
      depth: 0,
      locale: 'all',
    })
    beforeLatest = (
      await payload.findGlobalVersions({
        slug: 'homepage',
        where: { latest: { equals: true } },
        limit: 1,
        depth: 0,
        locale: 'all',
      })
    ).docs[0]
  })
  afterAll(async () => {
    await payload.db.updateGlobal({
      slug: 'homepage',
      data: beforeMain as unknown as Record<string, unknown>,
    })
    if (beforeLatest)
      await payload.db.createGlobalVersion({
        globalSlug: 'homepage',
        versionData: beforeLatest.version,
        autosave: false,
        createdAt: beforeLatest.createdAt,
        updatedAt: new Date().toISOString(),
      })
  })

  it('reordering sections then publishing from TR keeps each EN heading on its own section', async () => {
    await payload.updateGlobal({
      slug: 'homepage',
      locale: 'tr',
      data: {
        layout: [
          { blockType: 'services', heading: 'Hizmetler' },
          { blockType: 'faq', heading: 'SSS' },
        ],
        _status: 'published',
      },
    })
    const live = await readHome('tr')
    await payload.updateGlobal({
      slug: 'homepage',
      locale: 'en',
      data: {
        layout: live.layout!.map((b) => ({
          ...b,
          heading: b.blockType === 'services' ? 'Services' : 'FAQ',
        })) as Homepage['layout'],
        _status: 'published',
      },
    })
    expect(headings((await readHome('en')).layout)).toEqual(['services:Services', 'faq:FAQ'])

    // Editor drags FAQ above Services and presses the (single-language) publish button.
    const draft = await readHome('tr', true)
    await payload.updateGlobal({
      slug: 'homepage',
      locale: 'tr',
      publishSpecificLocale: 'tr',
      data: { layout: [...draft.layout!].reverse(), _status: 'published' },
    })

    expect(headings((await readHome('tr')).layout)).toEqual(['faq:SSS', 'services:Hizmetler'])
    expect(headings((await readHome('en')).layout)).toEqual(['faq:FAQ', 'services:Services'])
  })
})
