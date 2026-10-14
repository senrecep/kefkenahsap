import type { TaskConfig } from 'payload'
import { Result } from 'tsentials/result'
import { SystemDateTimeProvider } from 'tsentials/time'

import { checkBudget, monthStart } from '@/ai/budget'
import { openRouterModel, resolveChain } from '@/ai/models'
import { TAG_IMAGE_PROMPT_VERSION, TagImageSchema, tagImageSystem } from '@/ai/prompts/tagImage'
import { runStructured } from '@/ai/run'

/** AI suggestion for a newly uploaded image. Fills only empty fields; the image stays "pending" until a person approves it. */
export const tagImageTask: TaskConfig<'tagImage'> = {
  slug: 'tagImage',
  retries: 1,
  inputSchema: [{ name: 'mediaId', type: 'text', required: true }],
  outputSchema: [{ name: 'result', type: 'text' }],
  handler: async ({ input, req }) => {
    const { payload } = req
    const settings = await payload.findGlobal({ slug: 'aiSettings', req })
    const spent = await payload.find({
      collection: 'ai-usage',
      where: { createdAt: { greater_than_equal: monthStart(SystemDateTimeProvider).toISOString() } },
      pagination: false,
      depth: 0,
      req,
    })
    const budget = checkBudget(spent.docs.reduce((s, d) => s + (d.costUsd ?? 0), 0), settings.monthlyBudgetUsd)
    if (Result.isFailure(budget)) return { output: { result: budget.errors[0]!.code } }

    const media = await payload.findByID({ collection: 'media', id: input.mediaId, depth: 1, locale: 'tr', req })
    // Idempotent: a retried job never pays twice for the same image.
    if ((media.aiSuggestion as { at?: string } | null)?.at) return { output: { result: 'skipped:already-suggested' } }
    const sized = media.sizes?.w960
    const rel = sized?.url || media.url
    if (!rel) return { output: { result: 'Media.NoFile' } }
    const src = new URL(rel, process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').toString()
    const res = await fetch(src)
    if (!res.ok) return { output: { result: `Media.FetchFailed:${res.status}` } }
    const image = new Uint8Array(await res.arrayBuffer())
    const mediaType = (sized?.url ? sized.mimeType : media.mimeType) || 'image/webp'
    const category = typeof media.category === 'object' && media.category ? media.category.name : 'belirtilmemiş'

    const run = await runStructured({
      chain: resolveChain('tagImage', { tagImage: settings.tagImage }, process.env),
      getModel: openRouterModel,
      schema: TagImageSchema,
      system: tagImageSystem(SystemDateTimeProvider.utcNow().toISOString().slice(0, 10)),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: `Kategori: ${category}` },
            { type: 'file', data: image, mediaType },
          ],
        },
      ],
    })

    const docRef = `media:${media.id}`
    if (!run.ok) {
      await payload.create({ collection: 'ai-usage', data: { task: 'tagImage', ok: false, docRef, error: run.errors[0]!.description }, req })
      return { output: { result: run.errors[0]!.code } }
    }
    const { output, model, costUsd, inputTokens, outputTokens } = run.value
    await payload.create({ collection: 'ai-usage', data: { task: 'tagImage', ok: true, model, costUsd, inputTokens, outputTokens, docRef }, req })

    const ctx = { skipAi: true }
    const blank = (v: unknown) => v == null || v === ''
    const tr = media
    await payload.update({
      collection: 'media',
      id: media.id,
      locale: 'tr',
      context: ctx,
      req,
      data: {
        ...(blank(tr.title) ? { title: output.title.tr } : {}),
        ...(blank(tr.alt) ? { alt: output.alt.tr } : {}),
        ...(blank(tr.caption) ? { caption: output.caption.tr } : {}),
        ...(blank(tr.seoFilename) ? { seoFilename: output.seoFilename } : {}),
        aiSuggestion: { ...output, model, promptVersion: TAG_IMAGE_PROMPT_VERSION, at: SystemDateTimeProvider.utcNow().toISOString() },
      },
    })
    // fallbackLocale false: an empty EN field must read as empty, not as the TR value.
    const en = await payload.findByID({ collection: 'media', id: media.id, locale: 'en', fallbackLocale: false, depth: 0, req })
    await payload.update({
      collection: 'media',
      id: media.id,
      locale: 'en',
      context: ctx,
      req,
      data: {
        ...(blank(en.title) ? { title: output.title.en } : {}),
        ...(blank(en.alt) ? { alt: output.alt.en } : {}),
        ...(blank(en.caption) ? { caption: output.caption.en } : {}),
      },
    })
    return { output: { result: `ok:${model}` } }
  },
}
