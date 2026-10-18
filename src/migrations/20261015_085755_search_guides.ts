import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// #147: site search covers guides (title + excerpt). Same index shape as 20261014_033742_search; the expression must
// match GROUPS in src/lib/search/search.ts exactly.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE INDEX "guides_locales_search_fts" ON "guides_locales" USING gin (to_tsvector('simple', search_norm(coalesce("title", '') || ' ' || coalesce("excerpt", ''))));
  CREATE INDEX "guides_locales_search_trgm" ON "guides_locales" USING gin (search_norm(coalesce("title", '') || ' ' || coalesce("excerpt", '')) gin_trgm_ops);
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP INDEX IF EXISTS "guides_locales_search_fts";
  DROP INDEX IF EXISTS "guides_locales_search_trgm";
  `)
}
