import { createHash } from 'node:crypto'

/**
 * #203: keeps a photo's other languages in step with its Turkish title/alt/caption. Per locale field, the provenance
 * says which TR text the AI translated (`src`) and what it wrote (`ai`): a locale whose text no longer hashes to `ai`
 * was edited by hand and is never overwritten automatically, only flagged stale.
 */
export const SYNC_FIELDS = ['title', 'alt', 'caption'] as const
export type SyncField = (typeof SYNC_FIELDS)[number]
export type Texts = Partial<Record<SyncField, string | null | undefined>>
export type Provenance = { src: string; ai: string }
/** Why a locale may be out of date: a person edited it, or the translation was not made (budget, model, AI off). */
export type StaleReason = 'edited' | 'failed'
export type I18nSync = {
  prov?: Partial<Record<string, Partial<Record<SyncField, Provenance>>>>
  /** TR fields changed since the last translation run. */
  pending?: SyncField[]
  stale?: Partial<Record<string, StaleReason>>
}
export type SyncPlan = { translate: Record<string, SyncField[]>; clear: Record<string, SyncField[]>; edited: string[] }

const norm = (s: string | null | undefined) => (s ?? '').trim()
export const textHash = (s: string | null | undefined) => createHash('sha1').update(norm(s)).digest('hex').slice(0, 16)

/** The fields sent in `data` whose text differs from the stored one (null, '' and edge spaces count as equal). */
export function changedFields(data: Texts, before: Texts | null | undefined): SyncField[] {
  // Only plain strings compare: a `locale: 'all'` write sends { tr, en, … } objects, which are not a TR edit here.
  const text = (v: unknown) => v == null || typeof v === 'string'
  return SYNC_FIELDS.filter((f) => data[f] !== undefined && text(data[f]) && text(before?.[f]) && norm(data[f]) !== norm(before?.[f]))
}

/**
 * What a run may do per locale. A field needs work when its TR text changed (pending) or its provenance names an older
 * TR text. It is rewritten only if the locale text is empty or still the AI's; otherwise the locale is stale. `force`
 * (the owner's explicit button) rewrites every field that has TR text.
 */
export function planSync(a: { tr: Texts; locales: Record<string, Texts>; sync: I18nSync | null | undefined; force: boolean }): SyncPlan {
  const plan: SyncPlan = { translate: {}, clear: {}, edited: [] }
  const add = (to: Record<string, SyncField[]>, l: string, f: SyncField) => (to[l] ??= []).push(f)
  for (const [locale, texts] of Object.entries(a.locales)) {
    let edited = false
    for (const f of SYNC_FIELDS) {
      const tr = norm(a.tr[f])
      const current = norm(texts[f])
      const prov = a.sync?.prov?.[locale]?.[f]
      if (!a.force) {
        const changed = a.sync?.pending?.includes(f) || (prov !== undefined && prov.src !== textHash(tr))
        if (!changed) continue
        if (prov?.src === textHash(tr) && prov.ai === textHash(current)) continue
        if (current && prov?.ai !== textHash(current)) {
          edited = true
          continue
        }
      }
      if (tr) add(plan.translate, locale, f)
      // Never under force: the owner's button only translates, it does not delete a locale's text.
      else if (current && !a.force) add(plan.clear, locale, f)
    }
    if (edited) plan.edited.push(locale)
  }
  return plan
}

/**
 * The plan after the model call: a locale field whose text changed since the plan was made (a person saved meanwhile)
 * is dropped and its locale marked edited, so a run never overwrites text it did not plan against.
 */
export function rebasePlan(plan: SyncPlan, before: Record<string, Texts>, after: Record<string, Texts>): SyncPlan {
  const edited = new Set(plan.edited)
  const keep = (from: Record<string, SyncField[]>) => {
    const out: Record<string, SyncField[]> = {}
    for (const [locale, fields] of Object.entries(from)) {
      const same = fields.filter((f) => textHash(before[locale]?.[f]) === textHash(after[locale]?.[f]))
      if (same.length < fields.length) edited.add(locale)
      if (same.length) out[locale] = same
    }
    return out
  }
  const translate = keep(plan.translate)
  const clear = keep(plan.clear)
  return { translate, clear, edited: [...edited] }
}

/** The pending TR fields that changed after the run read them: they still need a run (the hook queued one). */
export function remainingPending(pending: SyncField[] | undefined, trBefore: Texts, trNow: Texts): SyncField[] | undefined {
  const left = (pending ?? []).filter((f) => textHash(trBefore[f]) !== textHash(trNow[f]))
  return left.length ? left : undefined
}

/** The stored state after a run: provenance of what was written, no pending fields, stale locales updated. */
export function settleSync(a: {
  sync: I18nSync | null | undefined
  tr: Texts
  plan: SyncPlan
  written: Record<string, Partial<Record<SyncField, string>>>
  failed: boolean
}): I18nSync {
  const prov: NonNullable<I18nSync['prov']> = structuredClone(a.sync?.prov ?? {})
  const stale: NonNullable<I18nSync['stale']> = { ...a.sync?.stale }
  for (const [locale, fields] of Object.entries(a.written)) {
    for (const [f, text] of Object.entries(fields) as [SyncField, string][]) (prov[locale] ??= {})[f] = { src: textHash(a.tr[f]), ai: textHash(text) }
  }
  // A failed run writes nothing, so it clears nothing either.
  if (a.failed) for (const locale of Object.keys(a.plan.translate)) stale[locale] = 'failed'
  else {
    for (const [locale, fields] of Object.entries(a.plan.clear)) for (const f of fields) delete prov[locale]?.[f]
    for (const locale of [...Object.keys(a.plan.translate), ...Object.keys(a.plan.clear)]) delete stale[locale]
  }
  for (const locale of a.plan.edited) stale[locale] = 'edited'
  for (const locale of Object.keys(prov)) if (!Object.keys(prov[locale]!).length) delete prov[locale]
  return { ...(Object.keys(prov).length && { prov }), ...(Object.keys(stale).length && { stale }) }
}

/**
 * Provenance for a photo that has none (seeded before #203): its non-TR texts came from the seed AI pipeline and were
 * never hand-edited, so the current texts count as the AI's, made from the current TR text. Empty fields are left out
 * (they get translated). Null when there is nothing to record.
 */
export function backfillSync(tr: Texts, locales: Record<string, Texts>): I18nSync | null {
  const prov: NonNullable<I18nSync['prov']> = {}
  for (const [locale, texts] of Object.entries(locales))
    for (const f of SYNC_FIELDS) if (norm(texts[f])) (prov[locale] ??= {})[f] = { src: textHash(tr[f]), ai: textHash(texts[f]) }
  return Object.keys(prov).length ? { prov } : null
}
