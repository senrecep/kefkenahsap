// #55 "AI ile çevir" against the fake model (AI_FAKE_PROVIDER=1): missing locales only, Lexical structure kept, glossary
// in the prompt, saved as a draft version, gated by auth / rate limit / budget.
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import { Result } from 'tsentials/result'
import { SystemDateTimeProvider } from 'tsentials/time'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { fakeCalls } from '@/ai/fake'
import { aiGate } from '@/ai/guard'
import { translateDocument } from '@/ai/translate/run'
import { routing } from '@/i18n/routing'
import { createRateLimiter } from '@/lib/leads/guard'
import type { User } from '@/payload-types'

const stamp = Date.now()
const text = (t: string, format = 0) => ({ mode: 'normal', text: t, type: 'text', style: '', detail: 0, format, version: 1 })
const body = {
  root: {
    type: 'root', format: '', indent: 0, version: 1, direction: null,
    children: [
      { tag: 'h2', type: 'heading', format: '', indent: 0, version: 1, direction: null, children: [text('Kamelya bakımı')] },
      {
        type: 'paragraph', format: '', indent: 0, version: 1, direction: null, textFormat: 0,
        children: [text('Emprenyeli çam '), text('her yıl', 1), text(' yağlanır.')],
      },
      { tag: 'ul', type: 'list', start: 1, listType: 'bullet', format: '', indent: 0, version: 1, direction: null, children: [
        { type: 'listitem', value: 1, format: '', indent: 0, version: 1, direction: null, children: [text('Zımpara')] },
      ] },
    ],
  },
}
const skeleton = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(skeleton) : v && typeof v === 'object'
    ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'text' ? '<t>' : skeleton(x)]))
    : v

let payload: Payload
let editor: User
let req: PayloadRequest
const cleanup: { collection: 'guides' | 'categories' | 'pages' | 'users' | 'ai-usage'; id: number }[] = []

beforeAll(async () => {
  const { default: config } = await import('@/payload.config')
  payload = await getPayload({ config: await config })
  editor = await payload.create({ collection: 'users', data: { email: `ai-tr-${stamp}@test.local`, password: 'x-strong-pass', name: 'Editör', role: 'editor' } })
  cleanup.push({ collection: 'users', id: editor.id })
  req = await createLocalReq({ user: { ...editor, collection: 'users' } }, payload)
  await payload.updateGlobal({ slug: 'aiSettings', data: { monthlyBudgetUsd: 1000, translate: [], glossary: [{ tr: 'kamelya', en: 'garden gazebo' }] } })
})
afterAll(async () => {
  const usage = await payload.find({ collection: 'ai-usage', where: { docRef: { contains: `-${stamp}` } }, pagination: false })
  for (const c of [...cleanup.reverse(), ...usage.docs.map((d) => ({ collection: 'ai-usage' as const, id: d.id }))])
    await payload.delete({ collection: c.collection, id: c.id }).catch(() => {})
  await payload.updateGlobal({ slug: 'aiSettings', data: { monthlyBudgetUsd: 10, glossary: [] } })
})

describe('translateDocument (#55)', () => {
  it('fills the missing EN locale as a draft; the published version and TR stay as they were', async () => {
    const g = await payload.create({
      collection: 'guides',
      locale: 'tr',
      data: { title: `Kamelya rehberi ${stamp}`, excerpt: 'Yılda bir yağlayın.', body: body as never, faq: [{ q: 'Ne sıklıkla?', a: 'Yılda bir.' }], _status: 'published' },
    })
    cleanup.push({ collection: 'guides', id: g.id })
    const settings = await payload.findGlobal({ slug: 'aiSettings' })

    const r = await translateDocument({ payload, req, collection: 'guides', id: g.id, settings, remainingUsd: 1000 })
    // Every locale but the TR source is missing (EN, plus RU/DE/… as they are added).
    expect(Result.isSuccess(r) && r.value.locales).toEqual(routing.locales.filter((l) => l !== 'tr'))

    const enDraft = await payload.findByID({ collection: 'guides', id: g.id, locale: 'en', fallbackLocale: false, draft: true })
    expect(enDraft._status).toBe('draft')
    expect(enDraft.title).toBe(`[EN] Kamelya rehberi ${stamp}`)
    expect(enDraft.slug).toBe(`en-kamelya-rehberi-${stamp}`) // the slug hook follows the translated title
    expect(enDraft.excerpt).toBe('[EN] Yılda bir yağlayın.')
    expect(enDraft.faq?.map(({ q, a }) => ({ q, a }))).toEqual([{ q: '[EN] Ne sıklıkla?', a: '[EN] Yılda bir.' }])
    expect(skeleton(enDraft.body)).toEqual(skeleton(body))
    expect(JSON.stringify(enDraft.body)).toContain('"text":"[EN] her yıl"')
    expect(JSON.stringify(enDraft.body)).toContain('"text":" [EN] yağlanır."') // edge space between nodes kept

    const enPublished = await payload.findByID({ collection: 'guides', id: g.id, locale: 'en', fallbackLocale: false, draft: false })
    expect(enPublished.title ?? null).toBeNull()
    const trDraft = await payload.findByID({ collection: 'guides', id: g.id, locale: 'tr', fallbackLocale: false, draft: true })
    expect(trDraft.title).toBe(`Kamelya rehberi ${stamp}`)
    expect(trDraft.body).toEqual(body)

    const usage = await payload.find({ collection: 'ai-usage', where: { docRef: { equals: `guides:${g.id}` } } })
    expect(usage.docs.map((d) => [d.task, d.ok])).toEqual([['translate', true]])
  })

  it('tells the model the admin glossary (it replaces the §8 default)', () => {
    const last = fakeCalls.filter((c) => c.task === 'translate').at(-1)
    expect(last?.system).toContain('kamelya = garden gazebo')
    expect(last?.system).not.toContain('pressure-treated pine')
  })

  it('nothing missing → a clear error and no model call', async () => {
    const g = await payload.create({ collection: 'guides', locale: 'tr', data: { title: `Tam ${stamp}` } })
    cleanup.push({ collection: 'guides', id: g.id })
    for (const locale of routing.locales.filter((l) => l !== 'tr')) {
      await payload.update({ collection: 'guides', id: g.id, locale, data: { title: `Full ${locale} ${stamp}` } })
    }
    const calls = fakeCalls.length
    const r = await translateDocument({ payload, req, collection: 'guides', id: g.id, settings: await payload.findGlobal({ slug: 'aiSettings' }), remainingUsd: 1000 })
    expect(Result.isFailure(r) && r.errors[0]?.code).toBe('Translate.NothingMissing')
    expect(fakeCalls.length).toBe(calls)
  })

  it('categories: the name decides the missing locale, groups keep their other values', async () => {
    const c = await payload.create({
      collection: 'categories',
      locale: 'tr',
      data: { name: `Kamelya ${stamp}`, shortDesc: 'Bahçe için kamelya.', priceGuide: { min: 100, note: 'Ölçüye göre değişir.' } },
    })
    cleanup.push({ collection: 'categories', id: c.id })
    const r = await translateDocument({ payload, req, collection: 'categories', id: c.id, settings: await payload.findGlobal({ slug: 'aiSettings' }), remainingUsd: 1000 })
    expect(Result.isSuccess(r)).toBe(true)
    const en = await payload.findByID({ collection: 'categories', id: c.id, locale: 'en', fallbackLocale: false, draft: true })
    expect(en.name).toBe(`[EN] Kamelya ${stamp}`)
    expect(en.priceGuide?.note).toBe('[EN] Ölçüye göre değişir.')
    expect(en.priceGuide?.min).toBe(100)
  })
})

