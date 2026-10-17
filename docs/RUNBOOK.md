# Runbook

Operational notes for kefkenahsap.com. Secrets are never written here.

## Infrastructure map

| Piece | Where |
|---|---|
| Server | 45.196.28.107 (`ssh senrecep`), Dokploy, Docker 28 |
| Dokploy project | `kefkenahsap` — environments `development` (development.kefkenahsap.com) and `production` |
| Cloudflare zone | kefkenahsap.com (Free plan, SSL Full) |
| R2 buckets | `kefkenahsap` (prod media, public via `cdn.kefkenahsap.com`), `kefkenahsap-dev` (dev media, `cdn-dev.kefkenahsap.com`), `kefkenahsap-backups` (private, DB dumps and volume archives). Lead photos and the clean originals of watermarked uploads are **not** in R2: they live on private disk volumes (`lead-photos`, `media-originals`), never served by the CDN; a private bucket for them needs a new owner token (#51) |
| Cache rule | `kefken: cdn immutable` — 1 year edge + browser on both CDN hosts |
| Turnstile | widget `kefkenahsap` (kefkenahsap.com, development.kefkenahsap.com, localhost) |
| Old WordPress | still at güzelhosting (104.247.167.3) behind the apex/www records until launch (#53) |

## CI runner (self-hosted)

GitHub-hosted Actions minutes are unavailable for this account (billing), so CI runs on two self-hosted runners on the server (two PRs check in parallel).

- Containers `kefken-gh-runner-1` / `-2` (`myoung34/github-runner:ubuntu-noble`), `--network host`, Docker socket mounted, label `kefken`, restart `unless-stopped`.
- Work dirs are `/var/lib/kefken-runner-<n>` on the root disk. **Not `/tmp`**: it is a 2 GB tmpfs on the server, and two Next builds + Playwright filled it (ENOSPC mid-job).
- Jobs use service containers on **ephemeral host ports** (the server runs other stacks), exported to the job env in the "Point env at this job's service ports" step.
- A run on a superseded commit keeps its runner busy; cancel it (`gh run cancel <id>`) when a newer push is waiting.
- Re-register (e.g. after a container is removed), for `N` in 1 2:

```sh
N=1; TOKEN=$(gh api -X POST repos/senrecep/kefkenahsap/actions/runners/registration-token -q .token)
ssh senrecep "docker rm -f kefken-gh-runner-$N; mkdir -p /var/lib/kefken-runner-$N; docker run -d --name kefken-gh-runner-$N --restart unless-stopped --network host \
  -e REPO_URL=https://github.com/senrecep/kefkenahsap -e RUNNER_TOKEN=$TOKEN -e RUNNER_NAME=senrecep-kefken-$N \
  -e LABELS=kefken -e RUNNER_SCOPE=repo -e RUNNER_WORKDIR=/var/lib/kefken-runner-$N -e DISABLE_AUTOMATIC_DEREGISTRATION=true \
  -v /var/run/docker.sock:/var/run/docker.sock -v /var/lib/kefken-runner-$N:/var/lib/kefken-runner-$N myoung34/github-runner:ubuntu-noble"
```

- Security: the runner has the host Docker socket, so CI only runs PRs from branches of this (private) repository; forks never reach it. Workflow token is `contents: read`. Keep fork-PR workflows disabled in repo settings.
- Delete stale registrations: `gh api repos/senrecep/kefkenahsap/actions/runners` → `DELETE .../runners/<id>`.

## Deploys

`development` / `main` pushes → CI `check` → `deploy` job calls Dokploy `compose.deploy` with the environment's `DOKPLOY_API_KEY` secret and `DOKPLOY_COMPOSE_ID` variable (GitHub environments `development` / `production`).

### Development environment

- Dokploy compose `app` (id `4bzOPqDN2wxfKo-57uaGV`) in project `kefkenahsap` / environment `development`, raw compose = `docker-compose.dokploy.yml`, isolated deployment.
- Domain `development.kefkenahsap.com` → service `app:3000`, Let's Encrypt; Cloudflare proxied.
- Env vars live only in Dokploy (generated secrets) and in the owner's local `.dokploy-dev.env`; basic-auth credentials in the owner's local `development-access.txt`.
- When `docker-compose.dokploy.yml` changes, update the raw compose in Dokploy (`compose.update` with the file content) before deploying.
- `SITE_ENV` in the Dokploy env must equal the CI environment name (`development`/`production`): the compose runs image `kefkenahsap-app:${SITE_ENV}` with `pull_policy: never`.
- Production: deploy job is disabled until the repo variable `PRODUCTION_DEPLOY_APPROVED=true` is set by the owner (GitHub plan has no environment reviewers).

### Production environment

- Dokploy compose `app` (id `e9_MpMOeFkF1QLwEItoeq`, appName `compose-reboot-haptic-feed-t5r4ra`) in project `kefkenahsap` / environment `production`, raw compose = `docker-compose.dokploy.yml`, isolated deployment. The same environment holds the unrelated `wood-material-calculator` stack.
- Env in Dokploy and in the owner's local `.dokploy-prod.env`; `COMPOSE_PROFILES=backup`, no basic auth.
- Cutover steps (deploy gate, seed, domain/TLS, DNS, rollback): `docs/LAUNCH.md`.

### New image sizes for existing media

When `Media.upload.imageSizes` gains a size (`w480` in #116, `w800` and the 400×711 phone-hero `portrait` crop in #129), the deploy runs the migration, but existing approved media only gets the new size from a one-off script. Until it runs, the home hero on phones keeps cropping the landscape w960.
- It is idempotent: it skips media that already has the size or whose original isn't wider, so a re-run only does what is left.
- It reads each original from S3, writes only the new derivative and its size entry, and never rewrites the original or the other sizes.
- It prints the database host, bucket and endpoint first. Unless both the database and the S3 endpoint are local, it needs `--yes`.
- `--dry-run` still downloads and encodes every photo (so it takes about as long as a real run) but writes nothing.

```bash
# With the environment's DB tunnelled to localhost (e.g. ssh -L 15432:<pg-container-ip>:5432 <server>) and the
# environment's S3 + MEDIA_PUBLIC_URL values in a local env file (never committed):
set -a; . ./.dokploy-dev.env; set +a
export DATABASE_URL=postgres://<user>:<pass>@localhost:15432/<db>
bun run payload run scripts/media/add-sizes.ts -- --dry-run   # counts only, writes nothing
bun run payload run scripts/media/add-sizes.ts -- --yes       # ~2.5 min for 568 photos locally
```

Check the printed host, bucket and endpoint before adding `--yes`. Run it after the deploy that carries the migration; until then, pages simply use the existing sizes.

### CDN purge of deleted and replaced media (#185)

Media is served from `cdn.kefkenahsap.com` / `cdn-dev.kefkenahsap.com` with a one-year edge cache. Deleting a media document (or replacing its file) removes the objects from R2, but Cloudflare would keep serving them for up to a year. The app therefore purges the exact URLs (main file + every size) through the Cloudflare API after a delete or file replace. It never blocks or fails the save/delete; a failure is logged (`media: CDN purge after … failed`) and sent to GlitchTip when `SENTRY_DSN` is set.
- **Pending (owner):** in Cloudflare → My Profile → API Tokens → Create Custom Token, permission **Zone → Cache Purge → Purge** only, Zone Resources **Include → Specific zone → kefkenahsap.com**, nothing else (no DNS, no edit scopes, no other zones). Put it in the Dokploy env of **both** `development` and `production` as `CLOUDFLARE_PURGE_TOKEN`, with `CLOUDFLARE_ZONE_ID=04160cf76d6ba4ad5d37d83145eaae57`; update the raw compose in Dokploy from `docker-compose.dokploy.yml` (it now passes both variables to `app`), then redeploy. Until then the app logs once `media: CLOUDFLARE_ZONE_ID / CLOUDFLARE_PURGE_TOKEN not set; …` and skips the purge.
- Files deleted before the token was set are still cached: purge them by URL from the Cloudflare dashboard (Caching → Configuration → Custom Purge), or wait out the cache.

### Loading translations

Translations for the locales other than TR/EN live in `seed/i18n/<locale>/`, which mirrors `seed/` (`content/**`, `media-meta/**`, `media-meta-archive/**`). TR/EN text fixes for the seeded photos live in `seed/i18n/sentence-case.json` (titles) and `seed/i18n/text-fixes.json` (any field, e.g. captions). The loaders fill only empty fields and skip missing files. A re-run writes nothing.
- Categories, guides, pages and project stories (drafts only) land as **new drafts**.
- **Publishing a document in any locale also publishes its seeded drafts in every locale.** Payload's `_status` covers the whole document (`localizeStatus` is off). Review ru/de/ar too, or roll the draft back, before publishing.
- Reference locations and photo texts have no drafts, so they are live as soon as they are written. `media-locales` never changes a photo's `status`, so pending archive photos stay pending.
- `media-text-fixes` changes a TR/EN field only while it is still exactly the seeded text. Owner edits are kept.
- `project-story-fixes` (#148) rewrites project titles/stories in every locale only while they are still exactly the old seeded text, and fills `year` only while empty. A published project gets a new published version with just those fields; one with unpublished draft edits is skipped and listed. Run it before re-running `project-drafts.ts` (that script finds projects by the new TR title).
- `content.ts` checks the overlay slugs before writing. A slug used twice in a locale, or already used by another document, stops the run and names the file.
- Every script prints `host:port/database` first and refuses `SITE_ENV=production`. A non-local host needs `--yes`. A tunnelled DB reads as `localhost`, so check the database name and run `--dry-run` first where there is one. `SEED_REMOTE=1` (set by the dev runner) marks the database remote even when it reads as `localhost`, so `--yes` is required.
- `media-locales` and `media-text-fixes` carry on past a failing photo, list its seedKey, and exit 1.

```bash
bun run payload run scripts/seed/content.ts            # categories, pages, guides, reference locations
bun run payload run scripts/seed/project-stories.ts    # draft projects: title + story
bun run payload run scripts/seed/media-locales.ts -- --dry-run && bun run payload run scripts/seed/media-locales.ts
bun run payload run scripts/seed/media-text-fixes.ts -- --dry-run && bun run payload run scripts/seed/media-text-fixes.ts
bun run payload run scripts/seed/project-story-fixes.ts -- --dry-run && bun run payload run scripts/seed/project-story-fixes.ts
```

Editorial picks (#150): `seed/editorial/picks.json` (hero, phone hero, featured projects, category covers, homepage FAQ refs, each with its reason) and `seed/editorial/tags.json` (gallery tags in 5 locales + the raw per-photo values they map from). `scripts/seed/editorial.ts` fills only what is empty: tags are added to photos (never removed), the homepage gets all default sections on an empty layout (else only an empty hero photo / FAQ), projects are featured only while none is, covers only where unset. A document with a pending draft gets a new draft; one whose latest version is published (and the never-configured homepage) is written published. Run `bun run payload run scripts/seed/editorial.ts -- --dry-run`, then without it (after `seed.ts`, `content.ts` and `project-drafts.ts`). The running site caches pages for an hour: restart `bun dev` after clearing `.next/dev/cache/fetch-cache` to see the result locally.

Run these after `seed.ts` and `archive.ts`, and pass flags after `--` (e.g. `-- --yes`). `--force` on the first two overwrites with the committed text, as new drafts. `media-text-fixes.ts -- --seed-files` rewrites the committed `seed/media-meta*` JSONs instead of the DB.

### Guide covers, byline and wood samples (#146)

`scripts/seed/guides-finish.ts` brings guides seeded before #146 up to the committed seed. Per guide (matched by its TR slug) it sets the cover named in `seed/content/guides/<file>.json` (`cover`: the SEO filename of an approved library photo, picked by the guide's related categories) only while the cover is empty, and turns the founder byline (`showAuthor`) on. A checkbox can't tell an owner's deliberate "off" from the old default: pass `--skip-author` if the owner has switched a byline off. In `ahsap-turleri` it replaces the old build notes with the reader-facing table note (in every locale, only while the stored text is still exactly the old one) and inserts the `woodSamples` block after that note, only if absent. Writes go to each guide's latest version: a published guide stays published, a draft stays a draft. A re-run writes nothing. New databases get all of this from `content.ts` (a markdown line `<!-- block:woodSamples -->` becomes the block).

```bash
bun run payload run scripts/seed/guides-finish.ts -- --dry-run && bun run payload run scripts/seed/guides-finish.ts
```

### Re-picked covers and extra category links (#156)

`scripts/seed/editorial-swaps.ts` applies `swaps` and `projectCategories` from `seed/editorial/picks.json`: guide covers, the Korkuluk ve Çit cover and the "Su kenarında…" project hero are re-picked for lighter watermarks, and four projects get a category their photos clearly show. A cover is replaced only while it is still exactly the previous pick (same media id; for the project, no cover and the same first gallery photo). Categories are appended only while a project still has exactly its seeded category. Anything else is the owner's choice and is left alone. Checks run on each document's latest version: published stays published, a pending draft gets a new draft. A re-run writes nothing. Run it after `editorial.ts` and `guides-finish.ts`. New databases still need it for the project hero and the category links.

```bash
bun run payload run scripts/seed/editorial-swaps.ts -- --dry-run && bun run payload run scripts/seed/editorial-swaps.ts
```

### Category rename and new categories (#172)

Run only after the owner has approved it. Until then, the deployed code works with the old data. "Ahşap Yapılar" stays live under its old slugs, and the new slugs (`/tr/sundurma-ve-ahsap-cati`…) redirect to them.

1. **`scripts/seed/categories-rename.ts`** renames the same record to "Sundurma ve Ahşap Çatı" (`CATEGORY_RENAMES` in `src/seed/categories.ts`), so photos, cover, projects and order stay.
   - Per locale, name and slug move only while they still hold the old seeded value.
   - shortDesc, body and FAQ are replaced only while the intro is still the old seeded one. Otherwise only empty fields are filled.
   - Two cases print `WARNING`: the name or slug moves but the owner's edited shortDesc or body stays, or `seo.title`/`seo.description` are set. Check those by hand.
   - A published category with a newer unpublished draft is skipped and the run exits 1. Payload builds every write on the latest version, so publishing the rename would publish that draft as well. `--publish-drafts` does exactly that, on purpose. Use it only after you have looked at the draft (e.g. a seeded `content.ts` draft) in the admin.
2. **`scripts/seed/categories-new.ts`** creates the five new categories with their texts, published in all five locales.
   - An existing one only gets its empty fields filled.
   - A published one with an unpublished draft is skipped and the run exits 1.
3. **`scripts/seed/editorial-swaps.ts`** moves the Sundurma cover from the cabin photo to `ahsap-yapilar/60.webp`, only while the cover is still the old pick.
4. **Make it live:** redeploy the app, or open any category in the admin and save it once (that save runs inside Next and invalidates the category cache). Do this as the last step every time. Without it the running site keeps serving the old answers for up to an hour (see "Cache" below).

```bash
bun run payload run scripts/seed/categories-rename.ts -- --dry-run      # add --publish-drafts if it lists a draft you checked
bun run payload run scripts/seed/categories-rename.ts
bun run payload run scripts/seed/categories-new.ts -- --dry-run && bun run payload run scripts/seed/categories-new.ts
bun run payload run scripts/seed/editorial-swaps.ts -- --dry-run && bun run payload run scripts/seed/editorial-swaps.ts
# then step 4: redeploy, or save a category once in the admin
```

Every script exits 0 on a clean run. A re-run writes nothing.

**Cache:** the scripts run outside Next, so they cannot invalidate the site's `unstable_cache`, which revalidates after 1 hour. Until it does, the running app still serves the old answers:
- `/tr/sundurma-ve-ahsap-cati` keeps redirecting to `/tr/ahsap-yapilar`, which still renders.
- The five new categories answer 404 and are missing from the nav and sitemap.

To make the change live at once, redeploy, or save the category once in the admin (that save runs inside Next and invalidates the tags).

After the rename, every old localized path (`/tr/ahsap-yapilar`, `/en/wooden-structures`, `/ru/derevyannye-konstruktsii`, `/de/holzbauten`, `/ar/hayakil-khashabiya`) answers 308 (permanent) to the new path with the query kept. Before it, the new paths answer 307 (temporary) to the old ones. The check for which slug exists is never cached, so the two can never redirect to each other. The category page does this on a miss (`src/lib/category/rename.ts`). The WordPress `/ahsap-yapilar/` answers 301 to `/tr/sundurma-ve-ahsap-cati`. The old slugs are reserved: no other category may take them.

### Photo taxonomy load (#175)

Loads the owner-approved photo taxonomy (`seed/taxonomy/photo-plan.json`): 156 live photos are moved to their new category, 2,686 archive photos are imported (all published except 20 the tagger doubted), product-type and other tags are added, 43 files with stacked watermarks are replaced, covers are set for the new categories, and same-category duplicates are hidden (set to `pending`, never deleted). Every script only adds, or changes state that is still exactly what the plan expects. Anything else is listed and left alone. A re-run writes nothing. Each script exits 1 if anything failed, and supports `--dry-run`. A remote database (or `SEED_REMOTE=1`) needs `--yes`.

Run this after the #172 steps above. The scripts run on the laptop against the dev database and bucket (the dev runner passes `SEED_REMOTE=1`, `MEDIA_ORIGINALS_DIR` and `KEFKEN_*`). They need:
- `KEFKEN_ARCHIVE`: the `kefken-data/Kaliteli` folder.
- `KEFKEN_WORKSPACE`: the folder holding `kefken-data/` and `image-work/`.
- `KEFKEN_CONCURRENCY`: uploads at once, default 4.
- `MEDIA_ORIGINALS_DIR`: required whenever a stamp is due (4 imports, 8 remedies). The upload hook keeps the clean original of each stamped file there. Run it on the laptop with a **local staging folder**, then copy that folder into the app's `media-originals` volume. Without the copy, the dev app has no clean original for those 12 files.

```bash
export STAGE=$HOME/kefken-media-originals-175 && mkdir -p "$STAGE"
export MEDIA_ORIGINALS_DIR=$STAGE KEFKEN_ARCHIVE=<…>/kefken-data/Kaliteli KEFKEN_WORKSPACE=<…>/kefkenahsap-workspace
STEPS="taxonomy-reassign taxonomy-import taxonomy-tags taxonomy-remedy taxonomy-covers editorial-swaps taxonomy-dedup"
# 1) every dry run first, and read the lists (a later step's dry run cannot see what an earlier step will write)
for s in $STEPS; do bun run payload run scripts/seed/$s.ts -- --dry-run || break; done
# 2) then the real runs, in order
for s in $STEPS; do bun run payload run scripts/seed/$s.ts -- --yes || break; done
# clean originals → the dev app's volume (compose: MEDIA_ORIGINALS_DIR=/app/data/media-originals)
ls "$STAGE" | wc -l                                                    # 12 on a first run
ssh senrecep 'rm -rf /tmp/media-originals-175 && mkdir -p /tmp/media-originals-175'
scp "$STAGE"/* senrecep:/tmp/media-originals-175/
ssh senrecep 'C=compose-hack-multi-byte-system-ysiihc-app-1 D=/app/data/media-originals
  docker cp /tmp/media-originals-175/. $C:$D/ &&
  docker exec -u 0 $C sh -c "chown -R \$(stat -c %u:%g $D) $D" &&
  for f in $(ls /tmp/media-originals-175); do docker exec $C test -s $D/$f || echo "MISSING $f"; done &&
  rm -r /tmp/media-originals-175'
# last: restart the app so its page cache (unstable_cache, 1 h) drops the old answers
ssh senrecep 'docker restart compose-hack-multi-byte-system-ysiihc-app-1'
```

Order matters:
- `taxonomy-tags` runs after the import, so the new photos get their tags on the first pass.
- `taxonomy-dedup` runs last, so it sees the final covers. A copy that a project, cover, homepage or rich-text body uses is never hidden; the other copy is hidden instead, or neither when both are in use.

Import and remedy:
- Each photo is created `pending`, and its final status is written only after its EN texts are in and its stored file has been checked. A run that dies half-way is resumed by the next run.
- A replaced file that fails the check is listed as "replaced but unverified". Check those by hand.
- Finish with the app restart above, as merge-load does (`docker restart` of the app). The scripts cannot invalidate the running app's cache.

### Language review of the 2026-10-16 texts (#180)

`scripts/seed/text-fixes-180.ts` applies the review to a database that already has the #172 categories and the #175 archive photos, plus the AR default meta description in site settings. `seed/i18n/text-fixes-180.json` holds the replaced texts; the new ones are the committed seed. A field is written only while it still holds exactly the replaced text, so owner edits stay. Categories are written published, and one with an unpublished draft is skipped and the run exits 1. Photo `status` is never touched. A re-run writes nothing.

```bash
SEED_REMOTE=1 bun run payload run scripts/seed/text-fixes-180.ts -- --dry-run
SEED_REMOTE=1 bun run payload run scripts/seed/text-fixes-180.ts -- --yes
# then restart the app (or save a category once in the admin), as above
```

## Owner notes (admin)

- **After saving in the admin, the public page shows the new version on the next load** (#192). The revalidate hooks expire the cached data at once (`revalidateTag(tag, { expire: 0 })` in `src/hooks/revalidate.ts`), so the first visit after a save waits for a fresh render (a second or two) instead of showing the old page. Before #192 they used `'max'` (stale-while-revalidate): the first load after a save showed the old version, the next one the new. Still possible after a save: a tab that was already open keeps its page until it is reloaded, and a scripted seed run (no Next runtime) needs an app restart, as the seed sections below say.
- **New photos get their texts in every language** (#192, `tagImage@4`): one AI call writes title, alt text and caption in TR, EN, RU, DE and AR, only into empty fields. Text you typed in any language is never replaced. The photo stays "Onay bekliyor" until you approve it; the Galeri card shows the AI's confidence, whether the photo fits the category (flagged "Kontrol edin" when confidence is under 50% or it does not fit) and the tags "Onayla" will add.
- **Fields under "Yalnızca AI taslakları için"** (Site Bilgileri → Şirket: ekip büyüklüğü, proje sayısı; Kurucu → mesleğe başlama yılı) are not shown on the site. "AI ile taslak" uses them as facts, so fill them only with verified numbers.
- **GA4 ölçüm kimliği** (Site Bilgileri → Sosyal & SEO, admin only): when filled, the site loads that GA4 id (after cookie consent) and the KVKK/cookie texts and the footer "Çerez tercihleri" button follow it; when empty, the build-time `NEXT_PUBLIC_GA_ID` is used. Check this field after deploying #192: a value stored there now wins over the env.

## Observability

### GlitchTip (errors)

- Dev: https://glitchtip-dev.kefkenahsap.com. Compose services `glitchtip-web`/`-worker`/`-migrate` + `kefken-valkey`, enabled by `COMPOSE_PROFILES=observability`; DB `glitchtip` on `kefken-postgres`, owned by its own non-superuser role `glitchtip` (created by `db-init`), not `kefken`. Dokploy domain → `glitchtip-web:8000`, Let's Encrypt; Cloudflare A `glitchtip-dev` proxied. One subdomain level on purpose: Universal SSL does not cover `*.development.kefkenahsap.com`.
- Login: superuser `recepsen@taptoweb.com`, password in the owner's local `glitchtip-dev-access.txt`. Registration is off; add users from the UI (org `kefkenahsap`) or `docker exec <project>-glitchtip-web-1 ./manage.py createsuperuser`.
- Project `kefkenahsap-development`. Its DSN is `SENTRY_DSN` in the Dokploy env; `GLITCHTIP_SECRET_KEY` / `GLITCHTIP_DB_PASSWORD` / `GLITCHTIP_DOMAIN` / `GLITCHTIP_FROM_EMAIL` live there too.
- Before enabling the `observability` profile in an environment:
  - [ ] `GLITCHTIP_SECRET_KEY` set, ≥32 random chars (`openssl rand -base64 48`). GlitchTip itself starts with an empty key, so `glitchtip-migrate` refuses (exit 1) and web/worker never start without one.
  - [ ] `GLITCHTIP_DB_PASSWORD` set, URL-safe (`openssl rand -hex 24`); `glitchtip-migrate` refuses an empty one.
  - [ ] `GLITCHTIP_DOMAIN` = the public `https://` URL (the DSN host comes from it).
  - Recommended: put the GlitchTip host behind Cloudflare Access (Zero Trust, email OTP for the owner) with a bypass for `/api/*/store/` and `/api/*/envelope/`, so only ingestion is public.
- An existing `glitchtip` DB owned by `kefken` (dev before 2026-10-14) is not migrated by `db-init`: stop glitchtip web/worker, `DROP DATABASE glitchtip WITH (FORCE)`, redeploy, then recreate the superuser, org and project and update `SENTRY_DSN`.
- App side: `src/instrumentation.ts` (`onRequestError`) → `src/lib/observability/report.ts`, a small Sentry store-protocol client. Server only: no client SDK, no tracing, no replay. It sends the error type/message/stack, the path without its query, the method and the route; never headers, cookies, bodies or query strings. Message and stack are scrubbed (emails → `[email]`, runs of 9+ digits such as phones, TC kimlik, IBAN → `[num]`) and capped (500 chars / 8 KB). Fire-and-forget with a 2 s timeout and at most 5 reports per minute per error; reporting never fails or delays the request. Errors that Payload catches itself (REST/GraphQL, hooks) are not reported.
- Residual PII risk: scrubbing is pattern-based, so names, addresses or free text that code puts into an error message still reach GlitchTip. Don't build error messages from form input; GlitchTip data stays on our server.
- End-to-end check (only when `SITE_ENV=development`; `DEBUG_ERROR_TOKEN` is in the Dokploy env; dev also needs basic auth unless `SITE_BASIC_AUTH=off`, which opens the site on purpose — pages stay noindex, and the DB must already have a user so `/admin` first-register is closed). **Leave `DEBUG_ERROR_TOKEN` unset in production**; the route is a 404 there anyway.
  `curl -u "$SITE_BASIC_AUTH" -H "x-debug-token: $DEBUG_ERROR_TOKEN" https://development.kefkenahsap.com/api/debug-error` → 500, and a "Debug error (reporter check)" issue appears in GlitchTip. Without the header, or with any `SITE_ENV` other than `development`, the route is a 404.
- Production (at launch): same profile, its own domain (e.g. `glitchtip.kefkenahsap.com`), project and DSN.

### Uptime Kuma

- Existing install in the `tools` project: https://uptime.senrecep.com (container `tools-uptimekuma-ys3qok-uptime-kuma-1`, SQLite). Not part of this compose.
- `/api/health` skips basic auth and returns `{"ok":true}` (200) when the app and DB are up, 503 otherwise.
- Monitors (Add New Monitor):
  1. Type **HTTP(s) - Keyword**, name `kefkenahsap development`, URL `https://development.kefkenahsap.com/api/health`, keyword `"ok":true`, interval 60 s, retries 2, accepted status codes `200-299`; attach the existing notification channel.
  2. At launch: the same for `https://www.kefkenahsap.com/api/health` (`kefkenahsap production`; the apex 301s to www).

## Backups

- Service `kefken-backup` (compose profile `backup`; dev runs `COMPOSE_PROFILES=observability,backup`) runs `pg_dump -Fc` of DB `kefken` daily at `BACKUP_AT` (HHMM, **UTC**; default `0100` = 04:00 Istanbul).
- Location: host `/var/lib/kefken-backups/<SITE_ENV>/kefken-YYYYmmdd-HHMMSS.dump` (dir 700, files 600, root). Dumps hold personal data (leads): never put them in a public bucket.
- Rotation: the newest **14** dumps are kept. A dump is written as `*.part` and must pass `pg_restore -l` before it is renamed, so a failed or corrupt dump never rotates out a good one (stale `*.part` files are removed at start).
- Run one now: `docker exec <project>-kefken-backup-1 touch /backups/.run-now` (picked up within ~20 s). `docker logs <project>-kefken-backup-1` shows `wrote …` and the R2 result.
- Off-site copy: after each dump, rclone (pinned `rclone/rclone:1.75.1` binary, baked into the service image at deploy) copies it to `r2:$BACKUP_S3_BUCKET/<SITE_ENV>/` with its **own** key `BACKUP_S3_ACCESS_KEY_ID` / `BACKUP_S3_SECRET_ACCESS_KEY`, never the app's `S3_*` media key. Only the exact bucket name `kefkenahsap-backups` is accepted; anything else is refused. Access denied is logged as `R2 upload skipped: access denied …; local copy kept`.
- **Pending (owner):** create a dedicated R2 API token, **Object Read & Write scoped to `kefkenahsap-backups` only** (R2 has no write-only permission; no admin scope, no other buckets). Do **not** widen the app's media token. Put it in the Dokploy env as `BACKUP_S3_ACCESS_KEY_ID` / `BACKUP_S3_SECRET_ACCESS_KEY` and redeploy. Add a 30-day lifecycle rule (delete objects after 30 days) on that bucket (PLAN §3.2). Until then the log says `R2 upload skipped: BACKUP_S3_ACCESS_KEY_ID not set (dedicated backup token pending); local copy kept`.
- Private file volumes: in the same run, `lead-photos` (customer photos, personal data) and `media-originals` (clean originals of watermarked admin uploads, #169) are mounted read-only and archived to `/backups/<volume>-YYYYmmdd-HHMMSS.tar.gz` (same `*.part` + `tar -tz` check, newest **14** kept), then copied off-site with the same `upload` step. Without `BACKUP_S3_*` the log says `R2 upload skipped: …; local copy kept`. Restore: `tar -xzf <archive> -C /var/lib/docker/volumes/<project>_<volume>/_data --strip-components=1` with the app stopped.
- Not covered: the `umami` / `glitchtip` DBs.

### Restore

Rehearsed on dev 2026-10-14 into a scratch DB: row counts matched, scratch DB dropped. `<project>` is the Dokploy app name (dev: `compose-hack-multi-byte-system-ysiihc`).

```sh
ssh senrecep
PG=<project>-kefken-postgres-1
F=$(ls -1t /var/lib/kefken-backups/development/kefken-*.dump | head -1)   # or pick one
# 1. Rehearse into a scratch DB and compare counts with the live DB:
docker exec $PG createdb -U kefken kefken_restore_test
docker exec -i $PG pg_restore -U kefken -d kefken_restore_test --no-owner --exit-on-error < "$F"
docker exec $PG psql -U kefken -d kefken_restore_test -Atc "select count(*) from media"
docker exec $PG dropdb -U kefken kefken_restore_test
# 2. Real restore: stop the app, recreate the DB, restore, start the app.
docker stop <project>-app-1
docker exec $PG psql -U kefken -d postgres -c "DROP DATABASE kefken WITH (FORCE)" -c "CREATE DATABASE kefken"
docker exec -i $PG pg_restore -U kefken -d kefken --no-owner --exit-on-error < "$F"
docker start <project>-app-1    # or redeploy from Dokploy
```

From R2 (once enabled): `rclone copyto r2:kefkenahsap-backups/<env>/<file> ./<file>` or download it from the Cloudflare dashboard, then the steps above.
