// #223: applies the owner's 2026-10-18 CHECKLIST answers (src/lib/content/owner-answers.ts) to an already-seeded database,
// in every locale, and turns the author box on for the seeded guides.
// It finds the sentences by text, not by assumption: every document of the content collections and globals is read per
// locale (the latest version) and each rule is applied to its strings, FAQ q/a and Lexical text nodes. A sentence an owner
// already edited no longer matches and is left as is; a re-run writes nothing.
//   --dry-run  prints, per document and locale, each before → after, and writes nothing.
//   --yes      needed for a non-local database (SEED_REMOTE=1 marks a tunnel as remote); SITE_ENV=production is refused.
//              The write is published, all locales (a published write publishes the whole document).
//   --use-draft  a document whose latest version is an unpublished draft is refused (publishing would release the owner's
//              pending edit), and nothing is written. With --use-draft that draft gets the fix as a new draft instead.
// Before writing, every touched document is saved to a snapshot file (all locales, latest and published); if the read-back
// differs, the touched fields are written back and the run exits 1.
// Run: bun run payload run scripts/seed/owner-answers.ts -- --dry-run | --yes [--use-draft]
// The CLI cannot revalidate the running site's cache: restart / redeploy the app afterwards.
import { readdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { type CollectionSlug, type GlobalSlug, getPayload } from 'payload'

import { routing, type Locale } from '@/i18n/routing'
import { applyTextRules, joinedText, OWNER_ANSWER_RULES, type TextRule } from '@/lib/content/owner-answers'
import config from '@/payload.config'

import { guardTarget } from './i18n'

const dryRun = process.argv.includes('--dry-run')
const useDraft = process.argv.includes('--use-draft')
const tag = dryRun ? '[dry run] ' : ''
const COLLECTIONS: { slug: CollectionSlug; drafts: boolean }[] = [
  { slug: 'categories', drafts: true },
  { slug: 'guides', drafts: true },
  { slug: 'pages', drafts: true },
  { slug: 'projects', drafts: true },
  { slug: 'regions', drafts: true },
  { slug: 'tags', drafts: false },
  { slug: 'references', drafts: false },
  { slug: 'media', drafts: false },
]
const GLOBALS: { slug: GlobalSlug; drafts: boolean }[] = [
  { slug: 'siteSettings', drafts: false },
  { slug: 'homepage', drafts: true },
  { slug: 'navigation', drafts: false },
  { slug: 'aiSettings', drafts: false },
]
// System and file fields: never text a reader sees. aiSuggestion is a pending AI draft the owner reviews on its own.
const SKIP = new Set(['id', 'createdAt', 'updatedAt', '_status', 'aiSuggestion', 'aiFailure', 'i18nSync', 'seedKey', 'filename', 'url', 'thumbnailURL', 'sizes', 'seoFilename', 'seoRetiredStems', 'legacyUrls', 'legacyAttachmentUrl'])
const SEEDED_GUIDES = new Set(readdirSync(path.resolve(process.cwd(), 'seed/content/guides')).map((f) => f.replace(/\.json$/, '')))

type Doc = Record<string, unknown>
type Target = { kind: 'collection' | 'global'; slug: string; drafts: boolean; id?: number | string }
type Change = { target: Target; locale: Locale; label: string; pending: boolean; before: Doc; patch: Doc; lines: string[] }

guardTarget(dryRun)
const payload = await getPayload({ config: await config })

const rulesFor = (locale: Locale) => OWNER_ANSWER_RULES.filter((r) => r.locale === locale)
const stats = OWNER_ANSWER_RULES.map(() => ({ hits: 0, applied: 0, manual: [] as string[] }))
const changes: Change[] = []

/** Every string (a plain field, a FAQ q/a, a Lexical text node) that the rules change, as before → after lines. */
const diffLines = (key: string, value: unknown, rules: TextRule[]): string[] => {
  if (typeof value === 'string') {
    const next = applyTextRules(value, rules).value
    return next === value ? [] : [`  ${key}: - ${value}`, `  ${key}: + ${next || '(removed)'}`]
  }
  return value && typeof value === 'object' ? Object.values(value).flatMap((v) => diffLines(key, v, rules)) : []
}

/** The patch for one document in one locale (changed top-level fields), with a readable before → after. */
function plan(target: Target, locale: Locale, doc: Doc, label: string) {
  const rules = rulesFor(locale)
  const patch: Doc = {}
  const lines: string[] = []
  const visible = Object.fromEntries(Object.entries(doc).filter(([key]) => !SKIP.has(key)))
  for (const [key, value] of Object.entries(visible)) {
    const { value: next } = applyTextRules(value, rules)
    if (next === value) continue
    patch[key] = next
    lines.push(...diffLines(key, value, rules))
  }
  // Rule bookkeeping: hits, already in place, or an old sentence split across formatting nodes (fix by hand).
  const joined = joinedText(visible)
  rules.forEach((r) => {
    const s = stats[OWNER_ANSWER_RULES.indexOf(r)]!
    const hit = Object.keys(patch).some((k) => applyTextRules(doc[k], [r]).hits.size > 0)
    if (hit) s.hits++
    else if (r.new && joined.includes(r.new)) s.applied++
    else if (joined.includes(r.old.trim()) && !(r.whole && !joined.split('\n').includes(r.old))) s.manual.push(`${label} [${locale}]`)
  })
  if (target.kind === 'collection' && target.slug === 'guides' && locale === routing.defaultLocale && SEEDED_GUIDES.has(String(doc.slug)) && doc.showAuthor !== true) {
    patch.showAuthor = true
    lines.push(`  showAuthor: ${String(doc.showAuthor)} → true`)
  }
  if (!Object.keys(patch).length) return
  changes.push({ target, locale, label, pending: target.drafts && doc._status !== 'published', before: Object.fromEntries(Object.keys(patch).map((k) => [k, doc[k]])), patch, lines })
}

for (const c of COLLECTIONS) {
  for (const locale of routing.locales) {
    for (let page = 1; ; page++) {
      // draft: true reads each document's latest version, the one a write builds on.
      const res = await payload.find({ collection: c.slug, locale, fallbackLocale: false, draft: c.drafts, depth: 0, limit: 200, page, pagination: true })
      for (const doc of res.docs as unknown as Doc[]) plan({ kind: 'collection', slug: c.slug, drafts: c.drafts, id: doc.id as number }, locale, doc, `${c.slug} ${doc.id} ${String(doc.slug ?? doc.name ?? doc.title ?? doc.seedKey ?? '')}`.trim())
      if (!res.hasNextPage) break
    }
  }
}
for (const g of GLOBALS) {
  for (const locale of routing.locales) {
    const doc = (await payload.findGlobal({ slug: g.slug, locale, fallbackLocale: false, draft: g.drafts, depth: 0 })) as unknown as Doc
    plan({ kind: 'global', slug: g.slug, drafts: g.drafts }, locale, doc, `global ${g.slug}`)
  }
}

const founder = ((await payload.findGlobal({ slug: 'siteSettings', depth: 0 })) as unknown as { founder?: { name?: string | null } }).founder?.name
console.log(`author box: siteSettings.founder.name = ${founder ? `"${founder}"` : '(EMPTY: the guides show no author until it is filled in the admin)'}`)

const pending = [...new Set(changes.filter((c) => c.pending).map((c) => `${c.target.slug} ${c.target.id ?? ''}`.trim()))]
for (const c of changes) console.log(`${tag}${c.label} [${c.locale}]${c.pending ? (useDraft ? ' (unpublished draft: written as a draft)' : ' (unpublished draft: REFUSED)') : ''}\n${c.lines.join('\n')}`)
console.log(`\n${tag}rules (hits · already in place · manual):`)
OWNER_ANSWER_RULES.forEach((r: TextRule, i) => {
  const s = stats[i]!
  console.log(`  [${r.locale}] ${s.hits} · ${s.applied} · ${s.manual.length}  ${r.old.trim().slice(0, 70)}${s.manual.length ? `\n      split across formatting, fix by hand: ${s.manual.join(' · ')}` : ''}`)
})
const docs = new Set(changes.map((c) => `${c.target.slug}:${c.target.id ?? ''}`)).size
console.log(`${tag}owner-answers: ${changes.length} locale write(s) in ${docs} document(s); ${pending.length} with an unpublished draft`)
if (pending.length && !useDraft) {
  console.error(`Unpublished drafts: ${pending.join(' · ')}\nPublishing would release the owner's pending edits. Check them in the admin, then re-run with --use-draft to fix those drafts as drafts. Nothing written.`)
  process.exit(1)
}
if (dryRun || !changes.length) process.exit(0)

// Snapshot of every touched document, all locales, latest and published.
const touched = [...new Map(changes.map((c) => [`${c.target.kind}:${c.target.slug}:${c.target.id ?? ''}`, c.target])).values()]
const snapshot = await Promise.all(
  touched.map(async (t) =>
    t.kind === 'collection'
      ? { ...t, latest: await payload.findByID({ collection: t.slug as CollectionSlug, id: t.id!, locale: 'all', draft: t.drafts, depth: 0 }), published: t.drafts ? await payload.findByID({ collection: t.slug as CollectionSlug, id: t.id!, locale: 'all', draft: false, depth: 0 }).catch(() => null) : null }
      : { ...t, latest: await payload.findGlobal({ slug: t.slug as GlobalSlug, locale: 'all', draft: t.drafts, depth: 0 }), published: t.drafts ? await payload.findGlobal({ slug: t.slug as GlobalSlug, locale: 'all', draft: false, depth: 0 }) : null },
  ),
)
const snapshotFile = path.join(os.tmpdir(), `owner-answers-snapshot-${Date.now()}.json`)
writeFileSync(snapshotFile, JSON.stringify(snapshot))
console.log(`snapshot: ${snapshotFile}`)

const write = async (c: Change, data: Doc) => {
  const draft = c.pending // only reached with --use-draft
  const body = { ...data, ...(c.target.drafts ? { _status: draft ? 'draft' : 'published' } : {}) } as never
  if (c.target.kind === 'collection') await payload.update({ collection: c.target.slug as CollectionSlug, id: c.target.id!, locale: c.locale, draft, data: body, depth: 0, context: { skipAi: true } })
  else await payload.updateGlobal({ slug: c.target.slug as GlobalSlug, locale: c.locale, draft, data: body, depth: 0, context: { skipAi: true } })
}
const read = async (c: Change) =>
  (c.target.kind === 'collection'
    ? await payload.findByID({ collection: c.target.slug as CollectionSlug, id: c.target.id!, locale: c.locale, fallbackLocale: false, draft: c.target.drafts, depth: 0 })
    : await payload.findGlobal({ slug: c.target.slug as GlobalSlug, locale: c.locale, fallbackLocale: false, draft: c.target.drafts, depth: 0 })) as unknown as Doc

const done: Change[] = []
const bad: string[] = []
try {
  for (const c of changes) {
    await write(c, c.patch)
    done.push(c)
  }
  // Read back: no rule matches any more, and no slug moved.
  for (const c of done) {
    const now = await read(c)
    const left = Object.keys(c.patch).filter((k) => applyTextRules(now[k], rulesFor(c.locale)).hits.size > 0)
    const slugBefore = snapshot.find((s) => s.slug === c.target.slug && s.id === c.target.id)?.latest as Doc | undefined
    const slugMoved = 'slug' in now && JSON.stringify((slugBefore?.slug as Doc | undefined)?.[c.locale]) !== JSON.stringify(now.slug)
    if (left.length || slugMoved || (c.patch.showAuthor && now.showAuthor !== true)) bad.push(`${c.label} [${c.locale}]`)
  }
} catch (err) {
  console.error(err)
  bad.push('write error')
}
if (bad.length) {
  console.error(`read-back differs: ${bad.join(' · ')}; writing the old fields back (snapshot: ${snapshotFile})`)
  for (const c of done.reverse()) await write(c, c.before).catch((err: unknown) => console.error(`restore ${c.label} [${c.locale}] failed: ${String(err)}`))
  process.exit(1)
}
console.log(`owner-answers: ${done.length} locale write(s) in ${docs} document(s)${useDraft && pending.length ? `; ${pending.length} kept as drafts` : ', published'}. Restart or redeploy the app to show them.`)
process.exit(0)
