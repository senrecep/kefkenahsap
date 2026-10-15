// #29 search: Turkish folding in SQL, FTS prefix + trigram typo tolerance, public visibility.
import { mkdirSync } from 'fs'
import os from 'os'
import path from 'path'
import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import { getPayload, type Payload } from 'payload'
import sharp from 'sharp'
import { Result } from 'tsentials/result'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { foldText } from '@/lib/search/normalize'
import { normalizeQuery } from '@/lib/search/normalize'
import { GROUPS, matchSql, searchSite, type SearchResults } from '@/lib/search/search'

let payload: Payload
const stamp = Date.now()
const IMG = path.join(os.tmpdir(), 'kefken-search', 'wood.webp')
const cleanup: { collection: 'media' | 'categories' | 'projects' | 'tags' | 'guides'; id: number }[] = []
const ids: Record<string, number> = {}
let pendingStatus: string | null | undefined

const run = async (q: string, locale: 'tr' | 'en' = 'tr'): Promise<SearchResults> => {
  const r = await searchSite(payload, q, locale, { limit: 50 })
  if (!r.ok) throw new Error(JSON.stringify(r.errors))
  return r.value
}
const idsOf = (docs: { id: number }[]) => docs.map((d) => d.id)

beforeAll(async () => {
  mkdirSync(path.dirname(IMG), { recursive: true })
  await sharp({ create: { width: 320, height: 240, channels: 3, background: { r: 120, g: 80, b: 40 } } }).webp().toFile(IMG)
  payload = await getPayload({ config: await config })

  const cat = await payload.create({
    collection: 'categories',
    locale: 'tr',
    data: { name: `Şömine Işıklığı ${stamp}`, shortDesc: 'Pergola ve kamelya işleri', _status: 'published' },
  })
  await payload.update({ collection: 'categories', id: cat.id, locale: 'en', data: { name: `Fireplace Lightbox ${stamp}` } })
  ids.cat = cat.id
  const draft = await payload.create({
    collection: 'categories',
    locale: 'tr',
    data: { name: `Şömine Taslak ${stamp}`, _status: 'draft' },
    draft: true,
  })
  ids.draft = draft.id
  const pending = await payload.create({ collection: 'media', locale: 'tr', data: { alt: 'Bahçede iroko ağacından deck zemin' }, filePath: IMG })
  ids.pending = pending.id
  pendingStatus = pending.status
  const project = await payload.create({
    collection: 'projects',
    locale: 'tr',
    data: { title: `Rıva İskele Projesi ${stamp}`, _status: 'published', cover: pending.id, gallery: [pending.id] },
  })
  // Published category with a newer, unpublished draft: search must see only the published text.
  const edited = await payload.create({ collection: 'categories', locale: 'tr', data: { name: `Yayındaki Ad ${stamp}`, _status: 'published' } })
  await payload.update({ collection: 'categories', id: edited.id, locale: 'tr', data: { name: `Gizli Taslak Ad ${stamp}` }, draft: true })
  ids.edited = edited.id
  ids.project = project.id
  const guide = await payload.create({
    collection: 'guides',
    locale: 'tr',
    data: { title: `Teak bakımı rehberi ${stamp}`, excerpt: 'Tik ahşabın yağlanması ve temizliği', _status: 'published' },
  })
  ids.guide = guide.id
  const draftGuide = await payload.create({ collection: 'guides', locale: 'tr', data: { title: `Teak taslak yazı ${stamp}`, _status: 'draft' }, draft: true })
  ids.draftGuide = draftGuide.id
  // Published guide with a newer, unpublished draft: only the published text is searchable.
  const editedGuide = await payload.create({ collection: 'guides', locale: 'tr', data: { title: `Yayındaki rehber ${stamp}`, _status: 'published' } })
  await payload.update({ collection: 'guides', id: editedGuide.id, locale: 'tr', data: { title: `Gizli rehber taslağı ${stamp}` }, draft: true })
  ids.editedGuide = editedGuide.id
  cleanup.push({ collection: 'guides', id: guide.id }, { collection: 'guides', id: draftGuide.id }, { collection: 'guides', id: editedGuide.id })
  const tag = await payload.create({ collection: 'tags', locale: 'tr', data: { name: `Thermowood ${stamp}`, axis: 'wood' } })
  ids.tag = tag.id
  const approved = await payload.create({ collection: 'media', data: {}, filePath: IMG })
  await payload.update({
    collection: 'media',
    id: approved.id,
    locale: 'tr',
    data: { status: 'approved', title: 'Bahçede ırok deck', alt: 'Bahçede iroko ağacından deck zemin' },
  })
  ids.media = approved.id
  cleanup.push(
    { collection: 'categories', id: edited.id },
    { collection: 'categories', id: cat.id },
    { collection: 'categories', id: draft.id },
    { collection: 'projects', id: project.id },
    { collection: 'tags', id: tag.id },
    { collection: 'media', id: approved.id },
    { collection: 'media', id: pending.id },
  )
})

