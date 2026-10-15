// #158: the "Teknik" address fields are admin-only. An editor saving the form must neither change nor wipe them.
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, expect, it } from 'vitest'

import config from '@/payload.config'
import type { SiteSetting } from '@/payload-types'

let payload: Payload
let before: SiteSetting
const editor = { id: 999_158, role: 'editor', collection: 'users' } as never

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  before = await payload.findGlobal({ slug: 'siteSettings', depth: 0, locale: 'tr' })
  await payload.updateGlobal({
    slug: 'siteSettings',
    locale: 'tr',
    data: { address: { ...before.address, lat: 41.2, lng: 28.7, postalCode: '34287' } },
  })
})
afterAll(async () => {
  await payload.updateGlobal({
    slug: 'siteSettings',
    locale: 'tr',
    data: { address: before.address },
  })
})

it('an editor edits the city; lat/lng/postal code stay, and their own changes are ignored', async () => {
  const stored = await payload.findGlobal({ slug: 'siteSettings', depth: 0, locale: 'tr' })
  await payload.updateGlobal({
    slug: 'siteSettings',
    locale: 'tr',
    overrideAccess: false,
    user: editor,
    data: { address: { ...stored.address, city: 'Kocaeli', lat: 1, postalCode: null } },
  })
  const after = await payload.findGlobal({ slug: 'siteSettings', depth: 0, locale: 'tr' })
  expect(after.address?.city).toBe('Kocaeli')
  expect(after.address?.lat).toBe(41.2)
  expect(after.address?.lng).toBe(28.7)
  expect(after.address?.postalCode).toBe('34287')
  expect(after.address?.mapEmbedUrl).toBe(stored.address?.mapEmbedUrl)
})

it('an editor sending only the city (a partial address) keeps the technical fields too', async () => {
  const stored = await payload.findGlobal({ slug: 'siteSettings', depth: 0, locale: 'tr' })
  await payload.updateGlobal({
    slug: 'siteSettings',
    locale: 'tr',
    overrideAccess: false,
    user: editor,
    data: { address: { city: 'Sakarya' } },
  })
  const after = await payload.findGlobal({ slug: 'siteSettings', depth: 0, locale: 'tr' })
  expect(after.address?.city).toBe('Sakarya')
  expect(after.address?.lat).toBe(41.2)
  expect(after.address?.lng).toBe(28.7)
  expect(after.address?.postalCode).toBe('34287')
  expect(after.address?.mapEmbedUrl).toBe(stored.address?.mapEmbedUrl)
  expect(after.address?.appleMapsUrl).toBe(stored.address?.appleMapsUrl)
})
