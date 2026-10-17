# Launch: go-live runbook (#53)

Production gets its data by **promoting development**, not by re-seeding. Dev holds the curated state: 16 categories, 53+ tags, 3,222 approved photos with texts in 5 locales, the hero slideshow, editorial picks and the owner's own edits. Most of it was loaded over time by one-off scripts (RUNBOOK → Loading translations, #146, #156, #172, #175, #180), and a re-seed could not reproduce it. The promotion has three parts:
- a sanitized `pg_dump` of the dev DB, restored into prod;
- a server-side copy of the R2 objects from `kefkenahsap/dev/` to the bucket root;
- a copy of the `media-originals` volume.

After launch, **prod is the source of truth for content.** The owner edits in the prod admin. Dev content is never promoted again.

Work through the phases in order and tick each step. Never paste a secret value into this file, a PR or an issue.

## Who does what

| Mark | Meaning |
|---|---|
| **[Owner]** | The owner does it: dashboard clicks, legal or language sign-off, decisions. |
| **[Claude]** | Claude runs it (SSH, Dokploy API, rclone, checks). Anything that writes to prod, DNS, Cloudflare or Dokploy runs **only after the owner says "go" for that phase in chat**. |
| **APPROVAL** | Changes something public or production-wide. The owner's explicit "yes" for **this exact step** is required. A phase-level "go" is not enough. |

**Shell.** Every block is **bash**: start `bash` first, because the login shell is fish. Blocks set their own variables:
```bash
W=~/Documents/projects/senrecep/kefkenahsap-workspace      # workspace (holds .dokploy-prod.env, kefken-data, the repo)
P=compose-reboot-haptic-feed-t5r4ra                        # prod compose appName (id e9_MpMOeFkF1QLwEItoeq)
D=compose-hack-multi-byte-system-ysiihc                    # dev compose appName (id 4bzOPqDN2wxfKo-57uaGV)
```
- Secrets are read from the owner's local env files with `set -a; . file; set +a`, inside a bash that is exited afterwards. Nothing is typed onto a command line.
- R2 commands use the app's media key from `.dokploy-prod.env` through rclone env config. Copies inside the bucket are server-side, so no object passes through the laptop:
```bash
r2env() { set -a; . "$W/.dokploy-prod.env"; set +a
  export RCLONE_CONFIG_R2_TYPE=s3 RCLONE_CONFIG_R2_PROVIDER=Cloudflare RCLONE_CONFIG_R2_ENDPOINT="$S3_ENDPOINT" \
         RCLONE_CONFIG_R2_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY"; }
```

## Current state (2026-10-17)