afterAll(async () => {
  for (const c of cleanup) await payload.delete({ collection: c.collection, id: c.id }).catch(() => {})
})

describe('search_norm (SQL) matches foldText (TS)', () => {
  it.each(['İSTANBUL', 'IŞIK', 'ışık', 'Çiçeklik ve Oturma', 'KÖPRÜ İSKELE', 'Ağaç Güneşlik', 'ß æ ø ł Œ', 'i\u0307stanbul', 'İSTANBUL'.normalize('NFD')])('%s', async (s) => {
    const db = (payload.db as unknown as PostgresAdapter).drizzle
    const res = await db.execute(sql`SELECT search_norm(${s}) AS v`)
    expect(res.rows[0]!.v).toBe(foldText(s))
  })
})

describe('searchSite', () => {
  it('matches Turkish text typed without Turkish letters or in capitals', async () => {
    expect(idsOf((await run('SOMINE ISIKLIGI')).categories)).toContain(ids.cat)
    expect(idsOf((await run('rıva iskele')).projects)).toContain(ids.project)
  })

  it('tolerates typos (pergole → pergola) and matches prefixes', async () => {
    expect(idsOf((await run('pergole')).categories)).toContain(ids.cat)
    expect(idsOf((await run('kamel')).categories)).toContain(ids.cat)
    expect(idsOf((await run('thermowo')).tags)).toContain(ids.tag)
  })

  it('searches both languages and returns docs in the requested locale', async () => {
    const r = await run('fireplace lightbox', 'tr')
    const hit = r.categories.find((c) => c.id === ids.cat)
    expect(hit?.name).toBe(`Şömine Işıklığı ${stamp}`)
  })

  it('returns only approved media and published categories', async () => {
    expect(pendingStatus).toBe('pending')
    const media = idsOf((await run('iroko deck zemin')).media)
    expect(media).toContain(ids.media)
    expect(media).not.toContain(ids.pending)
    expect(idsOf((await run('somine taslak')).categories)).not.toContain(ids.draft)
  })

  it('never exposes pending media through a published project (cover, gallery)', async () => {
    const hit = (await run('riva iskele')).projects.find((p) => p.id === ids.project)
    expect(hit).toBeDefined()
    // Unreadable relations stay unpopulated (bare id): no URL, alt or sizes of the pending image reach the page.
    expect(typeof hit!.cover).not.toBe('object')
    expect((hit!.gallery ?? []).every((m) => typeof m === 'number')).toBe(true)
  })

  it('finds published guides by title and excerpt, never drafts (#147)', async () => {
    expect(idsOf((await run('teak bakimi rehberi')).guides)).toContain(ids.guide)
    expect(idsOf((await run('tik ahsabin yaglanmasi')).guides)).toContain(ids.guide)
    expect(idsOf((await run('teak taslak yazi')).guides)).not.toContain(ids.draftGuide)
  })

  it('a newer guide draft stays unsearchable; the published title is what matches', async () => {
    expect((await run('yayindaki rehber')).guides.find((g) => g.id === ids.editedGuide)?.title).toBe(`Yayındaki rehber ${stamp}`)
    expect(idsOf((await run('gizli rehber taslagi')).guides)).not.toContain(ids.editedGuide)
  })

  it('searches the published version, not a newer draft', async () => {
    const r = await run('yayindaki ad')
    expect(r.categories.find((c) => c.id === ids.edited)?.name).toBe(`Yayındaki Ad ${stamp}`)
    expect(idsOf((await run('gizli taslak ad')).categories)).not.toContain(ids.edited)
  })

  it('uses the expression indexes from the migration (expressions stay in sync)', async () => {
    const db = (payload.db as unknown as PostgresAdapter).drizzle
    const q = normalizeQuery('pergola')
    if (!q.ok) throw new Error('bad query')
    for (const g of GROUPS) {
      const plan = await db.transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL enable_seqscan = off`)
        return tx.execute(sql`EXPLAIN SELECT 1 FROM ${sql.raw(`"${g.table}"`)} l WHERE ${matchSql(g, q.value)}`)
      })
      const text = plan.rows.map((r) => Object.values(r)[0]).join('\n')
      expect(text, g.table).toContain(`${g.table}_search_fts`)
      expect(text, g.table).toContain(`${g.table}_search_trgm`)
    }
  })

  it('fails with a validation error for a too-short query', async () => {
    const r = await searchSite(payload, 'a', 'tr')
    expect(Result.isFailure(r) && r.errors[0]!.code).toBe('Search.QueryTooShort')
  })
})
