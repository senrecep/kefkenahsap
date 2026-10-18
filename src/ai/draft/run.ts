import type { Payload, PayloadRequest } from 'payload'
import { Err } from 'tsentials/errors'
import { Result } from 'tsentials/result'

import type { AiSetting } from '@/payload-types'
import { aiModel, resolveChain } from '../models'
import { DRAFT_PROMPT_VERSION, draftInput, draftSystem, GuideDraftSchema, StoryDraftSchema } from '../prompts/draft'
import { failureUsage, runStructured } from '../run'
import { allowedPhotoIds, DRAFT_BODY, DRAFT_TASKS, draftData, draftUpdateArgs, siteFacts, type DraftCollection } from './draft'

const MAX_PHOTOS = 12
const hasText = (v: unknown): boolean =>
  !!v && typeof v === 'object' && (('text' in v && typeof v.text === 'string' && v.text.trim() !== '') || Object.values(v).some(hasText))

/**
 * "AI ile taslak": title + the editor's notes (+ captions of chosen photos) → a Turkish draft of the guide body/excerpt or
 * the project story. Writes only empty fields and only as a draft version (draftUpdateArgs); never publishes.
 */
export async function draftDocument(a: {
  payload: Payload
  req: PayloadRequest
  collection: DraftCollection
  id: number | string
  notes: string[]
  mediaIds: number[]
  settings: AiSetting
}): Promise<Result<{ model: string; promptVersion: string }>> {
  const { payload, req, collection, id } = a
  const doc = await payload
    .findByID({ collection, id, locale: 'tr', fallbackLocale: false, draft: true, depth: 0, req, overrideAccess: false })
    .catch(() => null)
  if (!doc) return Result.failure(Err.notFound('Draft.NotFound', 'Kayıt bulunamadı. Önce kaydedin.'))
  const body = DRAFT_BODY[collection]
  if (hasText((doc as unknown as Record<string, unknown>)[body]))
    return Result.failure(Err.validation('Draft.NotEmpty', `${collection === 'guides' ? 'Yazı' : 'Hikaye'} alanı dolu; taslak yalnızca boş alana yazılır.`))
  if (!doc.title?.trim()) return Result.failure(Err.validation('Draft.TitleRequired', 'Önce Türkçe başlığı yazıp kaydedin.'))

  // Captions only from this document's own photos, and only approved ones (a caption is published text, not a guess).
  const ids = allowedPhotoIds(a.mediaIds, doc as { gallery?: unknown; cover?: unknown }).slice(0, MAX_PHOTOS)
  const photos = ids.length
    ? (await payload.find({ collection: 'media', where: { and: [{ id: { in: ids } }, { status: { equals: 'approved' } }] }, locale: 'tr', depth: 0, limit: MAX_PHOTOS, req, overrideAccess: false })).docs
        .map((m) => m.caption?.trim() || m.title?.trim())
        .filter((c): c is string => Boolean(c))
    : []
  const site = await payload.findGlobal({ slug: 'siteSettings', locale: 'tr', depth: 0 })

  const task = DRAFT_TASKS[collection]
  const run = await runStructured({
    chain: resolveChain(task, { [task]: a.settings[task] }, process.env),
    getModel: aiModel(task),
    schema: collection === 'guides' ? GuideDraftSchema : StoryDraftSchema,
    system: draftSystem(collection, siteFacts(site)),
    prompt: draftInput(doc.title, a.notes, photos),
    temperature: 0.4,
  })
  const docRef = `${collection}:${id}`
  if (!run.ok) {
    await payload.create({ collection: 'ai-usage', data: { task, ok: false, docRef, costUsd: failureUsage(run.errors).costUsd, error: run.errors[0]!.description } })
    return run
  }
  const { output, model, costUsd, inputTokens, outputTokens } = run.value
  await payload.create({ collection: 'ai-usage', data: { task, ok: true, model, costUsd, inputTokens, outputTokens, docRef } })

  const data = draftData(collection, output, { excerpt: 'excerpt' in doc ? doc.excerpt : null })
  await payload.update({ ...draftUpdateArgs({ collection, id, data }), req })
  return Result.success({ model, promptVersion: DRAFT_PROMPT_VERSION })
}
