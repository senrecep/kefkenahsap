import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { Err } from 'tsentials/errors'
import { fromAsync, ResultAsync } from 'tsentials/result'

import { routing, type Locale } from '@/i18n/routing'
import type { Category, Media, Project, Tag } from '@/payload-types'

import { normalizeQuery, prefixTsQuery, type NormalizedQuery } from './normalize'

export type SearchResults = { categories: Category[]; media: Media[]; projects: Project[]; tags: Tag[] }

type Group = {
  collection: 'categories' | 'media' | 'projects' | 'tags'
  table: string
  parent: string
  /** Must match the index expression in the `search` migration exactly. */
  doc: string
  /** Public visibility, on the parent row `p`. */
  visible: string
}

export const GROUPS: Group[] = [
  {
    collection: 'categories',
    table: 'categories_locales',
    parent: 'categories',
    doc: `search_norm(coalesce(l."name", '') || ' ' || coalesce(l."short_desc", ''))`,
    visible: `p."_status" = 'published'`,
  },
  {
    collection: 'media',
    table: 'media_locales',
    parent: 'media',
    doc: `search_norm(coalesce(l."title", '') || ' ' || coalesce(l."alt", '') || ' ' || coalesce(l."caption", ''))`,
    visible: `p."status" = 'approved'`,
  },
  {
    collection: 'projects',
    table: 'projects_locales',
    parent: 'projects',
    doc: `search_norm(coalesce(l."title", ''))`,
    visible: `p."_status" = 'published'`,
  },
  { collection: 'tags', table: 'tags_locales', parent: 'tags', doc: `search_norm(coalesce(l."name", ''))`, visible: 'true' },
]

/**
 * Ranked parent ids for one group. Text of every locale is searched (a Turkish visitor may type English and vice versa).
 * Match = FTS prefix query ('simple' config on folded text) OR trigram word similarity (`<%`, pg_trgm default
 * threshold 0.6: "pergole" vs "pergola" = 0.75).
 */
/** Match predicate on the locales row `l`; written to hit the migration's GIN expression indexes. */
export const matchSql = (g: Group, q: NormalizedQuery) => {
  const doc = sql.raw(g.doc)
  return sql`(to_tsvector('simple', ${doc}) @@ to_tsquery('simple', ${prefixTsQuery(q.tokens)}) OR ${q.text} <% ${doc})`
}

function rankedIdsSql(g: Group, q: NormalizedQuery, limit: number) {
  const doc = sql.raw(g.doc)
  return sql`
    SELECT l."_parent_id" AS id,
      max(ts_rank(to_tsvector('simple', ${doc}), to_tsquery('simple', ${prefixTsQuery(q.tokens)})) + word_similarity(${q.text}, ${doc})) AS score
    FROM ${sql.raw(`"${g.table}"`)} l JOIN ${sql.raw(`"${g.parent}"`)} p ON p."id" = l."_parent_id"
    WHERE ${sql.raw(g.visible)}
      AND ${matchSql(g, q)}
    GROUP BY l."_parent_id"
    ORDER BY score DESC, l."_parent_id"
    LIMIT ${limit}`
}

async function rankedIds(payload: Payload, g: Group, q: NormalizedQuery, limit: number): Promise<number[]> {
  const res = await (payload.db as unknown as PostgresAdapter).drizzle.execute(rankedIdsSql(g, q, limit))
  return res.rows.map((r) => Number(r.id))
}

async function hydrate<T extends { id: number }>(payload: Payload, g: Group, ids: number[], locale: Locale): Promise<T[]> {
  if (!ids.length) return []
  const res = await payload.find({
    collection: g.collection,
    locale,
    depth: 1,
    // Public view: populated relations (covers, galleries, categories) obey access too — no pending media or drafts.
    overrideAccess: false,
    draft: false,
    // Untranslated photo titles/alt text show in the default locale rather than as nameless links (as in the gallery).
    ...(g.collection === 'media' ? { fallbackLocale: routing.defaultLocale } : {}),
    limit: ids.length,
    pagination: false,
    where: { id: { in: ids } },
  })
  const byId = new Map((res.docs as unknown as T[]).map((d) => [d.id, d]))
  return ids.flatMap((id) => byId.get(id) ?? [])
}

/** Site search over categories, approved media, published projects and tags; docs come back in `locale`, best first. */
export function searchSite(payload: Payload, raw: string, locale: Locale, opts: { limit?: number } = {}): ResultAsync<SearchResults> {
  const limit = Math.min(100, Math.max(1, Math.trunc(opts.limit ?? 24)))
  return fromAsync(Promise.resolve(normalizeQuery(raw))).andThen((q) =>
    ResultAsync.try(
      async () => {
        const [categories, media, projects, tags] = await Promise.all(
          GROUPS.map(async (g) => hydrate(payload, g, await rankedIds(payload, g, q, limit), locale)),
        )
        return { categories, media, projects, tags } as SearchResults
      },
      (err) => {
        payload.logger.error({ err }, 'search failed')
        return Err.unexpected('Search.QueryFailed', 'Arama şu an yapılamadı.')
      },
    ),
  )
}
