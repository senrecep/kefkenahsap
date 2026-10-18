import type { Payload, PayloadRequest } from 'payload'
import { Err } from 'tsentials/errors'
import { Result } from 'tsentials/result'

/**
 * #216: "Yeniden dene" on a Galeri card whose AI suggestion failed. Clears the recorded failure and queues tagImage
 * again; a photo that already has its suggestion queues nothing (the job would skip it anyway).
 */
export async function retryTagImage(a: { payload: Payload; req: PayloadRequest; id: number | string }): Promise<Result<{ queued: boolean }>> {
  const { payload, req, id } = a
  const media = await payload.findByID({ collection: 'media', id, depth: 0, locale: 'tr', disableErrors: true, req })
  if (!media) return Result.failure(Err.notFound('Media.NotFound', `media ${id}`))
  if ((media.aiSuggestion as { at?: string } | null)?.at) return Result.success({ queued: false })
  await payload.update({ collection: 'media', id, locale: 'tr', data: { aiFailure: null }, context: { skipAi: true }, depth: 0, req })
  await payload.jobs.queue({ task: 'tagImage', input: { mediaId: String(id) }, req })
  return Result.success({ queued: true })
}
