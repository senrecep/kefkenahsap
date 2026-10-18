// #64: a photo shown in a locale without its own alt text gets the default locale's (image links need a name).
import { mkdirSync } from 'fs'
import os from 'os'
import path from 'path'
import { getPayload, type Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, expect, it } from 'vitest'

import { markFallbackAlt, withDefaultAlt } from '@/lib/data/media-alt'
import config from '@/payload.config'

let payload: Payload
const ids: number[] = []
const IMG = path.join(os.tmpdir(), 'kefken-media-alt', 'a.webp')

beforeAll(async () => {
  mkdirSync(path.dirname(IMG), { recursive: true })
  await sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 90, g: 80, b: 60 } } }).webp().toFile(IMG)
  payload = await getPayload({ config: await config })
})
afterAll(async () => {
  for (const id of ids) await payload.delete({ collection: 'media', id }).catch(() => {})
})

it('fills only empty alt text, from the default locale; a translated alt and the default locale stay as they are', async () => {
  const create = async (alt: string) => (await payload.create({ collection: 'media', locale: 'tr', data: { alt }, filePath: IMG, context: { skipAi: true } })).id
  const [untranslated, translated] = [await create('Ahşap deck'), await create('Pergola')]
  ids.push(untranslated, translated)
  await payload.update({ collection: 'media', id: translated, locale: 'de', data: { alt: 'Pergola (de)' } })
  const read = async (locale: 'de' | 'tr') =>
    (await payload.find({ collection: 'media', locale, fallbackLocale: false, where: { id: { in: ids } }, sort: 'id', depth: 0 })).docs

  const de = await withDefaultAlt(payload, 'de', await read('de'))
  expect(de.map((m) => [m.alt, m.altLang])).toEqual([['Ahşap deck', 'tr'], ['Pergola (de)', undefined]])

  // A fallback read (the gallery's) already carries the Turkish text: only the marking is added.
  const fallback = (await payload.find({ collection: 'media', locale: 'de', fallbackLocale: 'tr', where: { id: { in: ids } }, sort: 'id', depth: 0 })).docs
  expect((await markFallbackAlt(payload, 'de', fallback)).map((m) => [m.alt, m.altLang])).toEqual([['Ahşap deck', 'tr'], ['Pergola (de)', undefined]])
  const tr = await read('tr')
  expect(await withDefaultAlt(payload, 'tr', tr)).toBe(tr)
})