describe('translateDocument refuses before any model call', () => {
  const longBody = (n: number) => ({
    root: { type: 'root', format: '', indent: 0, version: 1, direction: null, children: Array.from({ length: n }, () => ({
      type: 'paragraph', format: '', indent: 0, version: 1, direction: null, textFormat: 0, children: [text('a'.repeat(1000))],
    })) },
  })

  it('more than 20k source characters → Translate.TooLong', async () => {
    const p = await payload.create({ collection: 'pages', locale: 'tr', data: { title: `Uzun ${stamp}`, body: longBody(21) as never } })
    cleanup.push({ collection: 'pages', id: p.id })
    const calls = fakeCalls.length
    const r = await translateDocument({ payload, req, collection: 'pages', id: p.id, settings: await payload.findGlobal({ slug: 'aiSettings' }), remainingUsd: 1000 })
    expect(Result.isFailure(r) && r.errors[0]?.code).toBe('Translate.TooLong')
    expect(fakeCalls.length).toBe(calls)
  })

  it('estimated cost above the remaining budget → AI.BudgetInsufficient', async () => {
    const p = await payload.create({ collection: 'pages', locale: 'tr', data: { title: `Bütçe ${stamp}`, body: longBody(5) as never } })
    cleanup.push({ collection: 'pages', id: p.id })
    const calls = fakeCalls.length
    const r = await translateDocument({ payload, req, collection: 'pages', id: p.id, settings: await payload.findGlobal({ slug: 'aiSettings' }), remainingUsd: 0.001 })
    expect(Result.isFailure(r) && r.errors[0]?.code).toBe('AI.BudgetInsufficient')
    expect(fakeCalls.length).toBe(calls)
  })

  it('a record the user cannot see → Translate.NotFound', async () => {
    const r = await translateDocument({ payload, req, collection: 'guides', id: 999_999_999, settings: await payload.findGlobal({ slug: 'aiSettings' }), remainingUsd: 1000 })
    expect(Result.isFailure(r) && r.errors[0]?.code).toBe('Translate.NotFound')
  })
})

describe('aiGate: who may press the AI buttons', () => {
  const limiter = () => createRateLimiter({ limit: 2, windowMs: 60_000, clock: SystemDateTimeProvider })

  it('rejects a request without a signed-in staff user', async () => {
    const anon = await createLocalReq({}, payload)
    const r = await aiGate(payload, anon, limiter())
    expect(Result.isFailure(r) && r.errors[0]?.code).toBe('Auth.Required')
  })

  it('rate-limits per user', async () => {
    const l = limiter()
    expect(Result.isSuccess(await aiGate(payload, req, l))).toBe(true)
    expect(Result.isSuccess(await aiGate(payload, req, l))).toBe(true)
    const third = await aiGate(payload, req, l)
    expect(Result.isFailure(third) && third.errors[0]?.code).toBe('AI.RateLimited')
  })

  it('stops when the monthly budget is used up', async () => {
    await payload.updateGlobal({ slug: 'aiSettings', data: { monthlyBudgetUsd: 0 } })
    try {
      const r = await aiGate(payload, req, limiter())
      expect(Result.isFailure(r) && r.errors[0]?.code).toBe('AI.BudgetExceeded')
    } finally {
      await payload.updateGlobal({ slug: 'aiSettings', data: { monthlyBudgetUsd: 1000 } })
    }
  })
})
