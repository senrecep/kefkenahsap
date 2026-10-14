import type { Payload, PayloadRequest } from 'payload'
import { Err } from 'tsentials/errors'
import { Result } from 'tsentials/result'

import { routing } from '@/i18n/routing'
import type { AiSetting } from '@/payload-types'
import { aiModel, resolveChain } from '../models'
import { glossaryFrom, toSegmentMap, TRANSLATE_PROMPT_VERSION, translateInput, translateSchema, translateSystem } from '../prompts/translate'
import { runStructured } from '../run'
import { applySegments, collectSegments, isMissing, TRANSLATE_SPECS, type Segment, type TranslatableCollection } from './segments'

type Doc = Record<string, unknown>

/**
 * "AI ile çevir": fills the locales whose title is empty from the first locale that has one, in one model call for all of
 * them, and saves each as a DRAFT version (the published version is untouched until a person publishes).
 * Runs as the signed-in user (overrideAccess false), so collection access rules still apply.
 */
export async function translateDocument(a: {
  payload: Payload
  req: PayloadRequest
  collection: TranslatableCollection
  id: number | string
  settings: AiSetting
}): Promise<Result<{ locales: string[]; segments: number; model: string; promptVersion: string }>> {
  const { payload, req, collection, id } = a
  const spec = TRANSLATE_SPECS[collection]
  const docs: Record<string, Doc> = {}
  for (const locale of routing.locales) {
    const doc = await payload
      .findByID({ collection, id, locale, fallbackLocale: false, draft: true, depth: 0, req, overrideAccess: false })
      .catch(() => null)
    if (!doc) return Result.failure(Err.notFound('Translate.NotFound', 'Kayıt bulunamadı. Önce kaydedin.'))
    docs[locale] = doc as unknown as Doc
  }
  const source = routing.locales.find((l) => !isMissing(docs[l], spec))
  if (!source) return Result.failure(Err.validation('Translate.NoSource', 'Çevrilecek metin yok: önce bir dilde başlığı doldurun.'))
  const targets = routing.locales.filter((l) => isMissing(docs[l], spec))
  if (!targets.length) return Result.failure(Err.validation('Translate.NothingMissing', 'Tüm diller zaten dolu; çevrilecek eksik dil yok.'))

  const perTarget = new Map(targets.map((t) => [t, collectSegments(docs[source], docs[t], spec)]))
  const segments = [...new Map([...perTarget.values()].flat().map((s): [string, Segment] => [s.id, s])).values()]

  const run = await runStructured({
    chain: resolveChain('translate', { translate: a.settings.translate }, process.env),
    getModel: aiModel('translate'),
    schema: translateSchema(targets),
    system: translateSystem({ glossary: glossaryFrom(a.settings.glossary), source, targets }),
    prompt: translateInput(segments, source, targets),
  })
  const docRef = `${collection}:${id}`
  if (!run.ok) {
    await payload.create({ collection: 'ai-usage', data: { task: 'translate', ok: false, docRef, error: run.errors[0]!.description } })
    return run
  }
  const { output, model, costUsd, inputTokens, outputTokens } = run.value
  await payload.create({ collection: 'ai-usage', data: { task: 'translate', ok: true, model, costUsd, inputTokens, outputTokens, docRef } })

  const mapped = toSegmentMap(output as { items: Record<string, string>[] }, segments, targets)
  if (!mapped.ok) return mapped
  for (const t of targets) {
    const ids = new Set(perTarget.get(t)!.map((s) => s.id))
    const out = Object.fromEntries(Object.entries(mapped.value[t]!).filter(([k]) => ids.has(k)))
    await payload.update({ collection, id, locale: t, draft: true, data: applySegments(docs[source], docs[t], spec, out), req, overrideAccess: false })
  }
  return Result.success({ locales: targets, segments: segments.length, model, promptVersion: TRANSLATE_PROMPT_VERSION })
}