| Piece | State |
|---|---|
| Prod Dokploy compose | `app`, id `e9_MpMOeFkF1QLwEItoeq`, appName `compose-reboot-haptic-feed-t5r4ra`, project `kefkenahsap` / environment `production`. The `wood-material-calculator` stack sits in the same environment and stays untouched. Raw compose, isolated deployment, auto-deploy off. **Never deployed, no domain.** Its raw compose is **older than the repo file**: no `media-originals` volume, no `CLOUDFLARE_*` (#189). |
| Prod Dokploy env | Saved from `.dokploy-prod.env`: fresh DB/Payload/Umami/GlitchTip secrets, `SITE_ENV=production`, `NEXT_PUBLIC_SITE_URL=https://www.kefkenahsap.com`, `S3_BUCKET=kefkenahsap`, `S3_PREFIX` empty, `MEDIA_PUBLIC_URL=https://cdn.kefkenahsap.com`, `NEXT_PUBLIC_GA_ID=G-S84WKG63MS`, the real Turnstile keys, `SITE_BASIC_AUTH` empty, `COMPOSE_PROFILES=backup`. Missing: `CLOUDFLARE_*`, `BACKUP_S3_*`, `SENTRY_DSN`. |
| GitHub environment `production` | vars `DOKPLOY_COMPOSE_ID`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`; secrets `DOKPLOY_URL`, `DOKPLOY_API_KEY`. `NEXT_PUBLIC_*` values are **baked into the image at build time**, so they must be final before the release merge. |
| Deploy gate | Repo variable `PRODUCTION_DEPLOY_APPROVED` is **not set**: a push to `main` runs CI only. |
| `main` | 90 commits behind `development`. |
| Dev data | Media under `kefkenahsap/dev/` → `https://cdn.kefkenahsap.com/dev/…`. The bucket root is empty. Dev is public (`SITE_BASIC_AUTH=off`) and noindex. |
| Legacy maps | **#190 / PR #193**: 49 of 487 redirect-map targets pointed at files that were replaced (`<name>-1.webp`) or deduplicated away, so they would `301 → 404`. #193 keys every entry by `seedKey` and adds `scripts/seed/legacy-maps.ts`, which refreshes the maps from a database (49 → 0). `media-map.json` entries are `{seedKey, file}` (CDN file); `attachment-map.json` entries are `{seedKey, slug}` (gallery page `/tr/galeri/<slug>`). The maps are baked into the image, so they must match the promoted DB **before the release build**. |

**Prod settings are by design, not by accident.** `SITE_ENV=production` is the only value that makes robots allow crawling and turns noindex off. Canonicals go to `www`. With `SITE_ENV=production` an empty `SITE_BASIC_AUTH` means no auth: `proxy.ts` fails closed only for `development`. Dev keeps `SITE_ENV=development`, so it stays noindex.

## Timeline at a glance

| When | Phase | Length | Public effect |
|---|---|---|---|
| T-7d … T-2d | 1. Prep: owner sign-offs, tokens, env, compose sync, old-site backup, R2 bulk copy | spread over the week | none |
| T-1d | 2. Freeze + release + promotion + verification through a tunnel | ~3 h | none: prod has no DNS yet |
| T0 | 3. Go/no-go, DNS flip, cert, purge | ~45 min, at a low-traffic hour | **site switches** |
| T0 + 1h | 4. Verify live | ~1 h | — |
| T+1d … T+8w | 5. After launch | — | — |
| any time | 6. Rollback | 15 min | site back on WordPress |

---

## Phase 1 — Prep (T-7d … T-2d)

### 1A. Owner sign-offs (blockers for go)

1. [ ] **[Owner]** Native review of the RU / DE / AR texts (UI strings + published content). There is **no per-locale off switch**: `localizeStatus` is off, and a locale is live wherever its slug and title are filled. A locale that isn't ready either ships as is, or needs its slugs cleared on dev **before** the T-1d dump. That second route is a separate issue.
2. [ ] **[Owner]** Lawyer sign-off on the KVKK and cookie texts and the consent design, plus the server country.
3. [ ] **[Owner]** `docs/content/CHECKLIST.md`: answer the open confirmations (content claims, the corridor photo, the 4 caption-derived project claims).
4. [ ] **[Owner]** Decide the items under "Owner decisions" at the end of this file.
5. [ ] **[Owner]** OpenRouter credit on the prod key, for the owner's own admin use only.

### 1B. Tokens and config

6. [ ] **[Owner]** Cloudflare purge token (#185): My Profile → API Tokens → Custom. Permission **Zone → Cache Purge → Purge**, zone `kefkenahsap.com` only. The same token goes to dev and prod.
7. [ ] **[Owner]** R2 backup token (#51): R2 → Manage API tokens → **Object Read & Write, bucket `kefkenahsap-backups` only**. Also add a 30-day lifecycle rule on that bucket. Never widen the app's media token.
8. [ ] **[Owner]** GlitchTip prod. Recommended: the existing instance at https://glitchtip-dev.kefkenahsap.com, org `kefkenahsap`, new project `kefkenahsap-production`, and copy its DSN. The other choice is a separate prod GlitchTip (`observability` profile + its own domain): more work, not needed at launch.
9. [ ] **[Owner → Claude]** Add to `.dokploy-prod.env` (owner, mode 600), then to the prod Dokploy env (Claude, **APPROVAL**):
   `CLOUDFLARE_ZONE_ID=04160cf76d6ba4ad5d37d83145eaae57`, `CLOUDFLARE_PURGE_TOKEN`, `BACKUP_S3_BUCKET=kefkenahsap-backups`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`, `SENTRY_DSN`, `RESEND_API_KEY`, `LEADS_NOTIFY_EMAIL`, `OPENROUTER_API_KEY`. Leave `DEBUG_ERROR_TOKEN` **unset**.
   Check by **names only** that nothing the compose reads is missing (prints names, never values):
   ```bash
   cd "$W/kefkenahsap"
   comm -23 <(grep -oE '\$\{[A-Z_]+' docker-compose.dokploy.yml | tr -d '${' | sort -u) <(cut -d= -f1 "$W/.dokploy-prod.env" | sort -u)
   # anything printed must be optional on purpose (DEBUG_ERROR_TOKEN, GLITCHTIP_*, UMAMI ids if no Umami, BACKUP_AT, S3_REGION/FORCE_PATH_STYLE)
   ```
10. [ ] **[Owner]** GitHub environment `production`: `gh variable list -R senrecep/kefkenahsap -e production` shows the three `NEXT_PUBLIC_*` with prod values. If Umami goes live (decision 6), also set `NEXT_PUBLIC_UMAMI_WEBSITE_ID` and `NEXT_PUBLIC_UMAMI_SRC` now.
11. [ ] **[Claude] APPROVAL. Sync the prod raw compose with the repo (#189).** Dokploy → `kefkenahsap` / production → `app` → General → Raw compose. Replace it with `docker-compose.dokploy.yml` from `development` (it equals `main` after the release), then Save. **Don't deploy.** Over the API this is `compose.update` with `composeFile`. Afterwards, re-read it in the UI and confirm that `media-originals` and `CLOUDFLARE_PURGE_TOKEN` are there.
    - It must happen before the first deploy. Otherwise the first boot has no `media-originals` volume, and the clean originals land in the container and vanish on the next redeploy (the bug #189 found on dev).

### 1C. Old site and DNS safety

12. [ ] **[Owner]** Full cPanel backup at güzelhosting (files + DB), downloaded. WordPress stays there untouched as the rollback target.
13. [ ] **[Owner]** Cloudflare → DNS → Records → **Export**. Keep the file with the backups.
14. [ ] **[Owner] APPROVAL (DNS, safe early).** `mail.kefkenahsap.com` is a DNS-only CNAME → `kefkenahsap.com`. If the apex flips, it would follow to the new server and expose its IP. Replace it with `A mail → 104.247.167.3`, **DNS only**, TTL Auto, at least 1 h before T0.
    - **TTL note:** the apex and www are **proxied**, so resolvers only ever see Cloudflare's IPs. An origin change takes effect at the edge in seconds whatever the TTL, and so does a rollback. No TTL needs lowering. `mail` was the only DNS-only record that followed the apex.

### 1D. Data pre-checks and R2 bulk copy

15. [ ] **[Claude]** #193 (#190) is merged and deployed to dev, and every legacy-map target answers 200 on dev (public HEAD requests, read-only). This is the **legacy targets check**, run again on prod in 2G and at go/no-go:
    ```bash
    G="git -C $W/kefkenahsap"; $G fetch -q origin; S=$(mktemp -d)
    $G show origin/development:src/lib/legacy/media-map.json > $S/media.json; $G show origin/development:src/lib/legacy/attachment-map.json > $S/att.json
    CDN=https://cdn.kefkenahsap.com/dev; SITE=https://development.kefkenahsap.com
    jq -r '.[].file' $S/media.json | sort -u | xargs -P 8 -I{} curl -s -o /dev/null -w '%{http_code} {}\n' "$CDN/{}" | awk '$1!=200'          # must print nothing
    jq -r '.[].slug' $S/att.json   | sort -u | xargs -P 8 -I{} curl -s -o /dev/null -w '%{http_code} {}\n' "$SITE/tr/galeri/{}" | awk '$1!=200'  # must print nothing
    rm -r $S
    ```
    Before #193 this found 49 broken targets; after it, 0.
15b. [ ] **[Claude] APPROVAL (creates and drops a scratch DB on the dev Postgres; dev data untouched).** Rehearse 2C + 2D.9 on real data, so a leftover dev URL in old versions or rich text shows up now, not during the freeze:
    ```bash
    read -rp 'owner admin email: ' OWNER; scp "$W/kefkenahsap/scripts/launch/promote-sanitize.sql" senrecep:/tmp/promote.sql
    ssh senrecep "set -e; PG=$D-kefken-postgres-1; docker cp /tmp/promote.sql \$PG:/tmp/promote.sql
      docker exec \$PG createdb -U kefken kefken_promote_rehearsal
      docker exec \$PG sh -c \"pg_dump -U kefken -d kefken -Fc --exclude-table-data=leads --exclude-table-data=leads_rels --exclude-table-data=lead_photos --exclude-table-data=users_sessions --exclude-table-data='payload_preferences*' --exclude-table-data='payload_locked_documents*' --exclude-table-data='payload_jobs*' --exclude-table-data=payload_kv --exclude-table-data=ai_usage | pg_restore -U kefken -d kefken_promote_rehearsal --no-owner --no-acl --exit-on-error\"
      docker exec \$PG psql -U kefken -d kefken_promote_rehearsal -v owner_email='$OWNER' -f /tmp/promote.sql || true
      docker exec \$PG dropdb -U kefken kefken_promote_rehearsal; docker exec \$PG rm /tmp/promote.sql; rm /tmp/promote.sql"
    ```
    It must end with `dry run: rolled back` and an empty leftover list. A listed column means fixing that text in the dev admin now, then re-running this step.
16. [ ] **[Claude] APPROVAL (writes to the prod bucket root; nothing references it yet).** Bulk server-side copy of `dev/` → root. It's resumable, and it never deletes:
    ```bash
    bash; r2env
    rclone copy r2:kefkenahsap/dev r2:kefkenahsap --checksum --transfers 32 --s3-no-check-bucket --stats 30s   # ~30k objects
    exit
    ```
    - **Never `rclone sync`**: it would delete `dev/`.
    - Make **no HTTP request to `cdn.kefkenahsap.com/<root file>` before this finishes**. The CDN rule caches for a year at the edge, a 404 included.
17. [ ] **[Owner]** Cloudflare → Caching → Custom Purge → `https://cdn.kefkenahsap.com/bahce-ahsap-deck-platformu.webp`. That root URL was requested on 2026-10-14, while the root was still empty, so its 404 may be cached.
18. [ ] **[Claude]** Open the release PR, don't merge it yet. Use a **merge commit** (not squash), so the branches stay in step:
    `gh pr create -R senrecep/kefkenahsap -B main -H development -t "Release F1: launch" -b "Part of #53"`. Wait for green CI.

---

## Phase 2 — Freeze, release, promotion (T-1d, ~3 h)

### 2A. Freeze

1. [ ] **[Owner]** Freeze starts. Nothing merges into `development`, and nobody edits in the **dev admin** until T0 is done. Edits made after the dump are lost on prod. If something must change, redo 2D–2F after it (≈30 min).
2. [ ] **[Claude]** `development` CI is green, and the dev smoke test passes:
   ```bash
   bun scripts/launch/smoke.ts https://development.kefkenahsap.com --media-base https://cdn.kefkenahsap.com/dev
   ```

2b. [ ] **[Claude]** Refresh the legacy maps from the **dev** DB, before the dump and before the release build (the maps are baked into the image). Through the dev DB tunnel (`ssh -f -N -L 15432:<dev pg ip>:5432 senrecep`), in a clean worktree of `origin/development` with the dev env:
   ```bash
   SEED_REMOTE=1 bun run payload run scripts/seed/legacy-maps.ts     # reads only; exits 1 and writes nothing if a photo can't be found
   git diff --stat src/lib/legacy/                                   # empty → go on
   ```
   A non-empty diff (owner photo edits since #193): commit it on a branch, PR to `development`, merge (the one allowed freeze exception), let dev redeploy, re-run 1D.15. Then continue.

### 2B. Release and first prod deploy

3. [ ] **[Owner] APPROVAL.** Open the deploy gate. The prod image is built only by the deploy job that runs on the push to `main`:
   ```bash
   gh variable set PRODUCTION_DEPLOY_APPROVED -R senrecep/kefkenahsap -b true
   ```
3b. [ ] **[Claude]** The prod raw compose still equals the release file (#189 drift): read it with Dokploy `compose.one` (read-only, field `composeFile`) and `diff` it against `git show origin/development:docker-compose.dokploy.yml`. Any difference → redo 1B.11 first.
4. [ ] **[Owner] APPROVAL.** Merge the release PR (merge commit). CI `check`, then `deploy`, then the image `kefkenahsap-app:production`, then Dokploy `compose.deploy`. The stack boots on an **empty DB**, migrations run, and nothing is public: there's no domain.
5. [ ] **[Claude]** Check the stack:
   ```bash
   ssh senrecep "docker ps -a --format '{{.Names}}\t{{.Status}}' | grep $P"         # app, kefken-postgres (healthy), umami, kefken-backup; db-init Exited (0)
   ssh senrecep "docker exec $P-app-1 wget -qO- http://127.0.0.1:3000/api/health"   # {"ok":true}
   ssh senrecep "docker inspect $P-app-1 -f '{{range .Mounts}}{{.Destination}} {{end}}'"   # lists /app/data/media-originals and /app/data/lead-photos
   ssh senrecep "docker exec $P-app-1 sh -c 'for d in lead-photos media-originals; do touch /app/data/\$d/.w && rm /app/data/\$d/.w && echo \$d writable; done'"   # both writable by the app user
   ```

### 2C. Dump dev (sanitized at the source)

6. [ ] **[Claude]** Take a schema-complete dump with the data of dev-only tables left out. Personal data (leads, lead photos, sessions) never leaves dev. The file stays on the server, root-only:
   ```bash
   ssh senrecep "install -d -m 700 /var/lib/kefken-backups/promote && docker exec $D-kefken-postgres-1 pg_dump -U kefken -d kefken -Fc \
     --exclude-table-data=leads --exclude-table-data=leads_rels --exclude-table-data=lead_photos \
     --exclude-table-data=users_sessions --exclude-table-data='payload_preferences*' --exclude-table-data='payload_locked_documents*' \
     --exclude-table-data='payload_jobs*' --exclude-table-data=payload_kv --exclude-table-data=ai_usage \
     > /var/lib/kefken-backups/promote/dev-\$(date -u +%Y%m%d-%H%M).dump && chmod 600 /var/lib/kefken-backups/promote/*.dump && ls -l /var/lib/kefken-backups/promote"
   ```
7. [ ] **[Claude]** The schema matches the release. The newest migration in dev must equal the newest file in `main`:
   ```bash
   ssh senrecep "docker exec $D-kefken-postgres-1 psql -U kefken -d kefken -Atc \"select name from payload_migrations order by id desc limit 1\""
   git -C "$W/kefkenahsap" ls-tree --name-only origin/main src/migrations/ | grep -E '\.ts$' | grep -v index | xargs -n1 basename | sed 's/\.ts$//' | sort | tail -1   # same name
   ```
   If they differ, stop: dev isn't on the release commit.

### 2D. Restore into prod and sanitize — **APPROVAL** (writes the prod DB; still not public)

8. [ ] **[Claude]** Stop the app, recreate the `kefken` DB, and restore. `umami` lives in its own DB on the same server and isn't touched:
   ```bash
   F=$(ssh senrecep 'ls -1t /var/lib/kefken-backups/promote/dev-*.dump | head -1'); echo "$F"
   ssh senrecep "docker stop $P-app-1 && docker exec $P-kefken-postgres-1 psql -U kefken -d postgres -v ON_ERROR_STOP=1 \
     -c 'DROP DATABASE kefken WITH (FORCE)' -c 'CREATE DATABASE kefken' && \
     docker exec -i $P-kefken-postgres-1 pg_restore -U kefken -d kefken --no-owner --no-acl --exit-on-error < $F"
   ```
9. [ ] **[Claude]** Sanitize with `scripts/launch/promote-sanitize.sql`. In one transaction it:
   - truncates dev runtime and personal tables (leads, sessions, preferences, locks, jobs, kv, ai_usage);
   - keeps only the owner's user;
   - moves every media row from prefix `dev` to the root, with every stored URL column rewritten;
   - aborts if any text or JSON column anywhere still holds `cdn.kefkenahsap.com/dev/`, `cdn-dev.`, `development.kefkenahsap.com` or `localhost:`.

   It refuses to run without `owner_email`. It refuses a DB that isn't fully under prefix `dev`, which also blocks a second run. It **rolls back** unless `-v commit=yes` is given. Tested against a dev-shaped scratch copy of the local DB: dry run rolls back, the leftover scan aborts, the commit applies, the re-run is refused.
   ```bash
   scp "$W/kefkenahsap/scripts/launch/promote-sanitize.sql" senrecep:/tmp/promote.sql
   read -rp 'owner admin email: ' OWNER
   ssh senrecep "docker cp /tmp/promote.sql $P-kefken-postgres-1:/tmp/promote.sql && docker exec $P-kefken-postgres-1 psql -U kefken -d kefken -v owner_email='$OWNER' -f /tmp/promote.sql"              # dry run: read the report
   ssh senrecep "docker exec $P-kefken-postgres-1 psql -U kefken -d kefken -v owner_email='$OWNER' -v commit=yes -f /tmp/promote.sql && docker exec $P-kefken-postgres-1 rm /tmp/promote.sql && rm /tmp/promote.sql"
   ```
   Expected report: `media` = dev's count, `media_prefixed 0`, `users 1`, `leads 0`, `last_migration` = step 7.

### 2E. R2 delta and per-file verification

10. [ ] **[Claude]** Delta copy (only what changed since 1D.16), then confirm that **every file the prod DB references** and every legacy-map target exist at the root:
    ```bash
    bash; r2env; S=$(mktemp -d)
    rclone copy r2:kefkenahsap/dev r2:kefkenahsap --checksum --transfers 32 --s3-no-check-bucket
    rclone lsf -R --files-only r2:kefkenahsap --exclude '/dev/**' | sort > $S/root.txt
    ssh senrecep "docker exec -i $P-kefken-postgres-1 psql -U kefken -d kefken -At" <<'SQL' | sort -u > $S/db.txt
    SELECT f FROM media, unnest(ARRAY[filename, sizes_portrait_filename, sizes_w320_filename, sizes_w480_filename, sizes_w640_filename,
      sizes_w800_filename, sizes_w960_filename, sizes_w1280_filename, sizes_w1920_filename]) f WHERE f IS NOT NULL;
    SQL
    comm -23 $S/db.txt $S/root.txt                                                                          # must print nothing
    rclone lsf -R --files-only r2:kefkenahsap/dev | sort > $S/dev.txt
    comm -13 $S/dev.txt $S/root.txt > $S/extra.txt; wc -l < $S/extra.txt   # files deleted on dev after the bulk copy; still public at the root
    # if not 0 (APPROVAL): rclone delete r2:kefkenahsap --files-from $S/extra.txt --s3-no-check-bucket
    git -C "$W/kefkenahsap" show origin/main:src/lib/legacy/media-map.json | jq -r '.[].file' | sort -u | comm -23 - $S/root.txt   # must print nothing
    wc -l $S/db.txt $S/root.txt; rm -r $S; exit
    ```
    If `media.upload.imageSizes` gained a size since this runbook was written, add its `sizes_<name>_filename` to the array.

### 2F. Clean originals volume

11. [ ] **[Claude]** Copy `media-originals` from the dev app to the prod app, file by file, through the server's disk. **Never `lead-photos`.**
    ```bash
    ssh senrecep "set -e; T=\$(mktemp -d); docker cp $D-app-1:/app/data/media-originals/. \$T/; \
      docker start $P-app-1; sleep 5; docker cp \$T/. $P-app-1:/app/data/media-originals/; \
      docker exec -u 0 $P-app-1 chown -R \$(docker exec $P-app-1 id -u):\$(docker exec $P-app-1 id -g) /app/data/media-originals; \
      echo dev=\$(ls \$T | wc -l) prod=\$(docker exec $P-app-1 ls /app/data/media-originals | wc -l); rm -rf \$T"
    ```
    The two counts must match. This step also starts the app again.

### 2G. Secure the admin and verify through a tunnel

12. [ ] **[Claude]** Terminal 2 (bash, stays in the foreground) opens the tunnel:
    ```bash
    PGIP=$(ssh senrecep "docker inspect $P-kefken-postgres-1 -f '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}'" | awk '{print $1}')
    APPIP=$(ssh senrecep "docker inspect $P-app-1 -f '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}'" | awk '{print $1}')
    ssh -N -L 15432:$PGIP:5432 -L 13000:$APPIP:3000 senrecep
    ```
13. [ ] **[Owner]** Log in at http://localhost:13000/admin with the dev credentials, then **change the password at once** (Account). The dev password was exposed in chat. If decision 2 says so, create the editor user. Then check:
    `curl -s http://localhost:13000/api/users/init` → `{"initialized":true}`. This must hold before any domain is added.
13b. [ ] **[Claude]** The baked-in maps match the **prod** DB. Same command, against prod through the tunnel, in a clean worktree of `origin/main` (the release commit), with no `.env`:
    ```bash
    bash; set -a; . "$W/.dokploy-prod.env"; set +a; export DATABASE_URL="postgres://kefken:$POSTGRES_PASSWORD@127.0.0.1:15432/kefken" SEED_REMOTE=1
    bun run payload run scripts/seed/legacy-maps.ts && git diff --stat src/lib/legacy/; exit
    ```
    **A non-empty diff means stop**: the image redirects to files prod doesn't have. Find out why (an edit after the 2b refresh), fix on dev, redo from 2b. Then `git checkout src/lib/legacy/`.
14. [ ] **[Claude]** Legacy targets check on prod: 1D.15 with `CDN=https://cdn.kefkenahsap.com SITE=http://localhost:13000` and the maps from `origin/main`. Both lines print nothing.
14b. [ ] **[Claude]** Smoke-test through the tunnel. Canonicals must be on www, robots must allow crawling, and the CDN root files must exist:
    ```bash
    bun scripts/launch/smoke.ts http://localhost:13000 --site https://www.kefkenahsap.com --production
    ```
15. [ ] **[Claude]** **Full legacy map** against the prod origin: all 2,338 legacy paths (1,169 WP media URLs + 1,169 attachment pages). The first hop must be `301` or `410`, and every 301 target must answer `200`:
    ```bash
    bash; cd "$W/kefkenahsap"; S=$(mktemp -d); export BASE=http://localhost:13000
    { jq -r '.[].source_url' docs/legacy/wp-media.json | sed -E 's#^https?://[^/]+##'; jq -r '.[]' src/lib/legacy/wp-attachment-paths.json; } | sort -u > $S/paths
    hop() { read -r c l < <(curl -sg -o /dev/null -w '%{http_code} %{redirect_url}' "$BASE$1"); printf '%s %s %s\n' "$c" "${l:--}" "$1"; }
    export -f hop; xargs -P 6 -d '\n' -n1 bash -c 'hop "$1"' _ < $S/paths > $S/hops
    awk '{print $1}' $S/hops | sort | uniq -c                      # only 301 and 410
    awk '$1==301{print $2}' $S/hops | sort -u | sed "s#^https://www.kefkenahsap.com#$BASE#" |
      xargs -P 6 -I{} curl -sg -o /dev/null -w '%{http_code} {}\n' '{}' | awk '$1!=200'   # must print nothing
    rm -r $S; exit
    ```
    Before DNS the www targets are checked on the origin through the tunnel, and the CDN targets go straight to the CDN.
16. [ ] **[Owner]** Click through on http://localhost:13000: home in all 5 locales, the hero slideshow, 3 categories, the gallery with tag filters, a project, a guide, the contact page. Content must look exactly like dev.
17. [ ] **[Claude]** First prod backup. Requires 1B.7:
    ```bash
    ssh senrecep "docker exec $P-kefken-backup-1 touch /backups/.run-now; sleep 60; docker logs --tail 8 $P-kefken-backup-1"
    # "wrote /backups/kefken-…dump", the two volume archives, and "uploaded to r2:kefkenahsap-backups/production/…" for each
    ```
    Close the tunnel (Ctrl-C in terminal 2).

### 2H. Dokploy domains — **APPROVAL** (no DNS change; the route only exists on the origin)

TLS: Cloudflare proxies the site, and the zone is on SSL mode **Full** (not strict). Decision 5 picks the origin certificate:
- **A. Let's Encrypt via HTTP-01** (recommended; same as dev and glitchtip-dev). It's issued only after DNS points at the server. Until then Traefik serves its default cert, which mode Full accepts, so there's no outage.
- **B. Cloudflare Origin CA**, `kefkenahsap.com, *.kefkenahsap.com`, 15 years, added in Dokploy → Certificates. Strict mode works from minute one with no ACME dependency, but browsers reject it if a record is ever switched to DNS-only.

18. [ ] **[Claude]** Add to the prod `app` compose: domain `www.kefkenahsap.com`, path `/`, service `app`, port `3000`, HTTPS, cert per decision 5. Also add `kefkenahsap.com` with the same settings (decision 4, recommended): `proxy.ts` (#120, open-redirect fix included) answers every apex request with **one** 301, straight to the final www or legacy target, or a 410. Then **redeploy the compose**: Traefik labels apply only on deploy; data is kept.
    - With option A, each pre-DNS attempt uses 1 of Let's Encrypt's **5 failed validations per hostname per hour**.
19. [ ] **[Claude]** The route answers on the origin:
    ```bash
    for h in www.kefkenahsap.com kefkenahsap.com; do curl -sk -o /dev/null -w "$h %{http_code} %{redirect_url}\n" --resolve $h:443:45.196.28.107 https://$h/tr; done
    # www → 200; apex → 301 https://www.kefkenahsap.com/tr
    ```

---

## Phase 3 — Cutover (T0, ~45 min, at a low-traffic hour)

### Go / no-go (T0 − 15 min)

The owner says "go" only when every box is ticked:
- [ ] 1A sign-offs done (native review, lawyer, checklist), or explicitly waived by the owner.
- [ ] #190 closed (#193 merged); 2b and 2G.13b diffs empty; 2E prints nothing.
- [ ] **Legacy targets check = 0 broken** (was 49 before #193), against the prod origin before DNS:
  ```bash
  M=$(mktemp); git -C "$W/kefkenahsap" show origin/main:src/lib/legacy/media-map.json > $M
  jq -r '.[].file' $M | sort -u | xargs -P 8 -I{} curl -s -o /dev/null -w '%{http_code} {}\n' 'https://cdn.kefkenahsap.com/{}' | awk '$1!=200'   # nothing
  git -C "$W/kefkenahsap" show origin/main:src/lib/legacy/attachment-map.json | jq -r '.[].slug' | sort -u |
    xargs -P 8 -I{} curl -sk -o /dev/null -w '%{http_code} {}\n' --resolve www.kefkenahsap.com:443:45.196.28.107 'https://www.kefkenahsap.com/tr/galeri/{}' | awk '$1!=200'   # nothing
  rm $M
  ```
- [ ] 2G smoke and full legacy map green. Users = 1 (+ editor), password rotated, `/api/users/init` true.
- [ ] First backup is in R2 (2G.17).
- [ ] Freeze held: no dev merges or admin edits since the 2C dump. Otherwise redo 2C–2G (≈30 min).
- [ ] `mail` is an A record since ≥ 1 h (1C.14). The cPanel backup and the zone export are on disk.
- [ ] The rollback steps (phase 6) have been read. The owner is reachable for the next 2 h.

### Cutover steps

1. [ ] **[Owner] APPROVAL.** Cloudflare DNS: change **one** record, `A kefkenahsap.com` `104.247.167.3` → **`45.196.28.107`**, Proxied, TTL Auto. Note the time (UTC) for the rollback lead export.
   - `www` is a CNAME to the apex and follows it.
   - Leave `cpanel`, `cpcontacts`, `webmail`, `whm` and the SRV/TXT records alone: WordPress stays reachable at the old host.
2. [ ] **[Claude]** Cert (option A), within ~1–2 min:
   ```bash
   for h in www.kefkenahsap.com kefkenahsap.com; do echo | openssl s_client -connect 45.196.28.107:443 -servername $h 2>/dev/null | openssl x509 -noout -issuer -enddate; done   # issuer: Let's Encrypt
   ```
   - Still the default cert? Re-save the domain in Dokploy and redeploy; Traefik retries a failed ACME order only on a config change.
   - Two failed re-saves: stop, wait an hour (mode Full keeps the site up meanwhile), and read the Traefik logs.
3. [ ] **[Owner] APPROVAL.** Cloudflare → Caching → **Purge Everything**. It drops the WordPress HTML cached for the apex and www, and any stale CDN 404.
4. [ ] **[Claude]** Smoke on the live domain: `bun scripts/launch/smoke.ts https://www.kefkenahsap.com --production`. A failure that can't be fixed within 30 min → **rollback** (phase 6).

**If the apex has no Dokploy domain** (decision 4 = Cloudflare rules), add these redirect rules before step 1:
- `kefken: apex to www`. When `(http.host eq "kefkenahsap.com")`, then Dynamic `concat("https://www.kefkenahsap.com", http.request.uri.path)`, **301**, preserve query string. WordPress already 301s the apex to www, so it's safe before the flip.
- **After** step 1, and dragged **above** the first: `kefken: apex legacy pages`. When `(http.host eq "kefkenahsap.com" and http.request.uri.path in {"/ahsap-yapilar/" "/boya-tamir-ve-bakim/" "/ciceklik-ve-oturma-grubu/" "/deck-ve-zeminler/" "/ireko-teak/" "/kapi-dolap-ve-seperator/" "/kopru-ve-iskele/" "/korkuluk-ve-cit/" "/merdivenler/" "/mobilya-ve-cila/" "/pergola-ve-kamelyalar/" "/hakkimizda/" "/hizmetlerimiz/" "/iletisim/" "/referanslar/"})`, then Dynamic `concat("https://www.kefkenahsap.com/tr", substring(http.request.uri.path, 0, -1))`, 301, preserve query.
  - Check the `substring` expression in the rule preview before saving. If it's rejected, use static per-page rules (Free plan: 10 rules).
  - With this route, old media and attachment URLs on the apex take **two hops**. That's accepted: Google indexed the old site on www.

---

## Phase 4 — Verify live (T0 + 1h)

1. [ ] **[Claude]** Apex: `curl -sI https://kefkenahsap.com/` → one 301 to `https://www.kefkenahsap.com/`, and `curl -sI 'https://kefkenahsap.com/iletisim/?a=1'` → one 301 to `https://www.kefkenahsap.com/tr/iletisim?a=1`.
2. [ ] **[Claude]** Live legacy sample: 20 random WP media URLs against the domain. Each line must be `301 -> 200` or `410 -> -`:
   ```bash
   jq -r '.[].source_url' docs/legacy/wp-media.json | shuf -n 20 | sed -E 's#^https?://[^/]+##' | while IFS= read -r p; do
     read -r code loc < <(curl -sg -o /dev/null -w '%{http_code} %{redirect_url}' "https://www.kefkenahsap.com$p")
     final=-; [ "$code" = 301 ] && final=$(curl -sg -o /dev/null -w '%{http_code}' "$loc")
     printf '%s -> %s  "%s"\n' "$code" "$final" "$p"
   done | sort
   ```
   The full map already ran in 2G.15. Re-run it with `BASE=https://www.kefkenahsap.com` only if this sample shows anything odd.
3. [ ] **[Owner]** Contact form from a phone: test name, the owner's phone, one photo.
   - Turnstile passes on www. If the widget shows error 110200, add `www.kefkenahsap.com` to the widget's hostnames.
   - The lead is in the admin, the photo is in the private store, and the mail reaches `LEADS_NOTIFY_EMAIL` (Resend).
   - Then delete the test lead.
4. [ ] **[Owner]** GA consent, in a private window with DevTools → Network:
   - No `googletagmanager.com` or `google-analytics.com` request before consent.
   - Accept: `gtag/js?id=G-S84WKG63MS` loads and GA4 Realtime shows the visit.
   - Reject in a second window: no GA requests.
   - Umami, if decision 6 = yes: its script loads, and the visit shows up in the prod Umami.
5. [ ] **[Owner]** Uptime Kuma (https://uptime.senrecep.com): add the `kefkenahsap production` monitor, HTTP(s) - Keyword `https://www.kefkenahsap.com/api/health`, keyword `"ok":true`, 60 s, 2 retries, the existing notification channel.
6. [ ] **[Owner]** GSC, Domain property `kefkenahsap.com` (TXT in Cloudflare):
   - Sitemaps → submit `https://www.kefkenahsap.com/sitemap.xml`.
   - URL Inspection → Request indexing for `/tr` and one category.
   - **No Change of Address**: same domain.
7. [ ] **[Claude]** GlitchTip: no new issues in `kefkenahsap-production`. Cloudflare → Analytics: no 5xx spike.
8. [ ] **[Owner]** Phone spot-check: home, a category, the gallery lightbox, a project, the WhatsApp button, one RU/DE/AR page.
9. [ ] **[Owner]** Freeze ends. `development` takes merges again. From now on, **content is edited only in the prod admin**.

---

## Phase 5 — After launch

| When | Who | What |
|---|---|---|
| T+1d | Claude | The nightly backup ran (`docker logs $P-kefken-backup-1`) and reached R2. Delete the promotion dump: `ssh senrecep 'rm -r /var/lib/kefken-backups/promote'`. |
| T+1d | Claude | #62: geolyt **baseline** on prod → `docs/geo/`. |
| T+1d | Owner + Claude, **APPROVAL** | Lock dev down again: set `SITE_BASIC_AUTH` back to a credential in the dev Dokploy env and redeploy, and rotate the dev admin password (it was exposed in chat). Dev stays noindex either way; this keeps its admin and contact form away from the public. |
| T+1d … T+3d daily, then weekly to week 8 | Owner + Claude | 404 watch. GSC → Pages → "Not found (404)". `curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' '<url>'`: 410 = intended, 404 = missing redirect (add it in admin → Redirects, then "Validate fix"), 301 = fixed. Also Cloudflare → HTTP Traffic, filtered on 404 for www. Traefik access logs are off server-wide; turning them on is the owner's call (Dokploy → Settings → Requests). |
| T+1w | Owner | #54: GBP website link `https://www.kefkenahsap.com/tr?utm_source=gbp&utm_medium=organic`, GA4 ↔ GSC link, Instagram handle and founding year in siteSettings. |
| T+1w | Claude | #189 permanent fix: the CI deploy job also sends the compose file (`compose.update`) before `compose.deploy`, so Dokploy can't drift from the repo again. |
| T+2w | Claude | **#53 acceptance:** every URL in GSC "Not found" checks as 301 or an intended 410 (zero true 404s). Then close #53. |
| T+4w | Claude | #62 re-measure, and open the follow-ups → #66. |
| later, optional | Owner, **APPROVAL** | SSL **Full (strict)**: zone-wide. First check the origin certs of www, development and glitchtip-dev, and the cPanel hosts with `openssl s_client`. Stay on Full if any cPanel host lacks a valid cert. |
| later, optional | Owner | Dedicated domain for the admin, or Cloudflare Access for `/admin` (not in the plan; open an issue if wanted). |

---

## Phase 6 — Rollback — **APPROVAL**

**Triggers:** the live smoke test fails and can't be fixed within 30 min; persistent 5xx (Cloudflare analytics or GlitchTip); or a data problem visible to visitors.

**Before T0** (phases 1–2), nothing is public, so there is nothing to roll back. Fix the cause and redo the step. The promotion is repeatable from 2C.

**After T0.** WordPress is still live on 104.247.167.3 and its records were never deleted:
1. [ ] **[Claude]** Export the leads received since the cutover. They are personal data: keep the file private, and delete it once they're handled:
   ```bash
   ssh senrecep "docker exec $P-kefken-postgres-1 psql -U kefken -d kefken -c \"COPY (SELECT * FROM leads WHERE created_at >= '<T0, UTC>') TO STDOUT WITH CSV HEADER\"" > leads-after-cutover.csv
   ```
   Their photos stay in the `lead-photos` volume.
2. [ ] **[Owner]** Cloudflare DNS: `A kefkenahsap.com` → **`104.247.167.3`**, Proxied. `www` follows through its CNAME.
3. [ ] **[Owner]** If `kefken: apex legacy pages` exists, disable it: its `/tr/<slug>` targets don't exist on WordPress. Keep `kefken: apex to www`.
4. [ ] **[Owner]** Purge Everything.
5. [ ] **[Owner]** GSC: remove the sitemap. Uptime Kuma: pause `kefkenahsap production`.
6. [ ] **[Owner]** Stop prod deploys: `gh variable delete PRODUCTION_DEPLOY_APPROVED -R senrecep/kefkenahsap`.
7. [ ] Expect a tail of up to **24 h** from browser caches. The app's legacy 301s carry `max-age=86400`, so a returning visitor may still land on a `/tr/…` path, which 404s on WordPress. Purging doesn't reach browsers.
8. [ ] Leave `mail` as its A record, and leave the prod stack running: no traffic reaches it. Keep the prod DB: it now holds the cutover-window leads.
9. [ ] **[Claude]** Write what failed into #53 before the next attempt.

---

## Owner decisions

| # | Decision | Recommendation |
|---|---|---|
| 1 | Launch date and T0 hour; freeze window (from the T-1d dump to the end of T0) | A weekday morning, low traffic, with the owner reachable for 2 h. |
| 2 | Users on prod: the owner only, or the owner + a fresh editor account | Owner only; create the editor in the prod admin if needed. Dev test users never move. |
| 3 | RU / DE / AR without native review: ship them, or hold some (no per-locale switch; holding = clear the slugs on dev before the dump) | Ship only the reviewed ones; TR/EN always. |
| 4 | Apex: a Dokploy domain (one hop, done by `proxy.ts`) or Cloudflare redirect rules (two hops for media) | Dokploy apex domain. |
| 5 | Origin TLS: Let's Encrypt (A) or Cloudflare Origin CA (B) | A, same as dev. |
| 6 | Umami at launch (needs a public domain such as `stats.kefkenahsap.com` + website id baked before the merge) or GA only | GA only at launch; Umami as a follow-up. |
| 7 | GlitchTip for prod: a new project in the existing instance, or a separate prod instance | A new project in the existing one. |
| 8 | Lawyer KVKK/cookie sign-off: a hard blocker, or launch with the current texts | Hard blocker (personal data + consent). |
| 9 | R2 backup token (#51) before T0 | Required: prod content is no longer reproducible from seeds. |
| 10 | Traefik access logs (server-wide) for the 404 watch | Off; GSC + Cloudflare analytics are enough. |
