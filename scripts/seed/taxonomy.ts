// #175: shared by the photo-taxonomy loaders (taxonomy-reassign/-import/-tags/-remedy/-covers.ts): the committed plan,
// the archive metas, the categories by key and the end-of-run summary. Run order on an existing database:
// reassign → import → tags → remedy → covers → editorial-swaps.ts → dedup (tags after import, so the new photos get
// theirs on the first pass; dedup last, so it sees the final covers).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import type { Payload } from 'payload'

import { parsePhotoPlan } from '@/lib/content/schema'
import { SEED_CATEGORIES } from '@/seed/categories'

import type { ArchiveMeta } from './archive-media'
import { unwrap } from './i18n'

export const SEED = path.resolve(process.cwd(), 'seed')
// Photo sources: kefken-data/** and image-work/wp-fetch/** (paths in the plan are relative to this folder).
export const WORKSPACE = process.env.KEFKEN_WORKSPACE ?? path.resolve(process.cwd(), '../..')
export const dryRun = process.argv.includes('--dry-run')
export const dry = dryRun ? '[dry run] ' : ''

export const loadPlan = () => unwrap(parsePhotoPlan(readFileSync(path.join(SEED, 'taxonomy/photo-plan.json'), 'utf8')))

/** Every archive meta by its source, with the folder (category key) it is filed under and its path under seed/. */
export function loadArchiveMetas() {
  const metas = new Map<string, { meta: ArchiveMeta; dir: string; rel: string }>()
  const root = path.join(SEED, 'media-meta-archive')
  for (const dir of readdirSync(root).sort())
    for (const f of readdirSync(path.join(root, dir)).filter((x) => x.endsWith('.json')).sort()) {
      const meta = JSON.parse(readFileSync(path.join(root, dir, f), 'utf8')) as ArchiveMeta
      metas.set(meta.source, { meta, dir, rel: `media-meta-archive/${dir}/${f}` })
    }
  return metas
}

/** Category id by key (src/seed/categories.ts); a missing category stops the run before any write. */
export async function categoryIds(payload: Payload) {
  const ids = new Map<string, number>()
  for (const cat of SEED_CATEGORIES) {
    const doc = (await payload.find({ collection: 'categories', locale: 'tr', draft: true, where: { slug: { in: [cat.slug.tr, cat.key] } }, limit: 1, depth: 0, select: {} })).docs[0]
    if (!doc) throw new Error(`category ${cat.slug.tr} missing (run categories-rename.ts, categories-new.ts first)`)
    ids.set(cat.key, doc.id)
  }
  return ids
}

/** The seeded media by seedKey, with the fields asked for. */
export async function mediaBySeedKey<S extends Record<string, true>>(payload: Payload, select: S) {
  const docs = (await payload.find({ collection: 'media', where: { seedKey: { exists: true } }, pagination: false, limit: 0, depth: 0, select: { seedKey: true, ...select } })).docs
  return new Map(docs.map((d) => [d.seedKey as string, d]))
}

/** A source folder the run reads from; a wrong path stops the run before anything is written. */
export function requireDir(name: string, dir: string) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    console.error(`${name}: no such folder ${dir}`)
    process.exit(1)
  }
  return dir
}

/** KEFKEN_CONCURRENCY: uploads at once, a whole number ≥ 1 (default 4). */
export function concurrency() {
  const n = Number(process.env.KEFKEN_CONCURRENCY ?? 4)
  if (!Number.isInteger(n) || n < 1) {
    console.error(`KEFKEN_CONCURRENCY must be a whole number ≥ 1, got ${process.env.KEFKEN_CONCURRENCY}`)
    process.exit(1)
  }
  return n
}

/**
 * A stamped upload keeps its clean original in MEDIA_ORIGINALS_DIR (Media.ts). Its default is a folder of the machine
 * running the script, which for a remote database (SEED_REMOTE=1) is not the app's volume, so the originals would be
 * lost: a run with any stamp due must name the folder explicitly (RUNBOOK: copy it into the app's volume afterwards).
 */
export function requireOriginalsDir(stampsDue: number) {
  if (dryRun || !stampsDue) return
  if (!process.env.MEDIA_ORIGINALS_DIR) {
    console.error(`${stampsDue} upload(s) will be stamped: set MEDIA_ORIGINALS_DIR to the folder that keeps their clean originals (see docs/RUNBOOK.md)`)
    process.exit(1)
  }
  console.log(`clean originals of ${stampsDue} stamped upload(s) → ${process.env.MEDIA_ORIGINALS_DIR}`)
}

/** Names a new upload must not take: every SEO file name and stored file name stem. */
export async function usedMediaNames(payload: Payload) {
  const docs = (await payload.find({ collection: 'media', pagination: false, limit: 0, depth: 0, select: { seoFilename: true, filename: true } })).docs
  return new Set(docs.flatMap((d) => [d.seoFilename, d.filename && path.parse(d.filename).name]).filter((x): x is string => Boolean(x)))
}

/** Prints the non-empty lists and exits 1 when anything failed. */
export function finish(summary: string, lists: [string, string[]][], failed: string[]): never {
  console.log(`${dry}${summary}`)
  for (const [what, list] of [...lists, ['failed', failed] as [string, string[]]]) if (list.length) console.log(`${what} (${list.length}): ${list.join(' · ')}`)
  process.exit(failed.length ? 1 : 0)
}
