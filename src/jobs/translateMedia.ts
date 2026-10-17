import type { TaskConfig } from 'payload'

import { syncMediaLocales } from '@/ai/translate/media'

/** #203: queued when a photo's TR title/alt/caption changes (Media trackTranslations); updates the other locales. */
export const translateMediaTask: TaskConfig<'translateMedia'> = {
  slug: 'translateMedia',
  retries: 1,
  inputSchema: [{ name: 'mediaId', type: 'text', required: true }],
  outputSchema: [{ name: 'result', type: 'text' }],
  // Shares tagImage's key and queue (default): both rewrite every locale and i18nSync of the photo, so they must not
  // run at once; one run picks at most one job per key and skips keys already running. No `supersedes` (it would
  // delete a queued tagImage); a duplicate run is harmless, it reads its work from provenance.
  concurrency: ({ input }) => `media:${input.mediaId}`,
  handler: async ({ input, req }) => {
    const r = await syncMediaLocales({ payload: req.payload, req, id: input.mediaId, force: false })
    // Refusals (budget, model failure, photo deleted) are recorded on the photo; the job itself is done.
    return { output: { result: r.ok ? `ok:${r.value.locales.join(',') || 'none'}${r.value.stale.length ? ` stale:${r.value.stale.join(',')}` : ''}` : r.errors[0]!.code } }
  },
}
