import type { Payload, PayloadRequest } from 'payload'
import { Err } from 'tsentials/errors'
import { Result } from 'tsentials/result'
import { SystemDateTimeProvider } from 'tsentials/time'

import { routing, type Locale } from '@/i18n/routing'
import { type I18nSync, planSync, rebasePlan, remainingPending, settleSync, SYNC_FIELDS, type SyncField, type SyncPlan, type Texts } from '@/lib/media/i18nSync'
import { checkBudget } from '../budget'
import { aiModel, resolveChain } from '../models'
import { glossaryFrom, toSegmentMap, translateInput } from '../prompts/translate'
import { TRANSLATE_MEDIA_PROMPT_VERSION, translateMediaSchema, translateMediaSystem } from '../prompts/translateMedia'
import { failureUsage, runStructured } from '../run'
import { monthUsage } from '../usage'

/** Writes made here never queue another translation (Media trackTranslations) nor an AI suggestion. Fresh per write:
 * Payload keeps the object as req.context and hooks add keys to it. */
const ctx = () => ({ skipAi: true })
type AllLocales = Record<SyncField, Partial<Record<string, string | null>> | null> & { i18nSync?: I18nSync | null }

/** settleSync drops pending; the TR fields edited during this run must stay pending for the run their save queued. */
const keepPending = (sync: I18nSync, base: I18nSync): I18nSync => (base.pending ? { ...sync, pending: base.pending } : sync)

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
  const read = async () =>
    (await payload.findByID({ collection: 'media', id, locale: 'all', depth: 0, disableErrors: true, req })) as unknown as AllLocales | null
  const doc = await read()
  if (!doc) return Result.failure(Err.notFound('Media.NotFound', `media ${id}`))
  const targets = routing.locales.filter((l) => l !== routing.defaultLocale)
  const pick = (d: AllLocales, l: string): Texts => Object.fromEntries(SYNC_FIELDS.map((f) => [f, d[f]?.[l]]))
  const others = (d: AllLocales) => Object.fromEntries(targets.map((l) => [l, pick(d, l)]))
  const tr = pick(doc, routing.defaultLocale)
  let plan = planSync({ tr, locales: others(doc), sync: doc.i18nSync, force: a.force })
  const save = (locale: Locale, data: Record<string, unknown>) =>
    payload.update({ collection: 'media', id, locale, data, context: ctx(), req, depth: 0 })
  /**
   * The record as it is now, not as the run first read it: a person may have saved during the model call. TR fields
   * changed meanwhile stay pending (their save queued the next run); handled ones are cleared.
   */
  const current = async (): Promise<{ fresh: AllLocales; base: I18nSync } | null> => {
    const fresh = await read()
    if (!fresh) return null
    const pending = remainingPending(fresh.i18nSync?.pending, tr, pick(fresh, routing.defaultLocale))
    return { fresh, base: { ...fresh.i18nSync, pending } }
  }

  const locales = Object.keys(plan.translate) as Locale[]
  let written: Record<string, Partial<Record<SyncField, string>>> = {}
  let model: string | undefined
  if (locales.length) {
    const fail = async (err: Parameters<typeof Result.failure>[0]) => {
      const now = await current()
      if (now) await save(routing.defaultLocale, { i18nSync: keepPending(settleSync({ sync: now.base, tr, plan, written: {}, failed: true }), now.base) })
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

  const now = await current()
  if (!now) return Result.failure(Err.notFound('Media.NotFound', `media ${id}`))
  plan = rebasePlan(plan, others(doc), others(now.fresh))
  // Each locale's text goes out with its provenance in one write: a failure in between never leaves fresh AI text
  // without the record that marks it as the AI's (it would read as hand-edited). Pending stays until the last write.
  let sync: I18nSync | null | undefined = now.base
  const only = (locale: string): SyncPlan => ({
    translate: plan.translate[locale] ? { [locale]: plan.translate[locale] } : {},
    clear: plan.clear[locale] ? { [locale]: plan.clear[locale] } : {},
    edited: [],
  })
  for (const locale of new Set([...(Object.keys(plan.translate) as Locale[]), ...(Object.keys(plan.clear) as Locale[])])) {
    const out = Object.fromEntries((plan.translate[locale] ?? []).map((f) => [f, written[locale]![f]!]))
    const texts = { ...Object.fromEntries((plan.clear[locale] ?? []).map((f) => [f, null])), ...out }
    sync = { ...settleSync({ sync, tr, plan: only(locale), written: { [locale]: out }, failed: false }), pending: sync?.pending }
    await save(locale, { ...texts, i18nSync: sync })
  }
  const final = settleSync({ sync, tr, plan: { translate: {}, clear: {}, edited: plan.edited }, written: {}, failed: false })
  await save(routing.defaultLocale, { i18nSync: keepPending(final, now.base) })
  return Result.success({ locales: Object.keys(plan.translate), stale: plan.edited, promptVersion: TRANSLATE_MEDIA_PROMPT_VERSION, ...(model && { model }) })
}
