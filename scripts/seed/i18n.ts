// #138: shared by the seed loaders for the per-locale "fill only empty fields" write and the local-database guard.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Payload } from 'payload'
import { Maybe } from 'tsentials/maybe'
import type { Result } from 'tsentials/result'

import { fillEmpty } from '@/lib/content/merge'
import { mediaSeedKey, overlayLocales, readOverlay } from '@/lib/content/overlay'
import { parseCategory, parseCategoryOverlay, parseMediaMetaOverlay } from '@/lib/content/schema'
import type { SeedCategory } from '@/seed/categories'
import { databaseHost, isLocalHost } from '@/lib/quality/target'
import type { Config } from '@/payload-types'

type Locale = Config['locale']
type Collection = 'categories' | 'pages' | 'guides' | 'projects' | 'references' | 'media' | 'tags'

/** Edge unwrap for the seed scripts: a bad seed file stops the run. */
export function unwrap<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(r.errors.map((e) => e.description).join('; '))
  return r.value
}

/** The overlay for one locale, undefined when there is none (see readOverlay). */
export function loadOverlay<T>(seedDir: string, locale: string, rel: string, parse: (json: string) => Result<T>): T | undefined {
  const m = unwrap(readOverlay(seedDir, locale, rel, parse))
  return Maybe.isSome(m) ? m.value : undefined
}

/** Configured locales that come from overlays (all but TR/EN). */
export const payloadOverlayLocales = (payload: Payload) => overlayLocales((payload.config.localization ? payload.config.localization.localeCodes : []) as Locale[])

/**
 * Writes, per locale, the incoming fields that are empty in the stored document (all of them with `force`).
 * With `draft` the read is the latest draft and the write a new draft version; the published version is untouched.
 * Caution: `_status` is document-wide (no localizeStatus), so publishing the document in ANY locale also publishes these
 * seeded drafts in every locale. Review all locales (or roll the draft back) before publishing.
 * Returns the number of locale writes (or would-be writes with `dryRun`).
 */
export async function fillLocales(
  payload: Payload,
  collection: Collection,
  id: number,
  byLocale: Partial<Record<Locale, Record<string, unknown>>>,
  opts: { label: string; draft?: boolean; force?: boolean; dryRun?: boolean },
): Promise<number> {
  let writes = 0
  for (const [locale, incoming] of Object.entries(byLocale) as [Locale, Record<string, unknown>][]) {
    const current = await payload.findByID({ collection, id, locale, fallbackLocale: false, draft: opts.draft, depth: 0 })
    const patch = fillEmpty(current as unknown as Record<string, unknown>, incoming, { force: opts.force })
    if (!Object.keys(patch).length) continue
    // skipAi: seeded text never queues an AI suggestion (Media), harmless elsewhere.
    if (!opts.dryRun) await payload.update({ collection, id, locale, draft: opts.draft, data: patch as never, context: { skipAi: true } })
    writes++
    console.log(`${opts.dryRun ? '[dry run] ' : ''}${opts.label} [${locale}]: ${Object.keys(patch).join(', ')}`)
  }
  return writes
}

/**
 * Prints the target database (host:port/name). Exits with SITE_ENV=production, and for a non-local host unless the run
 * is a --dry-run or --yes confirms it. A tunnelled database reads as localhost: check the printed name.
 */
export function guardTarget(dryRun: boolean) {
  const host = databaseHost(process.env.DATABASE_URL)
  // host:port/name; databaseHost already returned '' for a missing or unparsable URL.
  const target = host ? `${new URL(process.env.DATABASE_URL!).host}${new URL(process.env.DATABASE_URL!).pathname}` : '?'
  console.log(`database: ${target}${dryRun ? ' · dry run' : ''}`)
  if (process.env.SITE_ENV === 'production') {
    console.error('Refusing to run with SITE_ENV=production.')
    process.exit(1)
  }
  if (!isLocalHost(host) && !dryRun && !process.argv.includes('--yes')) {
    console.error('Not a local database: check the host above, then re-run with --yes (or --dry-run first).')
    process.exit(1)
  }
}

/**
 * Fills empty title/alt/caption of the overlay locales on the media seeded from the given meta files (paths under seed/).
 * Never sends `status`, so a pending archive photo stays pending and an approved one stays approved.
 */
export async function seedMediaLocales(payload: Payload, { seedDir, rels, dryRun }: { seedDir: string; rels: string[]; dryRun?: boolean }) {
  const locales = payloadOverlayLocales(payload)
  const counts = { writes: 0, media: 0, noOverlay: 0, noMedia: 0, failed: [] as string[] }
  for (const rel of rels) {
    const byLocale: Partial<Record<Locale, Record<string, unknown>>> = {}
    for (const locale of locales) {
      const meta = loadOverlay(seedDir, locale, rel, parseMediaMetaOverlay)
      if (meta) byLocale[locale] = meta
    }
    if (!Object.keys(byLocale).length) {
      counts.noOverlay++
      continue
    }
    const seedKey = unwrap(mediaSeedKey(seedDir, rel))
    const doc = (await payload.find({ collection: 'media', where: { seedKey: { equals: seedKey } }, limit: 1, depth: 0, select: { seedKey: true } })).docs[0]
    if (!doc) {
      counts.noMedia++
      continue
    }
    try {
      const writes = await fillLocales(payload, 'media', doc.id, byLocale, { label: seedKey, dryRun })
      counts.writes += writes
      if (writes) counts.media++
    } catch (err) {
      // One bad photo must not stop the rest; the runner exits 1 and lists it.
      counts.failed.push(seedKey)
      console.error(`media ${seedKey}: ${err instanceof Error ? err.message : err}`)
    }
  }
  return counts
}

export type CategoryTexts = Record<Locale, { name: string; slug: string; shortDesc: string; body: unknown; faq: { q: string; a: string }[] }>

/** #172: a seed category's committed texts in every locale (TR/EN file + ru/de/ar overlays), bodies as Lexical. */
export function categoryTexts(seedDir: string, cat: SeedCategory, lexical: (markdown: string) => unknown): CategoryTexts {
  const rel = `content/categories/${cat.slug.tr}.json`
  const content = unwrap(parseCategory(readFileSync(path.join(seedDir, rel), 'utf8')))
  const overlays = (['ru', 'de', 'ar'] as const).map((l) => {
    const o = loadOverlay(seedDir, l, rel, parseCategoryOverlay)
    if (!o) throw new Error(`${l}/${rel} missing`)
    return [l, { ...o, body: lexical(o.body) }] as const
  })
  return {
    tr: { name: cat.name.tr, slug: cat.slug.tr, ...content.tr, body: lexical(content.tr.body) },
    en: { name: cat.name.en, slug: cat.slug.en, ...content.en, body: lexical(content.en.body) },
    ...Object.fromEntries(overlays),
  } as CategoryTexts
}
