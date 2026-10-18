// #213: filling the homepage defaults one locale after the other must not move the other locale's text or any block id.
import { getPayload, type Payload, type TypeWithVersion } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { fillHomeDefaults, type HomeBlock, type HomeMessages } from '@/lib/home/defaults'
import config from '@/payload.config'
import type { Homepage } from '@/payload-types'
import en from '../../messages/en/home.json'
import tr from '../../messages/tr/home.json'

let payload: Payload
// Shared dev DB: the homepage as it was, every locale (same restore as publish-locale.int.spec.ts).
let beforeMain: Homepage
let beforeLatest: TypeWithVersion<Homepage> | undefined

const read = async (locale: 'tr' | 'en') =>
  ((await payload.findGlobal({ slug: 'homepage', locale, fallbackLocale: false, draft: true, depth: 0 })).layout ?? []) as unknown as HomeBlock[]
const write = (locale: 'tr' | 'en', layout: HomeBlock[]) =>
  payload.updateGlobal({ slug: 'homepage', locale, data: { layout: layout as never, _status: 'published' }, depth: 0 })
const noRowIds = (l: HomeBlock[]) => JSON.stringify(l, (k, v) => (k === 'id' ? undefined : v))

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  beforeMain = await payload.findGlobal({ slug: 'homepage', draft: false, depth: 0, locale: 'all' })
  beforeLatest = (await payload.findGlobalVersions({ slug: 'homepage', where: { latest: { equals: true } }, limit: 1, depth: 0, locale: 'all' })).docs[0]
})
afterAll(async () => {
  await payload.db.updateGlobal({ slug: 'homepage', data: beforeMain as unknown as Record<string, unknown> })
  if (beforeLatest) await payload.db.createGlobalVersion({ globalSlug: 'homepage', versionData: beforeLatest.version, autosave: false, createdAt: beforeLatest.createdAt, updatedAt: new Date().toISOString() })
})

describe('homepage defaults, locale by locale', () => {
  it('fills tr then en without touching the other locale or the block ids', async () => {
    // Own fixture (CI starts with no homepage): three sections, empty headings, no steps, the same rows in both locales.
    const rows = [{ blockType: 'services', enabled: true, heading: '' }, { blockType: 'process', enabled: true, heading: '', steps: [] }, { blockType: 'contact', enabled: true, heading: '' }]
    await write('tr', rows as never)
    await write('en', (await read('tr')).map((b) => ({ ...b })))
    const ids = (await read('tr')).map((b) => b.id)
    expect(ids.length).toBeGreaterThan(0)

    const trPlan = fillHomeDefaults(await read('tr'), tr.Home as unknown as HomeMessages).layout
    const enBefore = noRowIds(await read('en'))
    await write('tr', trPlan)
    expect(noRowIds(await read('en'))).toBe(enBefore)
    expect(noRowIds(await read('tr'))).toBe(noRowIds(trPlan))

    const enPlan = fillHomeDefaults(await read('en'), en.Home as unknown as HomeMessages).layout
    await write('en', enPlan)
    expect(noRowIds(await read('tr'))).toBe(noRowIds(trPlan))
    expect(noRowIds(await read('en'))).toBe(noRowIds(enPlan))
    expect((await read('tr')).map((b) => b.id)).toEqual(ids)
    expect((await read('en')).map((b) => b.id)).toEqual(ids)

    const process = (await read('en')).find((b) => b.blockType === 'process') as unknown as { heading: string; steps: { title: string }[] }
    expect(process.heading).toBe('How we work')
    expect(process.steps.map((s) => s.title)).toEqual(Object.values(en.Home.steps).map((s) => s.title))
  })
})
