import { addDataAndFileToRequest, type Endpoint } from 'payload'
import { Err } from 'tsentials/errors'

import { aiErrorResponse, aiGate, aiLimiter, isJsonRequest, positiveId } from '@/ai/guard'
import { isDraftable, parseNotes } from '@/ai/draft/draft'
import { draftDocument } from '@/ai/draft/run'
import { syncMediaLocales } from '@/ai/translate/media'
import { translateDocument } from '@/ai/translate/run'
import { isTranslatable } from '@/ai/translate/segments'

const translateLimiter = aiLimiter()
const draftLimiter = aiLimiter()
const mediaLimiter = aiLimiter()

/** POST /api/ai/translate { collection, id }: the "AI ile çevir" button. */
export const aiTranslateEndpoint: Endpoint = {
  path: '/ai/translate',
  method: 'post',
  handler: async (req) => {
    const log = (o: { code: string; detail: string }) => req.payload.logger.warn({ ...o, msg: 'ai translate refused/failed' })
    if (!isJsonRequest(req.headers)) return aiErrorResponse(Err.validation('AI.BadContentType', 'non-JSON body'), log)
    const gate = await aiGate(req.payload, req, translateLimiter)
    if (!gate.ok) return aiErrorResponse(gate.errors[0]!, log)
    await addDataAndFileToRequest(req)
    const { collection, id: rawId } = (req.data ?? {}) as { collection?: unknown; id?: unknown }
    const id = positiveId(rawId)
    if (typeof collection !== 'string' || !isTranslatable(collection) || id === undefined)
      return aiErrorResponse(Err.validation('Translate.BadRequest', `collection=${String(collection)} id=${String(rawId)}`), log)
    try {
      const r = await translateDocument({ payload: req.payload, req, collection, id, ...gate.value })
      return r.ok ? Response.json(r.value) : aiErrorResponse(r.errors[0]!, log)
    } catch (e) {
      // Saving the draft can still fail (e.g. the translated slug is taken). Details go to the log only.
      req.payload.logger.error({ err: e, msg: 'ai translate failed' })
      return aiErrorResponse(Err.unexpected('Translate.SaveFailed', 'save failed (see error log)'))
    }
  },
}

/**
 * POST /api/ai/translate-media { id }: "Diğer dillere yeniden çevir" (#203). The owner's explicit action: every non-TR
 * title/alt/caption of the photo is rewritten from the TR text, hand-edited ones too (the UI confirms first).
 */
export const aiTranslateMediaEndpoint: Endpoint = {
  path: '/ai/translate-media',
  method: 'post',
  handler: async (req) => {
    const log = (o: { code: string; detail: string }) => req.payload.logger.warn({ ...o, msg: 'ai translate-media refused/failed' })
    if (!isJsonRequest(req.headers)) return aiErrorResponse(Err.validation('AI.BadContentType', 'non-JSON body'), log)
    const gate = await aiGate(req.payload, req, mediaLimiter)
    if (!gate.ok) return aiErrorResponse(gate.errors[0]!, log)
    await addDataAndFileToRequest(req)
    const id = positiveId((req.data as { id?: unknown } | undefined)?.id)
    if (id === undefined) return aiErrorResponse(Err.validation('Translate.BadRequest', `id=${String((req.data as { id?: unknown })?.id)}`), log)
    try {
      const r = await syncMediaLocales({ payload: req.payload, req, id, force: true })
      return r.ok ? Response.json(r.value) : aiErrorResponse(r.errors[0]!, log)
    } catch (e) {
      req.payload.logger.error({ err: e, msg: 'ai translate-media failed' })
      return aiErrorResponse(Err.unexpected('Translate.SaveFailed', 'save failed (see error log)'))
    }
  },
}

const MAX_PHOTOS = 12

/**
 * POST /api/ai/draft { collection, id, notes, mediaIds? }: the "AI ile taslak" button. Only these four keys are read, so a
 * `_status` or `draft` in the body has no effect; the result is always a draft version (draftUpdateArgs).
 */
export const aiDraftEndpoint: Endpoint = {
  path: '/ai/draft',
  method: 'post',
  handler: async (req) => {
    const log = (o: { code: string; detail: string }) => req.payload.logger.warn({ ...o, msg: 'ai draft refused/failed' })
    if (!isJsonRequest(req.headers)) return aiErrorResponse(Err.validation('AI.BadContentType', 'non-JSON body'), log)
    const gate = await aiGate(req.payload, req, draftLimiter)
    if (!gate.ok) return aiErrorResponse(gate.errors[0]!, log)
    await addDataAndFileToRequest(req)
    const { collection, id: rawId, notes, mediaIds } = (req.data ?? {}) as { collection?: unknown; id?: unknown; notes?: unknown; mediaIds?: unknown }
    const id = positiveId(rawId)
    const photos = Array.isArray(mediaIds) ? mediaIds.map(positiveId) : []
    if (typeof collection !== 'string' || !isDraftable(collection) || id === undefined || photos.length > MAX_PHOTOS || photos.some((p) => p === undefined))
      return aiErrorResponse(Err.validation('Draft.BadRequest', `collection=${String(collection)} id=${String(rawId)}`), log)
    const parsed = parseNotes(typeof notes === 'string' ? notes : '')
    if (!parsed.ok) return aiErrorResponse(parsed.errors[0]!, log)
    try {
      const r = await draftDocument({ payload: req.payload, req, collection, id, notes: parsed.value, mediaIds: photos as number[], ...gate.value })
      return r.ok ? Response.json(r.value) : aiErrorResponse(r.errors[0]!, log)
    } catch (e) {
      req.payload.logger.error({ err: e, msg: 'ai draft failed' })
      return aiErrorResponse(Err.unexpected('Draft.SaveFailed', 'save failed (see error log)'))
    }
  },
}
