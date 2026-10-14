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

// #61: neutral short stories for the draft projects, keyed by photo-cluster key (seed/clusters/clusters.json).
// TR keeps the cluster's working title; EN also carries a title, since the drafts have none in EN.
const projectStoriesSchema = z.record(z.string(), z.object({ tr: z.object({ story: text }), en: z.object({ title: text, story: text }) }))

export type CategoryContent = z.infer<typeof categorySchema>
export type PageContent = z.infer<typeof pageSchema>
export type GuideContent = z.infer<typeof guideSchema>
export type ReferenceContent = z.infer<typeof referencesSchema>
export type ProjectStoriesContent = z.infer<typeof projectStoriesSchema>

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
export const parseProjectStories = parseWith(projectStoriesSchema)

// #138: one-locale overlays for the locales beyond TR/EN (seed/i18n/<locale>/…, same tree as seed/). A category also
// carries its name and slug there (TR/EN come from src/seed/categories.ts).
export const parseCategoryOverlay = parseWith(categoryLocale.extend({ name: text, slug: text }))
export const parseGuideOverlay = parseWith(guideLocale)
export const parsePageOverlay = parseWith(pageLocale)
export const parseProjectStoriesOverlay = parseWith(z.record(z.string(), z.object({ title: text, story: text })))
/** reference name (never translated) → location */
export const parseReferencesOverlay = parseWith(z.record(z.string(), text))
// alt ≤ 125 = Media.alt maxLength, so a long one fails here and not halfway through a run.
export const parseMediaMetaOverlay = parseWith(z.object({ title: text, alt: text.max(125), caption: text }))
const titleChange = z.object({ old: text, new: text })
/** seed/i18n/sentence-case.json: path under seed/ → the seeded title and its sentence-case form, per locale. */
export const parseSentenceCase = parseWith(z.record(z.string(), z.object({ tr: titleChange.optional(), en: titleChange.optional() })))

/** Words in a markdown text, ignoring heading/list/emphasis markers. */
export const wordCount = (md: string): number => md.replace(/^\s*[-*]\s+/gm, ' ').replace(/[#*_>`]+/g, ' ').split(/\s+/).filter((w) => /\p{L}|\p{N}/u.test(w)).length
