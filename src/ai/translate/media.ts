import type { Payload, PayloadRequest } from 'payload'
import { Err } from 'tsentials/errors'
import { Result } from 'tsentials/result'
import { SystemDateTimeProvider } from 'tsentials/time'

import { routing, type Locale } from '@/i18n/routing'
import { type I18nSync, planSync, settleSync, SYNC_FIELDS, type SyncField, type SyncPlan, type Texts } from '@/lib/media/i18nSync'
import { checkBudget } from '../budget'
import { aiModel, resolveChain } from '../models'
import { glossaryFrom, toSegmentMap, translateInput } from '../prompts/translate'
import { TRANSLATE_MEDIA_PROMPT_VERSION, translateMediaSchema, translateMediaSystem } from '../prompts/translateMedia'
import { failureUsage, runStructured } from '../run'
import { monthUsage } from '../usage'

/** Writes made here never queue another translation (Media trackTranslations) nor an AI suggestion. */
const CTX = { skipAi: true }
type AllLocales = Record<SyncField, Partial<Record<string, string | null>> | null> & { i18nSync?: I18nSync | null }

/**
 * #203: brings a photo's other locales in step with its TR title/alt/caption, in one model call for every locale and
 * field that needs it (planSync). The job runs it after a TR edit; the "Diğer dillere yeniden çevir" button runs it
 * with `force`, which also rewrites hand-edited locales. Nothing is sent to the model when the budget is used up.
 */
export async function syncMediaLocales(a: {
  payload: Payload
  req: PayloadRequest
  id: number | string
  force: boolean
}): Promise<Result<{ locales: string[]; stale: string[]; model?: string; promptVersion: string }>> {
  const { payload, req, id } = a
  const doc = (await payload.findByID({ collection: 'media', id, locale: 'all', depth: 0, disableErrors: true, req })) as unknown as AllLocales | null
  if (!doc) return Result.failure(Err.notFound('Media.NotFound', `media ${id}`))
  const pick = (l: string): Texts => Object.fromEntries(SYNC_FIELDS.map((f) => [f, doc[f]?.[l]]))
  const tr = pick(routing.defaultLocale)
  const targets = routing.locales.filter((l) => l !== routing.defaultLocale)
  const plan = planSync({ tr, locales: Object.fromEntries(targets.map((l) => [l, pick(l)])), sync: doc.i18nSync, force: a.force })
  const save = (locale: Locale, data: Record<string, unknown>) =>
    payload.update({ collection: 'media', id, locale, data, context: CTX, req, depth: 0 })
  const done = { stale: plan.edited, promptVersion: TRANSLATE_MEDIA_PROMPT_VERSION }

  const locales = Object.keys(plan.translate) as Locale[]
  let written: Record<string, Partial<Record<SyncField, string>>> = {}
  let model: string | undefined
  if (locales.length) {
    const fail = async (err: Parameters<typeof Result.failure>[0]) => {
      await save(routing.defaultLocale, { i18nSync: settleSync({ sync: doc.i18nSync, tr, plan, written: {}, failed: true }) })
      return Result.failure(err)
    }
    const settings = await payload.findGlobal({ slug: 'aiSettings', req })
    const spent = (await monthUsage(payload, req, SystemDateTimeProvider)).reduce((s, d) => s + (d.costUsd ?? 0), 0)
    const budget = checkBudget(spent, settings.monthlyBudgetUsd)
    if (Result.isFailure(budget)) return fail(budget.errors[0]!)

    const segments = SYNC_FIELDS.filter((f) => locales.some((l) => plan.translate[l]!.includes(f))).map((f) => ({ id: f, text: tr[f]!.trim() }))
    const run = await runStructured({
      chain: resolveChain('translate', { translate: settings.translate }, process.env),
      getModel: aiModel('translate'),
      schema: translateMediaSchema(locales),
      system: translateMediaSystem({ glossary: glossaryFrom(settings.glossary), targets: locales }),
      prompt: translateInput(segments, routing.defaultLocale, locales),
    })
    const docRef = `media:${id}`
    if (!run.ok) {
      await payload.create({ collection: 'ai-usage', data: { task: 'translate', ok: false, docRef, costUsd: failureUsage(run.errors).costUsd, error: run.errors[0]!.description }, req })
      return fail(run.errors[0]!)
    }
    const { costUsd, inputTokens, outputTokens } = run.value
    model = run.value.model
    await payload.create({ collection: 'ai-usage', data: { task: 'translate', ok: true, model, costUsd, inputTokens, outputTokens, docRef }, req })
    const mapped = toSegmentMap(run.value.output as { items: Record<string, string>[] }, segments, locales)
    if (!mapped.ok) return fail(mapped.errors[0]!)
    written = Object.fromEntries(locales.map((l) => [l, Object.fromEntries(plan.translate[l]!.map((f) => [f, mapped.value[l]![f]!]))]))
  }

  // Each locale's text goes out with its provenance in one write: a failure in between never leaves fresh AI text
  // without the record that marks it as the AI's (it would read as hand-edited). Pending stays until the last write.
  let sync = doc.i18nSync
  const only = (locale: string): SyncPlan => ({
    translate: plan.translate[locale] ? { [locale]: plan.translate[locale] } : {},
    clear: plan.clear[locale] ? { [locale]: plan.clear[locale] } : {},
    edited: [],
  })
  for (const locale of new Set([...locales, ...(Object.keys(plan.clear) as Locale[])])) {
    const texts = { ...Object.fromEntries((plan.clear[locale] ?? []).map((f) => [f, null])), ...written[locale] }
    sync = { ...settleSync({ sync, tr, plan: only(locale), written: { [locale]: written[locale] ?? {} }, failed: false }), pending: sync?.pending }
    await save(locale, { ...texts, i18nSync: sync })
  }
  await save(routing.defaultLocale, { i18nSync: settleSync({ sync, tr, plan: { translate: {}, clear: {}, edited: plan.edited }, written: {}, failed: false }) })
  return Result.success({ ...done, locales, ...(model && { model }) })
}
