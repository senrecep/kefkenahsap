import type { TaskConfig } from 'payload'
import { Result } from 'tsentials/result'
import { SystemDateTimeProvider } from 'tsentials/time'

import { checkBudget } from '@/ai/budget'
import { aiModel, resolveChain } from '@/ai/models'
import { knownTypes, TAG_IMAGE_PROMPT_VERSION, TagImageSchema, tagImageSystem, tagImageTypesLine } from '@/ai/prompts/tagImage'
import { failureUsage, runStructured } from '@/ai/run'
import { monthUsage } from '@/ai/usage'

/** AI suggestion for a newly uploaded image. Fills only empty fields; the image stays "pending" until a person approves it. */
export const tagImageTask: TaskConfig<'tagImage'> = {
  slug: 'tagImage',
  retries: 1,
  inputSchema: [{ name: 'mediaId', type: 'text', required: true }],
  outputSchema: [{ name: 'result', type: 'text' }],
  handler: async ({ input, req }) => {
    const { payload } = req
    const settings = await payload.findGlobal({ slug: 'aiSettings', req })
    const spent = await monthUsage(payload, req, SystemDateTimeProvider)
    const budget = checkBudget(spent.reduce((s, d) => s + (d.costUsd ?? 0), 0), settings.monthlyBudgetUsd)
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
      return { output: { result: run.errors[0]!.code } }
    }
    const { model, costUsd, inputTokens, outputTokens } = run.value
    // Only types from the offered list survive, so a suggestion never names a tag that does not exist.
    const output = { ...run.value.output, tags: { ...run.value.output.tags, type: knownTypes(run.value.output.tags.type, types) } }
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
