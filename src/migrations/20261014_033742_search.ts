import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// #29 search: Turkish-aware folding (mirrors src/lib/search/normalize.ts foldText) + FTS ('simple') and trigram indexes.
// Index expressions must match the ones in src/lib/search/search.ts exactly.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE EXTENSION IF NOT EXISTS unaccent;
  CREATE OR REPLACE FUNCTION search_norm(text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$ SELECT lower(public.unaccent('public.unaccent'::regdictionary, translate($1, 'İIı', 'iii'))) $$;

  CREATE INDEX "media_locales_search_fts" ON "media_locales" USING gin (to_tsvector('simple', search_norm(coalesce("title", '') || ' ' || coalesce("alt", '') || ' ' || coalesce("caption", ''))));
  CREATE INDEX "media_locales_search_trgm" ON "media_locales" USING gin (search_norm(coalesce("title", '') || ' ' || coalesce("alt", '') || ' ' || coalesce("caption", '')) gin_trgm_ops);
  CREATE INDEX "categories_locales_search_fts" ON "categories_locales" USING gin (to_tsvector('simple', search_norm(coalesce("name", '') || ' ' || coalesce("short_desc", ''))));
  CREATE INDEX "categories_locales_search_trgm" ON "categories_locales" USING gin (search_norm(coalesce("name", '') || ' ' || coalesce("short_desc", '')) gin_trgm_ops);
  CREATE INDEX "projects_locales_search_fts" ON "projects_locales" USING gin (to_tsvector('simple', search_norm(coalesce("title", ''))));
  CREATE INDEX "projects_locales_search_trgm" ON "projects_locales" USING gin (search_norm(coalesce("title", '')) gin_trgm_ops);
  CREATE INDEX "tags_locales_search_fts" ON "tags_locales" USING gin (to_tsvector('simple', search_norm(coalesce("name", ''))));
  CREATE INDEX "tags_locales_search_trgm" ON "tags_locales" USING gin (search_norm(coalesce("name", '')) gin_trgm_ops);
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP INDEX IF EXISTS "media_locales_search_fts";
  DROP INDEX IF EXISTS "media_locales_search_trgm";
  DROP INDEX IF EXISTS "categories_locales_search_fts";
  DROP INDEX IF EXISTS "categories_locales_search_trgm";
  DROP INDEX IF EXISTS "projects_locales_search_fts";
  DROP INDEX IF EXISTS "projects_locales_search_trgm";
  DROP INDEX IF EXISTS "tags_locales_search_fts";
  DROP INDEX IF EXISTS "tags_locales_search_trgm";
  DROP FUNCTION IF EXISTS search_norm(text);
  `)
}
