import type { Payload, PayloadRequest } from 'payload'
import { Err } from 'tsentials/errors'
import { Result } from 'tsentials/result'

import { aiStalled } from '@/lib/media/galeri'

/**
 * #216: "Yeniden dene" on a Galeri card whose AI suggestion failed or is gone. Only a card that shows the failed state
 * (aiStalled: pending, nothing to review, failure recorded or untouched for a while) can be retried, so a photo whose job
 * is queued or done is never paid for twice. Clears the failure and queues tagImage again.
 */
export async function retryTagImage(a: { payload: Payload; req: PayloadRequest; id: number | string; aiEnabled: boolean; nowMs: number }): Promise<Result<{ queued: true }>> {
  const { payload, req, id } = a
  if (!a.aiEnabled) return Result.failure(Err.validation('AI.Disabled', 'AI is off'))
  const media = await payload.findByID({ collection: 'media', id, depth: 0, locale: 'tr', disableErrors: true, req })
  if (!media) return Result.failure(Err.notFound('Media.NotFound', `media ${id}`))
  if (!aiStalled(media, a.nowMs, true)) return Result.failure(Err.validation('AI.RetryNotNeeded', `media ${id} is not in a failed state`))
  await payload.update({ collection: 'media', id, locale: 'tr', data: { aiFailure: null }, context: { skipAi: true }, depth: 0, req })
  await payload.jobs.queue({ task: 'tagImage', input: { mediaId: String(id) }, req })
  return Result.success({ queued: true })
}
