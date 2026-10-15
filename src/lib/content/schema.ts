// Shapes of the committed seed content in seed/content/** (#34). Bodies are markdown; the loader converts them to Lexical.
import { Err } from 'tsentials/errors'
import { safeJsonParse } from 'tsentials/json'
import { Result } from 'tsentials/result'
import { z } from 'zod'

import { RESERVED_CATEGORY_SLUGS } from '@/lib/slug'

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
// relatedCategories: TR slugs of seed categories (#49). cover: SEO filename of an approved library photo (#146).
const guideSchema = z.object({ relatedCategories: z.array(text), cover: text.optional(), tr: guideLocale, en: guideLocale })

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
const slug = text.regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase ASCII words joined by single dashes')
export const parseCategoryOverlay = parseWith(
  categoryLocale.extend({ name: text, slug: slug.refine((s) => !RESERVED_CATEGORY_SLUGS.has(s), 'a fixed route segment of the site') }),
)
export const parseGuideOverlay = parseWith(guideLocale.extend({ slug }))
export const parsePageOverlay = parseWith(pageLocale.extend({ slug }))
// slug (#156): a hand-written Latin slug where the title's script needs one (ar); else the slug hook fills it from the title.
export const parseProjectStoriesOverlay = parseWith(z.record(z.string(), z.object({ title: text, slug: z.string().regex(/^[a-z0-9-]+$/).optional(), story: text })))
/** reference name (never translated) → location */
export const parseReferencesOverlay = parseWith(z.record(z.string(), text))
// alt ≤ 125 = Media.alt maxLength, so a long one fails here and not halfway through a run.
export const parseMediaMetaOverlay = parseWith(z.object({ title: text, alt: text.max(125), caption: text }))
/** seed/i18n/<locale>/site-settings.json: phone labels keyed by number, area names by kind (#140). */
const siteSettingsOverlay = z
  .object({
    phones: z.array(z.object({ number: text, label: text })).optional(),
    areaServed: z.array(z.object({ kind: z.enum(['district', 'city', 'country']), name: text })).optional(),
    whatsappTemplates: z.object({ default: text, category: text, project: text, image: text, contact: text }).partial().optional(),
    defaultDescription: text.optional(),
  })
  .strict()
export const parseSiteSettingsOverlay = parseWith(siteSettingsOverlay)
export type SiteSettingsOverlay = z.infer<typeof siteSettingsOverlay>
const change = z.object({ old: text, new: text })
const localeChange = z.object({ tr: change.optional(), en: change.optional() })
/** seed/i18n/sentence-case.json: path under seed/ → the seeded title and its sentence-case form, per locale. */
export const parseSentenceCase = parseWith(z.record(z.string(), localeChange))
/** seed/i18n/text-fixes.json: path under seed/ → field → per-locale { old, new } (e.g. a caption with model commentary). */
export const parseTextFixes = parseWith(z.record(z.string(), z.object({ title: localeChange.optional(), caption: localeChange.optional() })))
export type TextFixes = Record<string, { title?: z.infer<typeof localeChange>; caption?: z.infer<typeof localeChange> }>

// #150: seed/editorial/tags.json and picks.json (see scripts/seed/editorial.ts).
const localized = z.object({ tr: text, en: text, ru: text, de: text, ar: text })
export const parseEditorialTags = parseWith(
  z.object({ tags: z.array(z.object({ key: text, axis: z.enum(['wood', 'setting', 'stage']), name: localized, slug: localized.extend({ tr: slug, en: slug, ru: slug, de: slug, ar: slug }), raw: z.array(text).min(1) })) }),
)
const pick = z.object({ seedKey: text, reason: text })
const swap = z.object({ from: text.nullable(), to: text, reason: text })
export const parseEditorialPicks = parseWith(
  z.object({
    hero: pick.extend({ focal: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) }) }),
    mobileHero: pick,
    featuredProjects: z.array(z.object({ cluster: text, cover: text, reason: text })).max(6),
    categoryCovers: z.record(z.string(), pick),
    faq: z.array(z.object({ category: text, index: z.number().int().min(0), reason: text })).min(1),
    // #156: re-picks (seedKeys), applied by scripts/seed/editorial-swaps.ts only where the previous pick is still in place.
    swaps: z.object({
      guideCovers: z.record(z.string(), swap),
      categoryCovers: z.record(z.string(), swap),
      projectCovers: z.record(z.string(), swap.extend({ from: z.null(), firstPhoto: text })),
    }),
    projectCategories: z.record(z.string(), z.object({ from: z.array(slug).min(1), add: z.array(slug).min(1), reason: text })),
  }),
)

/** Words in a markdown text, ignoring heading/list/emphasis markers. */
export const wordCount = (md: string): number => md.replace(/^\s*[-*]\s+/gm, ' ').replace(/[#*_>`]+/g, ' ').split(/\s+/).filter((w) => /\p{L}|\p{N}/u.test(w)).length
/** #148: seed/i18n/project-story-fixes.json: cluster key → year (fills an empty one) and per-locale { old, new } title/story. */
const anyLocaleChange = z.record(z.string(), change)
export const parseProjectFixes = parseWith(
  z.record(z.string(), z.object({ year: z.number().int().optional(), title: anyLocaleChange.optional(), story: anyLocaleChange.optional() }).strict()),
)
export type ProjectFix = { year?: number; title?: Record<string, { old: string; new: string }>; story?: Record<string, { old: string; new: string }> }
