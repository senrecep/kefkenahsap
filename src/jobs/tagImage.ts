import type { TaskConfig } from 'payload'
import { Result } from 'tsentials/result'
import { SystemDateTimeProvider } from 'tsentials/time'

import { checkBudget } from '@/ai/budget'
import { routing } from '@/i18n/routing'
import { aiModel, resolveChain } from '@/ai/models'
import { knownTypes, TAG_IMAGE_PROMPT_VERSION, TagImageSchema, tagImageSystem, tagImageTypesLine } from '@/ai/prompts/tagImage'
import { failureUsage, runStructured } from '@/ai/run'
import { monthUsage } from '@/ai/usage'
import { type I18nSync, SYNC_FIELDS, type SyncField, textHash } from '@/lib/media/i18nSync'
import { mediaBucket, readObject } from '@/lib/media/renameStored'

/** AI suggestion for a newly uploaded image. Fills only empty fields; the image stays "pending" until a person approves it. */
export const tagImageTask: TaskConfig<'tagImage'> = {
  slug: 'tagImage',
  retries: 1,
  inputSchema: [{ name: 'mediaId', type: 'text', required: true }],
  outputSchema: [{ name: 'result', type: 'text' }],
  // #203: never at the same time as translateMedia on the same photo (same key).
  concurrency: ({ input }) => `media:${input.mediaId}`,
  handler: async ({ input, req }) => {
    const { payload } = req
    // A photo deleted before its job ran: nothing to describe, and not a failed job.
    const media = await payload.findByID({ collection: 'media', id: input.mediaId, depth: 1, locale: 'tr', disableErrors: true, req })
    if (!media) return { output: { result: 'Media.NotFound' } }
    // Idempotent: a retried job never pays twice for the same image.
    if ((media.aiSuggestion as { at?: string } | null)?.at) return { output: { result: 'skipped:already-suggested' } }
    // #216: a photo that is live or hidden is never AI-filled (a retry or a late job must not touch a published photo).
    if (media.status === 'approved' || media.status === 'hidden') return { output: { result: 'skipped:not-pending' } }
    // #216: every other way out leaves a state on the photo; without it the Galeri card would wait for a suggestion forever.
    const fail = async (code: string) => {
      await payload.update({ collection: 'media', id: media.id, locale: 'tr', context: { skipAi: true }, req, depth: 0, data: { aiFailure: { code, at: SystemDateTimeProvider.utcNow().toISOString() } } })
      return { output: { result: code } }
    }

    const settings = await payload.findGlobal({ slug: 'aiSettings', req })
    const spent = await monthUsage(payload, req, SystemDateTimeProvider)
    const budget = checkBudget(spent.reduce((s, d) => s + (d.costUsd ?? 0), 0), settings.monthlyBudgetUsd)
    if (Result.isFailure(budget)) return fail(budget.errors[0]!.code)
    const sized = media.sizes?.w960
    const filename = sized?.filename || media.filename
    if (!filename) return fail('Media.NoFile')
    // #216: straight from the bucket, not the public CDN: a 404 cached there for a reused key must not matter.
    const { bucket, s3 } = mediaBucket()
    const bytes = await readObject(s3, bucket, media.prefix, filename)
    if (!bytes.ok) {
      payload.logger.warn({ errors: bytes.errors, media: media.id }, 'tagImage: could not read the image from storage')
      return fail(bytes.errors[0]!.code)
    }
    const image = bytes.value
    const mediaType = (sized?.filename ? sized.mimeType : media.mimeType) || 'image/webp'
    const category = typeof media.category === 'object' && media.category ? media.category.name : 'belirtilmemiş'
    const types = (await payload.find({ collection: 'tags', locale: 'tr', where: { axis: { equals: 'type' } }, sort: 'name', limit: 200, depth: 0, select: { name: true }, req })).docs.map((d) => d.name)

    const run = await runStructured({
      chain: resolveChain('tagImage', { tagImage: settings.tagImage }, process.env),
      getModel: aiModel('tagImage'),
      schema: TagImageSchema,
      system: tagImageSystem(SystemDateTimeProvider.utcNow().toISOString().slice(0, 10)),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: `Kategori: ${category}\n${tagImageTypesLine(types)}` },
            { type: 'file', data: image, mediaType },
          ],
        },
      ],
    })

    const docRef = `media:${media.id}`
    if (!run.ok) {
      await payload.create({ collection: 'ai-usage', data: { task: 'tagImage', ok: false, docRef, costUsd: failureUsage(run.errors).costUsd, error: run.errors[0]!.description }, req })
      return fail(run.errors[0]!.code)
    }
    const { model, costUsd, inputTokens, outputTokens } = run.value
    // Only types from the offered list survive, so a suggestion never names a tag that does not exist.
    const output = { ...run.value.output, tags: { ...run.value.output.tags, type: knownTypes(run.value.output.tags.type, types) } }
    await payload.create({ collection: 'ai-usage', data: { task: 'tagImage', ok: true, model, costUsd, inputTokens, outputTokens, docRef }, req })

    // Fresh per write: Payload keeps the object as req.context and hooks add keys to it.
    const ctx = () => ({ skipAi: true })
    const blank = (v: unknown) => v == null || v === ''
    // #192: one read of every locale (no fallback: an empty field reads as empty), then a write per locale that has an
    // empty field. Text a person wrote in any locale is kept.
    const all = (await payload.findByID({ collection: 'media', id: media.id, locale: 'all', depth: 0, req })) as unknown as Record<
      SyncField,
      Partial<Record<string, string | null>> | null
    > & { i18nSync?: I18nSync | null }
    // #203: each locale field filled here records the TR text it was made from and its own text, so a later TR edit
    // can tell AI text (rewritten by translateMedia) from a person's (kept, flagged stale).
    const trText = (f: SyncField) => (blank(all[f]?.[routing.defaultLocale]) ? output[f][routing.defaultLocale] : all[f]![routing.defaultLocale]!)
    let sync = all.i18nSync ?? null
    for (const locale of routing.locales) {
      const fields = SYNC_FIELDS.filter((f) => blank(all[f]?.[locale]))
      if (!fields.length) continue
      const data: Record<string, unknown> = Object.fromEntries(fields.map((f) => [f, output[f][locale]]))
      if (locale !== routing.defaultLocale) {
        const prov = Object.fromEntries(fields.map((f) => [f, { src: textHash(trText(f)), ai: textHash(output[f][locale]) }]))
        sync = { ...sync, prov: { ...sync?.prov, [locale]: { ...sync?.prov?.[locale], ...prov } } }
        data.i18nSync = sync
      }
      await payload.update({ collection: 'media', id: media.id, locale, context: ctx(), req, data })
    }
    // Written last: the suggestion marks the job done (see the idempotency check above), so a failure before this
    // point leaves it unmarked and a retry fills the locales still empty.
    await payload.update({
      collection: 'media',
      id: media.id,
      locale: 'tr',
      context: ctx(),
      req,
      data: {
        ...(blank(media.seoFilename) ? { seoFilename: output.seoFilename } : {}),
        aiFailure: null,
        aiSuggestion: { ...output, model, promptVersion: TAG_IMAGE_PROMPT_VERSION, at: SystemDateTimeProvider.utcNow().toISOString() },
      },
    })
    return { output: { result: `ok:${model}` } }
  },
}
