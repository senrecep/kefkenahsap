import type { TaskConfig } from 'payload'

import { syncMediaLocales } from '@/ai/translate/media'

/** #203: queued when a photo's TR title/alt/caption changes (Media trackTranslations); updates the other locales. */
export const translateMediaTask: TaskConfig<'translateMedia'> = {
  slug: 'translateMedia',
  retries: 1,
  inputSchema: [{ name: 'mediaId', type: 'text', required: true }],
  outputSchema: [{ name: 'result', type: 'text' }],
  // One run per photo at a time, and rapid edits collapse into the latest queued job: it reads the photo when it runs.
  concurrency: { key: ({ input }) => `translateMedia:${input.mediaId}`, exclusive: true, supersedes: true },
  handler: async ({ input, req }) => {
    const r = await syncMediaLocales({ payload: req.payload, req, id: input.mediaId, force: false })
    // Refusals (budget, model failure, photo deleted) are recorded on the photo; the job itself is done.
    return { output: { result: r.ok ? `ok:${r.value.locales.join(',') || 'none'}${r.value.stale.length ? ` stale:${r.value.stale.join(',')}` : ''}` : r.errors[0]!.code } }
  },
}
