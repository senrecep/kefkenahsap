import { addDataAndFileToRequest, type Endpoint } from 'payload'
import { Err } from 'tsentials/errors'

import { aiErrorResponse, aiGate, aiLimiter, isJsonRequest, positiveId } from '@/ai/guard'
import { translateDocument } from '@/ai/translate/run'
import { isTranslatable } from '@/ai/translate/segments'

const translateLimiter = aiLimiter()

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
