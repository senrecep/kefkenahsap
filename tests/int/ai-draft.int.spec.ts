// #56 "AI ile taslak" against the fake model (AI_FAKE_PROVIDER=1): always a draft version, never published,
// only empty fields, facts limited to notes + photo captions + site settings.
import { mkdirSync } from 'fs'
import os from 'os'
import path from 'path'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import sharp from 'sharp'
import { Result } from 'tsentials/result'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { draftDocument } from '@/ai/draft/run'
import { fakeCalls } from '@/ai/fake'

const stamp = Date.now()
let payload: Payload
let req: PayloadRequest
const cleanup: { collection: 'guides' | 'projects' | 'media' | 'users'; id: number }[] = []
const settings = () => payload.findGlobal({ slug: 'aiSettings' })

beforeAll(async () => {
  const { default: config } = await import('@/payload.config')
  payload = await getPayload({ config: await config })
  const editor = await payload.create({ collection: 'users', data: { email: `ai-dr-${stamp}@test.local`, password: 'x-strong-pass', name: 'Editör', role: 'editor' } })
  cleanup.push({ collection: 'users', id: editor.id })
  req = await createLocalReq({ user: { ...editor, collection: 'users' } }, payload)
  await payload.updateGlobal({ slug: 'aiSettings', data: { monthlyBudgetUsd: 1000 } })
})
afterAll(async () => {
  for (const c of cleanup.reverse()) {
    await payload.delete({ collection: 'ai-usage', where: { docRef: { equals: `${c.collection}:${c.id}` } } }).catch(() => {})
    await payload.delete({ collection: c.collection, id: c.id }).catch(() => {})
  }
  await payload.updateGlobal({ slug: 'aiSettings', data: { monthlyBudgetUsd: 10 } })
})

describe('draftDocument (#56)', () => {
  it('writes a guide body + excerpt as a draft version; the published version is untouched', async () => {
    const g = await payload.create({ collection: 'guides', locale: 'tr', data: { title: `Taslak rehber ${stamp}`, _status: 'published' } })
    cleanup.push({ collection: 'guides', id: g.id })

    const r = await draftDocument({ payload, req, collection: 'guides', id: g.id, notes: ['Deck yılda bir yağlanır', 'Önce yıkanır'], mediaIds: [], settings: await settings() })
    expect(Result.isSuccess(r)).toBe(true)

    const draft = await payload.findByID({ collection: 'guides', id: g.id, locale: 'tr', draft: true })
    expect(draft._status).toBe('draft')
    expect(draft.excerpt).toBe(`Taslak: Taslak rehber ${stamp}`)
    expect(JSON.stringify(draft.body)).toContain('Deck yılda bir yağlanır')

    const published = await payload.findByID({ collection: 'guides', id: g.id, locale: 'tr', draft: false })
    expect(published._status).toBe('published')
    expect(published.body ?? null).toBeNull()
    expect(published.excerpt ?? null).toBeNull()
    const versions = await payload.findVersions({ collection: 'guides', where: { parent: { equals: g.id } }, sort: '-updatedAt', limit: 1 })
    expect(versions.docs[0]?.version._status).toBe('draft')
  })

  it('tells the model only the notes, photo captions and filled site settings', () => {
    const last = fakeCalls.filter((c) => c.task === 'draftGuide').at(-1)
    expect(last?.system).toContain('Bilinen olgular (Site Bilgileri)')
    expect(last?.system).toContain('Firma adı:')
    expect(last?.system).toContain('Bunların dışında hiçbir olgu ekleme')
  })

  it('project story: captions only from this project’s own approved photos; draftProjectStory chain', async () => {
    const img = path.join(os.tmpdir(), 'kefken-ai', `draft-${stamp}.webp`)
    mkdirSync(path.dirname(img), { recursive: true })
    await sharp({ create: { width: 400, height: 300, channels: 3, background: { r: 150, g: 110, b: 70 } } }).webp().toFile(img)
    const photo = async (caption: string, status: 'approved' | 'pending') => {
      const m = await payload.create({ collection: 'media', locale: 'tr', data: { caption, alt: `Alt ${caption}`, status }, filePath: img, context: { skipAi: true } })
      cleanup.push({ collection: 'media', id: m.id })
      return m.id
    }
    const own = await photo('Havuz kenarında iroko deck', 'approved')
    const pending = await photo('Onaylanmamış açıklama', 'pending')
    const foreign = await photo('Başka projenin fotoğrafı', 'approved')
    const p = await payload.create({ collection: 'projects', locale: 'tr', data: { title: `Taslak proje ${stamp}`, gallery: [own, pending] } })
    cleanup.push({ collection: 'projects', id: p.id })

    const r = await draftDocument({ payload, req, collection: 'projects', id: p.id, notes: ['Riva', '40 m² deck'], mediaIds: [own, pending, foreign], settings: await settings() })
    expect(Result.isSuccess(r) && r.value.model).toBe('anthropic/claude-sonnet-5.5')
    const draft = await payload.findByID({ collection: 'projects', id: p.id, locale: 'tr', draft: true })
    expect(draft._status).toBe('draft')
    const story = JSON.stringify(draft.story)
    expect(story).toContain('Fotoğraflar: Havuz kenarında iroko deck')
    expect(story).not.toContain('Onaylanmamış açıklama')
    expect(story).not.toContain('Başka projenin fotoğrafı')
    const usage = await payload.find({ collection: 'ai-usage', where: { docRef: { equals: `projects:${p.id}` } } })
    expect(usage.docs.map((d) => d.task)).toEqual(['draftProjectStory'])
  })

  it('never overwrites text a person wrote: a filled body is refused before any model call', async () => {
    const g = await payload.create({ collection: 'guides', locale: 'tr', data: { title: `Dolu ${stamp}` } })
    cleanup.push({ collection: 'guides', id: g.id })
    await payload.update({
      collection: 'guides',
      id: g.id,
      locale: 'tr',
      data: { body: { root: { type: 'root', format: '', indent: 0, version: 1, direction: null, children: [{ type: 'paragraph', format: '', indent: 0, version: 1, direction: null, children: [{ type: 'text', text: 'Elle yazıldı', format: 0, mode: 'normal', style: '', detail: 0, version: 1 }] }] } } as never },
    })
    const calls = fakeCalls.length
    const r = await draftDocument({ payload, req, collection: 'guides', id: g.id, notes: ['x'], mediaIds: [], settings: await settings() })
    expect(Result.isFailure(r) && r.errors[0]?.code).toBe('Draft.NotEmpty')
    expect(fakeCalls.length).toBe(calls)
  })
})
