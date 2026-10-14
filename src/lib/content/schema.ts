// Shapes of the committed seed content in seed/content/** (#34). Bodies are markdown; the loader converts them to Lexical.
import { Err } from 'tsentials/errors'
import { safeJsonParse } from 'tsentials/json'
import { Result } from 'tsentials/result'
import { z } from 'zod'

const text = z.string().trim().min(1)

const categoryLocale = z.object({
  shortDesc: text,
  body: text,
  faq: z.array(z.object({ q: text, a: text })),
})
const categorySchema = z.object({ tr: categoryLocale, en: categoryLocale })

const pageLocale = z.object({ title: text, slug: text, body: text })
const pageSchema = z.object({ tr: pageLocale, en: pageLocale })

const guideLocale = z.object({ title: text, slug: text, excerpt: text, body: text, faq: z.array(z.object({ q: text, a: text })) })
// relatedCategories: TR slugs of seed categories (#49).
const guideSchema = z.object({ relatedCategories: z.array(text), tr: guideLocale, en: guideLocale })

const referencesSchema = z.array(z.object({ name: text, location: z.object({ tr: text, en: text }) }))

export type CategoryContent = z.infer<typeof categorySchema>
export type PageContent = z.infer<typeof pageSchema>
export type GuideContent = z.infer<typeof guideSchema>
export type ReferenceContent = z.infer<typeof referencesSchema>

const parseWith =
  <T>(schema: z.ZodType<T>) =>
  (json: string): Result<T> => {
    const raw = safeJsonParse(json)
    if (!raw.ok) return raw
    const parsed = schema.safeParse(raw.value)
    return parsed.success
      ? Result.success(parsed.data)
      : Result.failure(Err.validation('Content.Invalid', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')))
  }

export const parseCategory = parseWith(categorySchema)
export const parsePage = parseWith(pageSchema)
export const parseGuide = parseWith(guideSchema)
export const parseReferences = parseWith(referencesSchema)

/** Words in a markdown text, ignoring heading/list/emphasis markers. */
export const wordCount = (md: string): number => md.replace(/^\s*[-*]\s+/gm, ' ').replace(/[#*_>`]+/g, ' ').split(/\s+/).filter((w) => /\p{L}|\p{N}/u.test(w)).length
