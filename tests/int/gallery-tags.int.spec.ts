// #171: the gallery reads every tag; 45 product types alone pass a 100-row page once the other axes grow.
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, expect, it } from 'vitest'

import { galleryTagsQuery } from '@/lib/data/gallery'
import config from '@/payload.config'

let payload: Payload
const stamp = Date.now()
const prefix = `e2e-gt-${stamp}`

beforeAll(async () => {
  payload = await getPayload({ config: await config })
})
afterAll(async () => {
  await payload.delete({ collection: 'tags', where: { slug: { like: prefix } }, locale: 'tr' }).catch(() => {})
})

it('returns more than 100 tags', async () => {
  for (let i = 0; i < 101; i++)
    await payload.create({ collection: 'tags', locale: 'tr', data: { name: `E2E GT ${stamp} ${i}`, slug: `${prefix}-${i}`, axis: 'type' }, context: { skipAi: true } })
  const res = await payload.find(galleryTagsQuery('tr'))
  expect(res.docs.filter((d) => d.slug?.startsWith(prefix))).toHaveLength(101)
})
