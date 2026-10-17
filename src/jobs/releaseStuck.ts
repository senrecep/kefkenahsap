import type { Payload } from 'payload'
import type { DateTimeProvider } from 'tsentials/time'

/** A photo job (tagImage, translateMedia) still "processing" this long after its last write is stuck. */
export const STUCK_AFTER_MS = 15 * 60_000

/**
 * #203: a process that dies mid-job leaves the job `processing`, and Payload then never runs another job with the
 * same concurrency key (`media:<id>`): that photo's translations would stop for good. Run at startup (onInit), when
 * the dead process is gone. Returns how many jobs were released back to the queue.
 */
export async function releaseStuckMediaJobs(payload: Payload, clock: DateTimeProvider): Promise<number> {
  const before = new Date(clock.utcNowMs() - STUCK_AFTER_MS).toISOString()
  const { docs } = await payload.update({
    collection: 'payload-jobs',
    where: { processing: { equals: true }, concurrencyKey: { like: 'media:' }, updatedAt: { less_than: before } },
    data: { processing: false },
    depth: 0,
  })
  return docs.length
}
