// #183: approving a photo attaches the existing tags its tagImage suggestion names (add-only).
import { mkdirSync } from 'fs'
import os from 'os'
import path from 'path'
import { getPayload, type Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, expect, it } from 'vitest'

import config from '@/payload.config'

let payload: Payload
const stamp = Date.now()
const prefix = `int-at-${stamp}`
const IMG = path.join(os.tmpdir(), 'kefken-approve-tags', 'a.webp')
const media: number[] = []
const tag: Record<string, number> = {}

const suggestion = (version = 'tagImage@3') => ({
  promptVersion: version,
  tags: { type: [`ZZ DECK ${stamp}`, `Yok ${stamp}`], wood: [`zz iroko ${stamp}`], setting: [`Zz Bahçe ${stamp}`], finish: [], stage: ['finished'] },
})
const create = async (data: Record<string, unknown>) => {
  const doc = await payload.create({ collection: 'media', locale: 'tr', data: { alt: 'Ahşap deck', ...data }, filePath: IMG, context: { skipAi: true } })
  media.push(doc.id)
  return doc.id
}
const byId = (a: number, b: number) => a - b
const tagsOf = async (id: number) => ((await payload.findByID({ collection: 'media', id, depth: 0 })).tags ?? []) as number[]

beforeAll(async () => {
  mkdirSync(path.dirname(IMG), { recursive: true })
  await sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 90, g: 80, b: 60 } } }).webp().toFile(IMG)
  payload = await getPayload({ config: await config })
  const tags: [string, string, string][] = [
    ['deck', 'type', `Zz Deck ${stamp}`],
    ['iroko', 'wood', `Zz İroko ${stamp}`],
    ['teak', 'wood', `Zz Teak ${stamp}`],
    ['bahce', 'setting', `Zz Bahçe ${stamp}`],
  ]
  for (const [key, axis, name] of tags)
    tag[key] = (await payload.create({ collection: 'tags', locale: 'tr', data: { name, slug: `${prefix}-${key}`, axis: axis as 'type' } })).id
})
afterAll(async () => {
  for (const id of media) await payload.delete({ collection: 'media', id }).catch(() => {})
  await payload.delete({ collection: 'tags', where: { slug: { like: prefix } }, locale: 'tr' }).catch(() => {})
})

it('attaches the suggested tags that exist on approval, keeping the editor tags and a filled single-value axis', async () => {
  const id = await create({ status: 'pending', aiSuggestion: suggestion(), tags: [tag.teak!] })
  await payload.update({ collection: 'media', id, locale: 'tr', data: { status: 'approved' } })
  expect((await tagsOf(id)).sort(byId)).toEqual([tag.teak!, tag.deck!, tag.bahce!].sort(byId))
})

it('works for a bulk approve and leaves a pre-tagImage@2 suggestion alone', async () => {
  const fresh = await create({ status: 'hidden', aiSuggestion: suggestion() })
  const old = await create({ status: 'pending', aiSuggestion: suggestion('tagImage@1') })
  await payload.update({ collection: 'media', where: { id: { in: [fresh, old] } }, locale: 'tr', data: { status: 'approved' } })
  expect((await tagsOf(fresh)).sort(byId)).toEqual([tag.deck!, tag.iroko!, tag.bahce!].sort(byId))
  expect(await tagsOf(old)).toEqual([])
})

it('does not touch an already approved photo on an unrelated edit', async () => {
  const id = await create({ status: 'approved', aiSuggestion: suggestion() })
  await payload.update({ collection: 'media', id, locale: 'tr', data: { title: 'Yeni başlık' } })
  expect(await tagsOf(id)).toEqual([])
})
