import { addDataAndFileToRequest, type Endpoint } from 'payload'
import { Err } from 'tsentials/errors'

import { aiErrorResponse, aiGate, aiLimiter } from '@/ai/guard'
import { translateDocument } from '@/ai/translate/run'
import { isTranslatable } from '@/ai/translate/segments'

const translateLimiter = aiLimiter()
const isId = (v: unknown): v is string | number => (typeof v === 'string' && v.length > 0) || typeof v === 'number'

/** POST /api/ai/translate { collection, id }: the "AI ile çevir" button. */
export const aiTranslateEndpoint: Endpoint = {
  path: '/ai/translate',
  method: 'post',
  handler: async (req) => {
    const gate = await aiGate(req.payload, req, translateLimiter)
    if (!gate.ok) return aiErrorResponse(gate.errors[0]!)
    await addDataAndFileToRequest(req)
    const { collection, id } = (req.data ?? {}) as { collection?: unknown; id?: unknown }
    if (typeof collection !== 'string' || !isTranslatable(collection) || !isId(id))
      return aiErrorResponse(Err.validation('Translate.BadRequest', 'Bu kayıt çevrilemez.'))
    try {
      const r = await translateDocument({ payload: req.payload, req, collection, id, settings: gate.value })
      return r.ok ? Response.json(r.value) : aiErrorResponse(r.errors[0]!)
    } catch (e) {
      // Saving the draft can still fail (e.g. the translated slug is taken): show why, nothing was published.
      req.payload.logger.error({ err: e, msg: 'ai translate failed' })
      return aiErrorResponse(Err.unexpected('Translate.SaveFailed', `Çeviri kaydedilemedi: ${e instanceof Error ? e.message : String(e)}`))
    }
  },
}
