-- Promote a restored DEVELOPMENT dump to PRODUCTION (#53): drop dev-only data, keep one admin, move media off the dev/ prefix.
-- Run inside the target DB's postgres container, AFTER pg_restore of the dev dump (docs/LAUNCH.md, "Data promotion"):
--   psql -U kefken -d <db> -v owner_email=<owner's admin email> -f promote-sanitize.sql                  -- dry run: report, ROLLBACK
--   psql -U kefken -d <db> -v owner_email=<owner's admin email> -v commit=yes -f promote-sanitize.sql    -- the real thing
-- Without -v commit=yes everything runs in one transaction and is rolled back. Any failed check aborts with exit 3.
-- It refuses a DB whose media is not entirely under the dev/ prefix (not a dev dump, or already promoted).
\set ON_ERROR_STOP on
\if :{?owner_email}
\else
  \echo 'refusing: pass -v owner_email=<the one admin to keep>'
  SELECT 1/0 AS missing_owner_email;
\endif

BEGIN;
SELECT set_config('promote.owner', :'owner_email', true);

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM media WHERE prefix IS DISTINCT FROM 'dev';
  IF n > 0 THEN RAISE EXCEPTION 'refusing: % media rows are not under prefix dev (not a dev dump, or already promoted)', n; END IF;
  SELECT count(*) INTO n FROM users WHERE lower(email) = lower(current_setting('promote.owner'));
  IF n <> 1 THEN RAISE EXCEPTION 'refusing: owner % not found in users', current_setting('promote.owner'); END IF;
  -- A 'dev' row means the schema was once pushed, not migrated: prod's migrate-on-boot could then diverge.
  IF EXISTS (SELECT 1 FROM payload_migrations WHERE name = 'dev') THEN RAISE EXCEPTION 'refusing: payload_migrations has a dev (push) row'; END IF;
END $$;

-- Personal data and dev runtime state. Jobs go too: queued AI jobs would call OpenRouter on prod's first boot.
-- ai_usage goes so dev spend never counts toward prod's monthly AI budget.
TRUNCATE leads, leads_rels, lead_photos, users_sessions, payload_preferences, payload_preferences_rels,
  payload_locked_documents, payload_locked_documents_rels, payload_jobs, payload_jobs_log, payload_kv, ai_usage;

DELETE FROM users WHERE lower(email) <> lower(current_setting('promote.owner'));

-- Media: prefix dev → root. Every stored URL column (url, sizes_*_url, thumbnail_u_r_l), found from the schema so a new
-- image size is covered without editing this file.
UPDATE media SET prefix = '';
DO $$
DECLARE c text;
BEGIN
  FOR c IN SELECT column_name FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'media' AND (column_name LIKE '%url' OR column_name = 'thumbnail_u_r_l')
             AND column_name <> 'legacy_attachment_url'
  LOOP
    EXECUTE format($q$UPDATE media SET %1$I = regexp_replace(%1$I, '^https://cdn\.kefkenahsap\.com/dev/', 'https://cdn.kefkenahsap.com/')
                     WHERE %1$I LIKE 'https://cdn.kefkenahsap.com/dev/%%'$q$, c);
  END LOOP;
END $$;

-- Final scan: no text/json column anywhere may still point at a dev or local host.
CREATE TEMP TABLE promote_leftovers (col text, hits bigint) ON COMMIT DROP;
DO $$
DECLARE r record; n bigint;
BEGIN
  FOR r IN SELECT table_name, column_name FROM information_schema.columns c
           JOIN information_schema.tables t USING (table_schema, table_name)
           WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
             AND c.data_type IN ('text', 'character varying', 'jsonb', 'json')
  LOOP
    EXECUTE format($q$SELECT count(*) FROM %I WHERE %I::text ~ '(cdn\.kefkenahsap\.com/dev/|cdn-dev\.kefkenahsap\.com|development\.kefkenahsap\.com|localhost:)'$q$,
                   r.table_name, r.column_name) INTO n;
    IF n > 0 THEN INSERT INTO promote_leftovers VALUES (r.table_name || '.' || r.column_name, n); END IF;
  END LOOP;
END $$;
SELECT * FROM promote_leftovers;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM promote_leftovers) THEN RAISE EXCEPTION 'dev/local URLs left (listed above): fix them on dev, re-dump, re-run'; END IF;
END $$;

SELECT (SELECT count(*) FROM media) AS media, (SELECT count(*) FROM media WHERE prefix <> '') AS media_prefixed,
  (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM leads) AS leads,
  (SELECT name FROM payload_migrations ORDER BY id DESC LIMIT 1) AS last_migration;

\if :{?commit}
\else
  \set commit no
\endif
SELECT :'commit' = 'yes' AS do_commit \gset
\if :do_commit
  COMMIT;
  \echo 'committed'
\else
  ROLLBACK;
  \echo 'dry run: rolled back (add -v commit=yes to apply)'
\endif
