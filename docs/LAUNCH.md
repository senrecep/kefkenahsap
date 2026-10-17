# Launch: go-live runbook (#53)

Production gets its data by **promoting development**, not by re-seeding. Dev holds the curated state: 16 categories, 53+ tags, 3,222 approved photos with texts in 5 locales, the hero slideshow, editorial picks and the owner's own edits. Most of it was loaded over time by one-off scripts (RUNBOOK → Loading translations, #146, #156, #172, #175, #180), and a re-seed could not reproduce it. The promotion has three parts:
- a sanitized `pg_dump` of the dev DB, restored into prod (`scripts/launch/promote-sanitize.sql`);
- a server-side copy of the R2 objects from `kefkenahsap/dev/` to the bucket root;
- a verified copy of the `media-originals` volume (`scripts/launch/copy-volume.sh`).

After launch, **prod is the source of truth for content.** The owner edits in the prod admin. Dev content is never promoted again. Once prod has taken a lead, a re-promotion is refused unless the leads are exported and put back (phase 6, "Re-attempt").

Work through the phases in order and tick each step. Never paste a secret value into this file, a PR or an issue.

## Who does what

| Mark | Meaning |
|---|---|
| **[Owner]** | The owner does it: dashboard clicks, legal or language sign-off, decisions. |
| **[Claude]** | Claude runs it (SSH, Dokploy API, rclone, checks). Anything that writes to prod, DNS, Cloudflare or Dokploy runs **only after the owner says "go" for that phase in chat**. |
| **APPROVAL** | Changes something public or production-wide. The owner's explicit "yes" for **this exact step** is required. A phase-level "go" is not enough. |

## Shell model

- Every block is **bash** (the login shell is fish) and must work in a **fresh shell**. Each one runs as a `( subshell )`, which starts with `set -euo pipefail` and sources the launch env:
  ```bash
  . ~/Documents/projects/senrecep/kefkenahsap-workspace/kefkenahsap-wt/launch/scripts/launch/env.sh
  ```
  `env.sh` defines names only: `W L P D SERVER_IP` and the tunnel ports. It also defines these helpers:
  - `loadenv <file>`: loads an env file's values;
  - `r2env`: the rclone remote `r2`, from the prod media key;
  - `pgurl <port>`: a tunnelled DB URL, with the password URL-encoded and read from the env;
  - `tunnel_open` / `tunnel_close`: background SSH forwards with a control socket and `ExitOnForwardFailure=yes`;
  - `need <file> <min lines>`: fails a check whose listing came back empty or short.
- Secrets are only ever loaded **inside** the subshell, so they die with it. A password is read with `read -rs` and piped on stdin, never put in argv or a file.
- Each tunnel has its own local port: prod Postgres `15432`, prod app `13000`, dev Postgres `25432`. A forgotten tunnel can never point a command at the wrong DB.
- Remote multi-line work runs as `ssh senrecep bash -s -- <args> <<'EOS' … EOS`. The heredoc is quoted, so there is no escaping: the script runs on the server with `set -euo pipefail`.

## Current state (2026-10-17)

| Piece | State |
|---|---|
| Prod Dokploy compose | `app`, id `e9_MpMOeFkF1QLwEItoeq`, appName `compose-reboot-haptic-feed-t5r4ra`, project `kefkenahsap` / environment `production`. The `wood-material-calculator` stack sits in the same environment and stays untouched. Raw compose, isolated deployment, auto-deploy off. **Never deployed, no domain.** Its raw compose is **older than the repo file**: no `media-originals` volume, no `CLOUDFLARE_*` (#189). |
| Prod Dokploy env | Saved from `.dokploy-prod.env`: fresh DB/Payload/Umami/GlitchTip secrets, `SITE_ENV=production`, `NEXT_PUBLIC_SITE_URL=https://www.kefkenahsap.com`, `S3_BUCKET=kefkenahsap`, `S3_PREFIX` empty, `MEDIA_PUBLIC_URL=https://cdn.kefkenahsap.com`, `NEXT_PUBLIC_GA_ID=G-S84WKG63MS`, the real Turnstile keys, `SITE_BASIC_AUTH` empty, `COMPOSE_PROFILES=backup`. Missing: `CLOUDFLARE_*`, `BACKUP_S3_*`, `SENTRY_DSN`. |
| GitHub environment `production` | vars `DOKPLOY_COMPOSE_ID`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`; secrets `DOKPLOY_URL`, `DOKPLOY_API_KEY`. `NEXT_PUBLIC_*` values are **baked into the image at build time**, so they must be final before the release merge. |
| Deploy gate | Repo variable `PRODUCTION_DEPLOY_APPROVED` is **not set**: a push to `main` runs CI only. Once it is set, **every** push to `main` deploys prod. |
| `main` | 90+ commits behind `development`. |
| Dev data | Media under `kefkenahsap/dev/` → `https://cdn.kefkenahsap.com/dev/…`. The bucket root is empty. Dev is public (`SITE_BASIC_AUTH=off`) and noindex. |
| Legacy maps | #190 / #193: 49 of 487 redirect-map targets pointed at replaced or deduplicated files. They are now keyed by `seedKey`, and `scripts/seed/legacy-maps.ts` refreshes them from a database. `media-map.json` = `{seedKey, file}` (CDN file). `attachment-map.json` = `{seedKey, slug}` (gallery page `/tr/galeri/<slug>`). The maps are **baked into the image**, so they must match the promoted DB before the release build. |
| Admin over the tunnel | Read-only. Payload's CSRF list holds only `https://www.kefkenahsap.com`, so admin writes from `http://localhost` are refused. **Don't loosen csrf.** The password is set with `scripts/launch/set-password.ts` over the DB tunnel. Other admin work waits until the live domain. |

**Prod settings are by design.** `SITE_ENV=production` is the only value that makes robots allow crawling and turns noindex off. Canonicals go to `www`. With `SITE_ENV=production`, an empty `SITE_BASIC_AUTH` means no auth: `proxy.ts` fails closed only for `development`. Dev keeps `SITE_ENV=development`, so it stays noindex.

## Timeline at a glance

| When | Phase | Length | Public effect |
|---|---|---|---|
| T-7d … T-2d | 1. Prep: sign-offs, tokens, env, compose sync, old-site backup, rehearsal, R2 bulk copy | spread over the week | none |
| T-1d | 2. Freeze, map refresh, release, promotion, verification through tunnels | ~3–4 h | none: prod has no DNS yet |
| T0 | 3. Go/no-go, DNS flip, cert, purge | ~45 min, at a low-traffic hour | **site switches** |
| T0 + 1h | 4. Verify live | ~1 h | — |
| T+1d … T+8w | 5. After launch | — | — |
| any time | 6. Rollback | 15 min | site back on WordPress |

---

## Phase 1 — Prep (T-7d … T-2d)

0. [ ] **[Claude]** Create the launch worktree, detached at `origin/development`, with deps installed and no `.env`. Every later block sources its `env.sh` and runs its scripts:
   ```bash
   ( set -euo pipefail; R=~/Documents/projects/senrecep/kefkenahsap-workspace/kefkenahsap
     git -C "$R" fetch -q origin
     git -C "$R" worktree add --detach "$R/../kefkenahsap-wt/launch" origin/development
     cd "$R/../kefkenahsap-wt/launch"; bun install --frozen-lockfile
     [ ! -e .env ] || { echo 'unexpected .env in the launch worktree'; exit 1; } )
   ```
   To refresh it later (step 2.4 does this): `git -C <launch> fetch -q origin && git -C <launch> checkout -q --detach origin/development`.

### 1A. Owner sign-offs (blockers for go)

1. [ ] **[Owner]** Native review of the RU / DE / AR texts (UI strings + published content). There is **no per-locale off switch**: `localizeStatus` is off, and a locale is live wherever its slug and title are filled. A locale that isn't ready either ships as is, or needs its slugs cleared on dev **before** the T-1d dump. That second route is a separate issue.
2. [ ] **[Owner]** Lawyer sign-off on the KVKK and cookie texts and the consent design, plus the server country.
3. [ ] **[Owner]** `docs/content/CHECKLIST.md`: answer the open confirmations (content claims, the corridor photo, the 4 caption-derived project claims).
4. [ ] **[Owner]** Decide the items under "Owner decisions" at the end of this file.
5. [ ] **[Owner]** OpenRouter credit on the prod key, for the owner's own admin use only.

### 1B. Tokens and config

6. [ ] **[Owner]** Cloudflare purge token (#185): My Profile → API Tokens → Custom. Permission **Zone → Cache Purge → Purge**, zone `kefkenahsap.com` only. The same token goes to dev and prod.
7. [ ] **[Owner]** R2 backup token (#51): R2 → Manage API tokens → **Object Read & Write, bucket `kefkenahsap-backups` only**. Also add a 30-day lifecycle rule on that bucket. Never widen the app's media token.
8. [ ] **[Owner]** GlitchTip prod. Recommended: the existing instance at https://glitchtip-dev.kefkenahsap.com, org `kefkenahsap`, new project `kefkenahsap-production`, and copy its DSN.
9. [ ] **[Owner]** Resend is ready for `bildirim@kefkenahsap.com` (the app's `defaultFromAddress`):
   - Resend → Domains shows `kefkenahsap.com` **Verified**.
   - `dig +short TXT send.kefkenahsap.com` shows the SPF record.
   - `dig +short TXT resend._domainkey.kefkenahsap.com` shows the DKIM key. Both answered on 2026-10-17.
10. [ ] **[Owner → Claude]** Add to `.dokploy-prod.env` (owner, mode 600), then to the prod Dokploy env (Claude, **APPROVAL**):
    `CLOUDFLARE_ZONE_ID=04160cf76d6ba4ad5d37d83145eaae57`, `CLOUDFLARE_PURGE_TOKEN`, `BACKUP_S3_BUCKET=kefkenahsap-backups`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`, `SENTRY_DSN`, `RESEND_API_KEY`, `LEADS_NOTIFY_EMAIL`, `OPENROUTER_API_KEY`. Leave `DEBUG_ERROR_TOKEN` **unset**.
    Check by **names only** that nothing the compose reads is missing, and that the DB password is URL-safe (`pgurl` encodes it anyway; the compose does not). Prints names and a yes/no, never values:
    ```bash
    ( set -euo pipefail; . ~/Documents/projects/senrecep/kefkenahsap-workspace/kefkenahsap-wt/launch/scripts/launch/env.sh
      comm -23 <(grep -oE '\$\{[A-Z_]+' "$L/docker-compose.dokploy.yml" | tr -d '${' | sort -u) <(grep -oE '^[A-Z_]+=' "$W/.dokploy-prod.env" | tr -d = | sort -u)
      loadenv "$W/.dokploy-prod.env"; [[ "$POSTGRES_PASSWORD" =~ ^[A-Za-z0-9._~-]+$ ]] && echo 'POSTGRES_PASSWORD url-safe: yes' || echo 'POSTGRES_PASSWORD url-safe: NO (regenerate with openssl rand -hex 24 before the first deploy)' )
    # names printed by comm must be optional on purpose (DEBUG_ERROR_TOKEN, GLITCHTIP_*, UMAMI ids if no Umami, BACKUP_AT, S3_REGION/FORCE_PATH_STYLE)
    ```
11. [ ] **[Owner]** GitHub environment `production`: `gh variable list -R senrecep/kefkenahsap -e production` shows the three `NEXT_PUBLIC_*` with prod values. If Umami goes live (decision 6), also set `NEXT_PUBLIC_UMAMI_WEBSITE_ID` and `NEXT_PUBLIC_UMAMI_SRC` now.
12. [ ] **[Claude] APPROVAL. Sync the prod raw compose with the repo (#189).** Dokploy → `kefkenahsap` / production → `app` → General → Raw compose. Replace it with `docker-compose.dokploy.yml` from `origin/development`, then Save. **Don't deploy.** (Over the API: `compose.update` with `composeFile`.) Step 2.7 diffs it again right before the gate opens.
    - It must happen before the first deploy. Otherwise the first boot has no `media-originals` volume, and clean originals land in the container and vanish on the next redeploy (#189).

### 1C. Old site and DNS safety

13. [ ] **[Owner]** Full cPanel backup at güzelhosting (files + DB), downloaded. WordPress stays there untouched as the rollback target.
14. [ ] **[Owner]** Cloudflare → DNS → Records → **Export** to `$W/zone-export.txt`, kept with the backups. Then check that only `www` (and `mail`, until step 15) is a CNAME to the apex. `cpanel`, `cpcontacts`, `webmail` and `whm` must be A records to `104.247.167.3`: a CNAME to the apex would move them to the new server at T0.
    ```bash
    awk '$4=="CNAME" && $5 ~ /^kefkenahsap\.com\.?$/ {print $1}' ~/Documents/projects/senrecep/kefkenahsap-workspace/zone-export.txt   # only www. (and mail. before step 15)
    awk '$4=="A" && $1 ~ /^(cpanel|cpcontacts|webmail|whm)\./ {print $1, $5}' ~/Documents/projects/senrecep/kefkenahsap-workspace/zone-export.txt   # four lines, all 104.247.167.3
    ```
15. [ ] **[Owner] APPROVAL (DNS, safe early).** `mail.kefkenahsap.com` is a DNS-only CNAME → `kefkenahsap.com`. If the apex flips, it would follow to the new server and expose its IP. Replace it with `A mail → 104.247.167.3`, **DNS only**, TTL Auto, at least 1 h before T0.
    - **TTL note:** the apex and www are **proxied**, so resolvers only ever see Cloudflare's IPs. An origin change takes effect at the edge in seconds whatever the TTL, and so does a rollback. No TTL needs lowering.

### 1D. Data rehearsal and R2 bulk copy

16. [ ] **[Claude]** **Legacy targets check** on dev. Every media-map file answers 200 on the CDN, and every attachment slug's gallery page answers 200. It's read-only, exits 1 on any miss, and fails closed on empty maps. The same script runs on prod (step 2.20) and at go/no-go:
    ```bash
    ( set -euo pipefail; . ~/Documents/projects/senrecep/kefkenahsap-workspace/kefkenahsap-wt/launch/scripts/launch/env.sh
      "$L/scripts/launch/legacy-targets.sh" origin/development https://cdn.kefkenahsap.com/dev https://development.kefkenahsap.com )
    # "checked 480 files, 480 gallery pages; broken: 0"   (49 broken before #193)
    ```
17. [ ] **[Claude] APPROVAL (creates and drops a scratch DB on the dev Postgres; dev data untouched).** Rehearse 2.9 and 2.13 on real data, so a leftover dev URL in old versions or rich text shows up now, not during the freeze. A trap drops the scratch DB whatever happens:
```bash
( set -euo pipefail; . ~/Documents/projects/senrecep/kefkenahsap-workspace/kefkenahsap-wt/launch/scripts/launch/env.sh
  read -rp 'owner admin email: ' OWNER
  scp "$L/scripts/launch/promote-sanitize.sql" senrecep:/tmp/promote.sql
  ssh senrecep bash -s -- "$D" "$OWNER" <<'EOS'
set -euo pipefail; PG=$1-kefken-postgres-1; OWNER=$2; DB=kefken_promote_rehearsal
trap 'docker exec $PG rm -f /tmp/rehearsal.dump; docker exec $PG dropdb -U kefken --if-exists $DB; docker exec $PG rm -f /tmp/promote.sql; rm -f /tmp/promote.sql' EXIT
docker exec $PG dropdb -U kefken --if-exists $DB; docker exec $PG createdb -U kefken $DB
docker cp /tmp/promote.sql $PG:/tmp/promote.sql
docker exec $PG sh -c "set -e; pg_dump -U kefken -d kefken -Fc --exclude-table-data=leads --exclude-table-data=leads_rels --exclude-table-data=lead_photos --exclude-table-data=users_sessions --exclude-table-data='payload_preferences*' --exclude-table-data='payload_locked_documents*' --exclude-table-data='payload_jobs*' --exclude-table-data=payload_kv --exclude-table-data=ai_usage > /tmp/rehearsal.dump; pg_restore -U kefken -d $DB --no-owner --no-acl --exit-on-error /tmp/rehearsal.dump"
docker exec $PG psql -U kefken -d $DB -v owner_email="$OWNER" -f /tmp/promote.sql
EOS
)
```
It must end with `dry run: rolled back` and an empty leftover list. If a column is listed, fix that text in the dev admin now and re-run.

18. [ ] **[Claude] APPROVAL (writes to the prod bucket root; nothing references it yet).** Bulk server-side copy of `dev/` → root. A dry run comes first, the copy is resumable, and it never deletes:
    ```bash
    ( set -euo pipefail; . ~/Documents/projects/senrecep/kefkenahsap-workspace/kefkenahsap-wt/launch/scripts/launch/env.sh; r2env
      rclone copy r2:kefkenahsap/dev r2:kefkenahsap --checksum --s3-no-check-bucket --dry-run 2>&1 | tail -4   # counts only
      rclone copy r2:kefkenahsap/dev r2:kefkenahsap --checksum --transfers 32 --s3-no-check-bucket --stats 30s )
    ```
    - **Never `rclone sync`**: it would delete `dev/`.
    - Make **no HTTP request to `cdn.kefkenahsap.com/<root file>` before this finishes**. The CDN rule caches for a year at the edge, 404s included.
19. [ ] **[Owner]** Cloudflare → Caching → Custom Purge → `https://cdn.kefkenahsap.com/bahce-ahsap-deck-platformu.webp`. That root URL was requested on 2026-10-14, while the root was still empty, so its 404 may be cached.
20. [ ] **[Claude]** Open the release PR, don't merge it yet. Use a **merge commit** (not squash), so the branches stay in step:
    `gh pr create -R senrecep/kefkenahsap -B main -H development -t "Release F1: launch" -b "Part of #53"`. Wait for green CI.

---

## Phase 2 — Freeze, release, promotion (T-1d, ~3–4 h)

### 2A. Freeze and map refresh

1. [ ] **[Owner]** Freeze starts. Nothing merges into `development`, and nobody edits in the **dev admin** until T0 is done. The one exception is step 3's map PR. Edits made after the dump are lost on prod. If something must change, redo 2.10–2.23 after it (≈45 min).
2. [ ] **[Claude]** `development` CI is green, and the dev smoke test passes:
   ```bash
   ( set -euo pipefail; . ~/Documents/projects/senrecep/kefkenahsap-workspace/kefkenahsap-wt/launch/scripts/launch/env.sh
     cd "$L" && bun scripts/launch/smoke.ts https://development.kefkenahsap.com --media-base https://cdn.kefkenahsap.com/dev )
   ```
3. [ ] **[Claude]** Refresh the legacy maps from the **dev** DB, before the dump and before the release build (the maps are baked into the image). Like RUNBOOK → "New image sizes", it sets `DATABASE_URL` explicitly to the dev tunnel. The tunnel is closed afterwards, even on failure:
   ```bash
   ( set -euo pipefail; . ~/Documents/projects/senrecep/kefkenahsap-workspace/kefkenahsap-wt/launch/scripts/launch/env.sh
     trap 'tunnel_close devpg' EXIT
     git -C "$L" fetch -q origin && git -C "$L" checkout -q --detach origin/development
     tunnel_open devpg "$DEV_PG_PORT" "$D-kefken-postgres-1" 5432
     loadenv "$W/.dokploy-dev.env"; export DATABASE_URL="$(pgurl "$DEV_PG_PORT")" SEED_REMOTE=1
     cd "$L" && bun run payload run scripts/seed/legacy-maps.ts      # reads only; exits 1 and writes nothing if a photo can't be found
     git diff --stat -- src/lib/legacy/; git diff --quiet -- src/lib/legacy/ )   # exit 0 = no change → go on
   ```
   Exit 1 with a diff means owner photo edits since #193. Then:
   - commit the two maps on a branch from the launch worktree (`git -C "$L" switch -c fix/legacy-maps-launch`) and open a PR to `development`;
   - merge it (the one freeze exception) and let dev redeploy;
   - re-run 1.16, then this step, until it exits 0.

### 2B. Release and first prod deploy

4. [ ] **[Claude]** Refresh the launch worktree to the final `origin/development`, which is the release head: `git -C "$L" fetch -q origin && git -C "$L" checkout -q --detach origin/development`.
5. [ ] **[Owner]** The release PR's head is that commit (`gh pr view <release PR> --json headRefOid`), and its CI is green.
6. [ ] **[Claude]** The compose drift check, before the gate opens (#189). Read the prod raw compose with Dokploy `compose.one` (read-only, field `composeFile`). Save it as `/tmp/prod-compose.yml` and run `diff /tmp/prod-compose.yml "$L/docker-compose.dokploy.yml"`. Any difference → redo 1.12 first.
7. [ ] **[Owner] APPROVAL.** Open the deploy gate. The prod image is built only by the deploy job that runs on a push to `main`:
   ```bash
   gh variable set PRODUCTION_DEPLOY_APPROVED -R senrecep/kefkenahsap -b true
   ```
8. [ ] **[Owner] APPROVAL.** Merge the release PR (merge commit). CI runs `check`, then `deploy`. The deploy builds the image `kefkenahsap-app:production` and calls Dokploy `compose.deploy`. The stack boots on an **empty DB**, migrations run, and nothing is public: there's no domain.
   - **Re-release path:** a code fix needed after this point goes as a PR to `development`, then a new `development → main` release PR (merge commit). With the gate open, the push to `main` redeploys on its own. The containers are recreated, and the DB and volumes are kept, so no re-promotion is needed unless the **maps** changed. In that case: step 3, a new release, then 2.18–2.21.
9. [ ] **[Claude]** Check the stack, including that the fresh volumes are writable by the app user:
```bash
( set -euo pipefail; . ~/Documents/projects/senrecep/kefkenahsap-workspace/kefkenahsap-wt/launch/scripts/launch/env.sh
  ssh senrecep bash -s -- "$P" <<'EOS'
set -euo pipefail; P=$1
docker ps -a --format '{{.Names}}\t{{.Status}}' | grep "$P"      # app, kefken-postgres (healthy), umami, kefken-backup up; db-init Exited (0)
docker exec $P-app-1 wget -qO- http://127.0.0.1:3000/api/health; echo   # {"ok":true}
docker inspect $P-app-1 -f '{{range .Mounts}}{{.Name}} -> {{.Destination}}{{"\n"}}{{end}}'   # <P>_lead-photos and <P>_media-originals
docker exec $P-app-1 sh -c 'set -e; for d in lead-photos media-originals; do touch /app/data/$d/.w; rm /app/data/$d/.w; echo "$d writable"; done'
EOS
)
```

### 2C. Dump dev (sanitized at the source)

10. [ ] **[Claude]** Take a schema-complete dump that leaves out the data of the dev-only tables. Personal data (leads, lead photos, sessions) never leaves dev. The file stays on the server (root-only) and is validated with `pg_restore -l`:
```bash
( set -euo pipefail; . ~/Documents/projects/senrecep/kefkenahsap-workspace/kefkenahsap-wt/launch/scripts/launch/env.sh
  ssh senrecep bash -s -- "$D" <<'EOS'
set -euo pipefail; PG=$1-kefken-postgres-1; DIR=/var/lib/kefken-backups/promote
install -d -m 700 $DIR; F=$DIR/dev-$(date -u +%Y%m%d-%H%M).dump
docker exec $PG pg_dump -U kefken -d kefken -Fc \
  --exclude-table-data=leads --exclude-table-data=leads_rels --exclude-table-data=lead_photos \
  --exclude-table-data=users_sessions --exclude-table-data='payload_preferences*' --exclude-table-data='payload_locked_documents*' \
  --exclude-table-data='payload_jobs*' --exclude-table-data=payload_kv --exclude-table-data=ai_usage > "$F.part"
docker exec -i $PG pg_restore -l < "$F.part" > /dev/null   # readable archive, or stop here
mv "$F.part" "$F"; chmod 600 "$F"; ls -l "$F"
docker exec $PG psql -U kefken -d kefken -Atc "select count(*) from media"   # dev's media count, for 2.13 and 2.15
EOS
)
```

11. [ ] **[Claude]** The schema matches the release: the newest migration in dev equals the newest migration file in the release commit.
    ```bash
    ( set -euo pipefail; . ~/Documents/projects/senrecep/kefkenahsap-workspace/kefkenahsap-wt/launch/scripts/launch/env.sh
      a=$(ssh senrecep "docker exec $D-kefken-postgres-1 psql -U kefken -d kefken -Atc 'select name from payload_migrations order by id desc limit 1'")
      b=$(cd "$L/src/migrations" && ls *.ts | grep -v '^index' | sed 's/\.ts$//' | sort | tail -1)
      echo "dev=$a release=$b"; [ -n "$a" ] && [ "$a" = "$b" ] )
    ```
    Exit 1 → stop: dev isn't on the release commit.

### 2D. Restore into prod and sanitize — **APPROVAL** (writes the prod DB; still not public)

12. [ ] **[Claude]** Restore. The script:
    - validates the dump before anything is dropped;
    - **refuses if prod already holds leads**, unless they were exported (phase 6, "Re-attempt");
    - stops the app, recreates `kefken`, and restores.

    `umami` lives in its own DB on the same server and isn't touched.
```bash
( set -euo pipefail; . ~/Documents/projects/senrecep/kefkenahsap-workspace/kefkenahsap-wt/launch/scripts/launch/env.sh
  ssh senrecep bash -s -- "$P" "${LEADS_EXPORTED:-no}" <<'EOS'
set -euo pipefail; P=$1; EXPORTED=$2; PG=$P-kefken-postgres-1
F=$(ls -1t /var/lib/kefken-backups/promote/dev-*.dump | head -1); echo "dump: $F"
docker exec -i $PG pg_restore -l < "$F" > /dev/null
n=$(docker exec $PG psql -U kefken -d kefken -Atc 'select count(*) from leads')   # fails (and stops) if the DB is unreachable
if [ "$n" != 0 ]; then
  [ "$EXPORTED" = yes ] || { echo "refusing: prod holds $n leads. Export them first (phase 6, Re-attempt), then LEADS_EXPORTED=yes"; exit 1; }
  K=/var/lib/kefken-backups/promote/leads-keep.dump
  [ -s "$K" ] || { echo "refusing: LEADS_EXPORTED=yes but $K is missing"; exit 1; }
  k=$(docker exec -i $PG pg_restore -a -t leads -f - < "$K" | awk '/^COPY public.leads /{on=1;next} /^\\\.$/{on=0} on' | wc -l)
  [ "$k" = "$n" ] || { echo "refusing: $K holds $k leads, prod holds $n; re-export (phase 6 step 1)"; exit 1; }
fi
docker stop $P-app-1
docker exec $PG psql -U kefken -d postgres -v ON_ERROR_STOP=1 -c 'DROP DATABASE kefken WITH (FORCE)' -c 'CREATE DATABASE kefken'
docker exec -i $PG pg_restore -U kefken -d kefken --no-owner --no-acl --exit-on-error < "$F"
echo restored
EOS
)
```

13. [ ] **[Claude]** Sanitize with `scripts/launch/promote-sanitize.sql`. In one transaction it:
    - truncates the dev runtime and personal tables (leads, sessions, preferences, locks, jobs, job stats, kv, ai_usage) with `RESTART IDENTITY`;
    - keeps only the owner's user, and resets its lock and reset-token fields;
    - moves every media row from prefix `dev` to the root, with every stored URL column rewritten;
    - aborts if any text or JSON column anywhere still matches a dev or local host (`cdn.kefkenahsap.com/dev/`, `cdn-dev.`, `kefkenahsap-dev`, `development.kefkenahsap.com`, `glitchtip-dev.`, `localhost`, `127.0.0.1`, `kefken-media/`).

    It refuses to run without `owner_email`. It refuses a DB that isn't fully under prefix `dev` (which also blocks a second run) or that has a `dev` push row in `payload_migrations`. It **rolls back** unless `-v commit=yes` is given.
```bash
( set -euo pipefail; . ~/Documents/projects/senrecep/kefkenahsap-workspace/kefkenahsap-wt/launch/scripts/launch/env.sh
  read -rp 'owner admin email: ' OWNER; read -rp 'commit? (yes = apply, anything else = dry run): ' C
  scp "$L/scripts/launch/promote-sanitize.sql" senrecep:/tmp/promote.sql
  ssh senrecep bash -s -- "$P" "$OWNER" "$C" <<'EOS'
set -euo pipefail; PG=$1-kefken-postgres-1
trap 'docker exec $PG rm -f /tmp/promote.sql; rm -f /tmp/promote.sql' EXIT
docker cp /tmp/promote.sql $PG:/tmp/promote.sql
docker exec $PG psql -U kefken -d kefken -v owner_email="$2" -v commit="$3" -f /tmp/promote.sql
EOS
)
```
Run it once as a dry run and read the report. Then run it with `yes`. Expected report: `media` = the 2.10 count, `media_prefixed 0`, `users 1`, `leads 0`, `last_migration` = 2.11, `site_ga_id` = decision 11. Dev's Site Settings → GA ID is copied with the DB, and a valid one **overrides** `NEXT_PUBLIC_GA_ID` (`gaIdOf`, `src/lib/analytics.ts`). If it isn't the prod property, fix it in the prod admin after T0, or on dev before the 2.10 dump.
- Re-attempt with exported leads: put them back now (phase 6, "Re-attempt", step b).

### 2E. R2 delta and per-file verification

14. [ ] **[Claude]** Delta copy (dry run first), then a fail-closed check:
    - every file the prod DB references exists at the root;
    - every media-map file exists at the root;
    - files deleted on dev since the bulk copy are listed.

    Only files at the root level are listed and deleted (`--max-depth 1`): the media keys are flat, and `dev/` is a directory there.
```bash
( set -euo pipefail; . ~/Documents/projects/senrecep/kefkenahsap-workspace/kefkenahsap-wt/launch/scripts/launch/env.sh; r2env
  S=$(mktemp -d); trap 'rm -r "$S"' EXIT
  rclone copy r2:kefkenahsap/dev r2:kefkenahsap --checksum --s3-no-check-bucket --dry-run 2>&1 | tail -4
  rclone copy r2:kefkenahsap/dev r2:kefkenahsap --checksum --transfers 32 --s3-no-check-bucket
  rclone lsf --files-only --max-depth 1 r2:kefkenahsap     | sort > "$S/root.txt"
  rclone lsf --files-only --max-depth 1 r2:kefkenahsap/dev | sort > "$S/dev.txt"
  M=$(ssh senrecep "docker exec $P-kefken-postgres-1 psql -U kefken -d kefken -Atc 'select count(*) from media'")
  ssh senrecep "docker exec -i $P-kefken-postgres-1 psql -U kefken -d kefken -At -v ON_ERROR_STOP=1" <<'SQL' | sort -u > "$S/db.txt"
SELECT f FROM media, unnest(ARRAY[filename, sizes_portrait_filename, sizes_w320_filename, sizes_w480_filename, sizes_w640_filename,
  sizes_w800_filename, sizes_w960_filename, sizes_w1280_filename, sizes_w1920_filename]) f WHERE f IS NOT NULL;
SQL
  git -C "$L" show HEAD:src/lib/legacy/media-map.json | jq -r '.[].file' | sort -u > "$S/map.txt"
  need "$S/db.txt" "$M"; need "$S/dev.txt" "$M"; need "$S/root.txt" "$(wc -l < "$S/dev.txt")"; need "$S/map.txt" 100
  comm -23 "$S/db.txt"  "$S/root.txt" > "$S/missing-db.txt";  [ ! -s "$S/missing-db.txt" ]  || { echo 'DB files missing at root:';  head "$S/missing-db.txt";  exit 1; }
  comm -23 "$S/map.txt" "$S/root.txt" > "$S/missing-map.txt"; [ ! -s "$S/missing-map.txt" ] || { echo 'map files missing at root:'; head "$S/missing-map.txt"; exit 1; }
  comm -13 "$S/dev.txt" "$S/root.txt" > "$S/extra.txt"; n=$(wc -l < "$S/extra.txt")
  echo "media=$M db-files=$(wc -l < "$S/db.txt") dev=$(wc -l < "$S/dev.txt") root=$(wc -l < "$S/root.txt") extra=$n"
  if [ "$n" -gt 0 ]; then
    [ "$n" -le 200 ] || { echo "refusing: $n extra root files is more than a few dev deletions; investigate"; exit 1; }
    rclone delete r2:kefkenahsap --files-from-raw "$S/extra.txt" --max-depth 1 --dry-run 2>&1 | tail -3
    [ "${DELETE_EXTRAS:-}" = yes ] || { echo 'extras listed (deleted on dev, still public at root). After APPROVAL re-run with DELETE_EXTRAS=yes'; exit 1; }
    rclone delete r2:kefkenahsap --files-from-raw "$S/extra.txt" --max-depth 1
  fi )
```
If `media.upload.imageSizes` gained a size since this runbook was written, add its `sizes_<name>_filename` to the array.

### 2F. Clean originals volume — **APPROVAL** (writes a prod volume)

15. [ ] **[Claude]** Volume-to-volume copy of `media-originals` (dev → prod), verified by SHA-256 per file. It never deletes, and it refuses `lead-photos`. Then start the app:
    ```bash
    ( set -euo pipefail; . ~/Documents/projects/senrecep/kefkenahsap-workspace/kefkenahsap-wt/launch/scripts/launch/env.sh
      ssh senrecep bash -s -- "${D}_media-originals" "${P}_media-originals" < "$L/scripts/launch/copy-volume.sh"   # "copied and verified N files"
      ssh senrecep "set -e; docker start $P-app-1; sleep 10; docker exec $P-app-1 wget -qO- http://127.0.0.1:3000/api/health" )
    ```
    Confirm the volume names first with `ssh senrecep "docker volume ls -q | grep media-originals"`: Dokploy names them `<appName>_<volume>`.

### 2G. Secure the admin and verify through tunnels

16. [ ] **[Claude]** Open the prod tunnels (background, with control sockets). They stay open until 2.24:
    ```bash
    ( set -euo pipefail; . ~/Documents/projects/senrecep/kefkenahsap-workspace/kefkenahsap-wt/launch/scripts/launch/env.sh
      tunnel_open prodpg  "$PROD_PG_PORT"  "$P-kefken-postgres-1" 5432
      tunnel_open prodapp "$PROD_APP_PORT" "$P-app-1" 3000
      curl -fsS "http://127.0.0.1:$PROD_APP_PORT/api/health" )
    ```
17. [ ] **[Owner + Claude]** Rotate the owner's password; the dev password was exposed in chat. Over the DB tunnel with `scripts/launch/set-password.ts`, **not** in the admin: CSRF refuses admin writes from `localhost`. The password is typed by the owner, piped on stdin, and verified by a login inside the script:
    ```bash
    ( set -euo pipefail; . ~/Documents/projects/senrecep/kefkenahsap-workspace/kefkenahsap-wt/launch/scripts/launch/env.sh
      loadenv "$W/.dokploy-prod.env"; export DATABASE_URL="$(pgurl "$PROD_PG_PORT")"
      read -rp 'owner email: ' E; read -rsp 'new admin password (≥12 chars): ' PW; echo
      cd "$L" && printf '%s' "$PW" | bun run payload run scripts/launch/set-password.ts -- --email "$E" --yes
      curl -s "http://127.0.0.1:$PROD_APP_PORT/api/users/init"; echo )   # {"initialized":true}
    ```
    `"initialized":true` must hold before any domain is added. The editor user (decision 2) is created in the admin on the live domain, after T0.
18. [ ] **[Claude]** The baked-in maps match the **prod** DB. The same refresh as step 3, against prod. **A non-empty diff means stop**: the image would redirect to files prod doesn't have. Find out why (an edit after step 3), fix it on dev, and redo from step 3.
    ```bash
    ( set -euo pipefail; . ~/Documents/projects/senrecep/kefkenahsap-workspace/kefkenahsap-wt/launch/scripts/launch/env.sh
      trap 'git -C "$L" checkout -q -- src/lib/legacy/' EXIT
      loadenv "$W/.dokploy-prod.env"; export DATABASE_URL="$(pgurl "$PROD_PG_PORT")" SEED_REMOTE=1
      cd "$L" && bun run payload run scripts/seed/legacy-maps.ts
      git diff --stat -- src/lib/legacy/; git diff --quiet -- src/lib/legacy/ )   # must exit 0
    ```
19. [ ] **[Claude]** Smoke test through the tunnel. Canonicals must be on www, robots must allow crawling, and the CDN root files must exist:
    ```bash
    ( set -euo pipefail; . ~/Documents/projects/senrecep/kefkenahsap-workspace/kefkenahsap-wt/launch/scripts/launch/env.sh
      cd "$L" && bun scripts/launch/smoke.ts "http://localhost:$PROD_APP_PORT" --site https://www.kefkenahsap.com --production )
    ```
20. [ ] **[Claude]** Legacy targets check on **prod**: the CDN root and the prod gallery through the tunnel.
    ```bash
    ( set -euo pipefail; . ~/Documents/projects/senrecep/kefkenahsap-workspace/kefkenahsap-wt/launch/scripts/launch/env.sh
      "$L/scripts/launch/legacy-targets.sh" HEAD https://cdn.kefkenahsap.com "http://localhost:$PROD_APP_PORT" )   # broken: 0
    ```
21. [ ] **[Claude]** **Full legacy map** against the prod origin: all 2,338 legacy paths (1,169 WP media URLs + 1,169 attachment pages). The first hop must be `301` or `410`, and every 301 target must answer `200`:
    ```bash
    ( set -euo pipefail; . ~/Documents/projects/senrecep/kefkenahsap-workspace/kefkenahsap-wt/launch/scripts/launch/env.sh
      S=$(mktemp -d); trap 'rm -r "$S"' EXIT; export BASE="http://localhost:$PROD_APP_PORT"
      { jq -r '.[].source_url' "$L/docs/legacy/wp-media.json" | sed -E 's#^https?://[^/]+##'; jq -r '.[]' "$L/src/lib/legacy/wp-attachment-paths.json"; } | sort -u > "$S/paths"
      need "$S/paths" 2000
      hop() { read -r c l < <(curl -sg -o /dev/null -w '%{http_code} %{redirect_url}' "$BASE$1"); printf '%s %s %s\n' "$c" "${l:--}" "$1"; }
      export -f hop; xargs -P 6 -d '\n' -n1 bash -c 'hop "$1"' _ < "$S/paths" > "$S/hops"
      need "$S/hops" "$(wc -l < "$S/paths")"
      awk '{print $1}' "$S/hops" | sort | uniq -c
      bad=$(awk '$1!=301 && $1!=410' "$S/hops"); [ -z "$bad" ] || { echo "unexpected first hop:"; echo "$bad"; exit 1; }
      awk '$1==301{print $2}' "$S/hops" | sort -u | sed "s#^https://www.kefkenahsap.com#$BASE#" |
        xargs -P 6 -I{} curl -sg -o /dev/null -w '%{http_code} {}\n' '{}' > "$S/finals" || true   # a network error shows as 000 below
      bad=$(awk '$1!=200' "$S/finals"); [ -z "$bad" ] || { echo "targets not 200 (000 = network error):"; echo "$bad"; exit 1; } )
    ```
22. [ ] **[Owner]** Click through on `http://localhost:13000` (the 2.16 tunnel, on this laptop), read-only. Check: home in all 5 locales, the hero slideshow, 3 categories, the gallery with tag filters, a project, a guide, the contact page. Content must look exactly like dev.
    - **GA consent, before T0**, in a private window with DevTools → Network on `http://localhost:13000/tr`:
      - no `googletagmanager.com` or `google-analytics.com` request before the banner is answered;
      - Accept: `gtag/js?id=G-S84WKG63MS` loads;
      - Reject in a second window: no GA requests.
23. [ ] **[Claude]** First prod backup, polled until all three artifacts report, then a **restore drill** into a scratch DB. Requires 1.7.
```bash
( set -euo pipefail; . ~/Documents/projects/senrecep/kefkenahsap-workspace/kefkenahsap-wt/launch/scripts/launch/env.sh
  ssh senrecep bash -s -- "$P" <<'EOS'
set -euo pipefail; P=$1; B=$P-kefken-backup-1; PG=$P-kefken-postgres-1; since=$(date -u +%FT%TZ)
docker exec $B touch /backups/.run-now
for i in $(seq 120); do   # one "uploaded"/"R2 upload …"/"FAILED" line per artifact: dump, lead-photos, media-originals
  [ "$(docker logs --since "$since" $B 2>&1 | grep -cE 'uploaded to r2:|R2 upload|FAILED')" -ge 3 ] && break; sleep 5; done
docker logs --since "$since" $B 2>&1
[ "$(docker logs --since "$since" $B 2>&1 | grep -c 'uploaded to r2:kefkenahsap-backups/production/')" -eq 3 ]
F=$(ls -1t /var/lib/kefken-backups/production/kefken-*.dump | head -1)
trap 'docker exec $PG dropdb -U kefken --if-exists kefken_restore_drill' EXIT
docker exec $PG dropdb -U kefken --if-exists kefken_restore_drill; docker exec $PG createdb -U kefken kefken_restore_drill
docker exec -i $PG pg_restore -U kefken -d kefken_restore_drill --no-owner --exit-on-error < "$F"
q="select (select count(*) from media), (select count(*) from categories), (select count(*) from users), (select count(*) from leads)"
a=$(docker exec $PG psql -U kefken -d kefken -Atc "$q"); b=$(docker exec $PG psql -U kefken -d kefken_restore_drill -Atc "$q")
echo "live=$a drill=$b (media|categories|users|leads)"; [ "$a" = "$b" ] || { echo 'restore drill does not match the live DB'; exit 1; }
EOS
)
```

24. [ ] **[Claude]** Close the tunnels:
    `( . ~/Documents/projects/senrecep/kefkenahsap-workspace/kefkenahsap-wt/launch/scripts/launch/env.sh; tunnel_close prodpg; tunnel_close prodapp )`.

### 2H. Dokploy domains — **APPROVAL** (no DNS change; the route only exists on the origin)

TLS: Cloudflare proxies the site, and the zone is on SSL mode **Full** (not strict). Decision 5 picks the origin certificate:
- **A. Let's Encrypt via HTTP-01** (recommended; same as dev and glitchtip-dev). It's issued only after DNS points at the server. Until then Traefik serves its default cert, which mode Full accepts, so there's no outage.
- **B. Cloudflare Origin CA**, `kefkenahsap.com, *.kefkenahsap.com`, 15 years, added in Dokploy → Certificates. Strict mode works from minute one with no ACME dependency, but browsers reject it if a record is ever switched to DNS-only.

25. [ ] **[Claude]** Add domains to the prod `app` compose:
    - `www.kefkenahsap.com`, path `/`, service `app`, port `3000`, HTTPS, cert per decision 5;
    - `kefkenahsap.com` with the same settings (decision 4, recommended). `proxy.ts` (#120, open-redirect fix included) answers every apex request with **one** 301, straight to the final www or legacy target, or a 410.

    Then **redeploy the compose**: Traefik labels apply only on deploy, and the data is kept. With option A, each pre-DNS attempt uses 1 of Let's Encrypt's **5 failed validations per hostname per hour**.
26. [ ] **[Claude]** The route answers on the origin:
    ```bash
    for h in www.kefkenahsap.com kefkenahsap.com; do curl -sk -o /dev/null -w "$h %{http_code} %{redirect_url}\n" --resolve $h:443:45.196.28.107 https://$h/tr; done
    # www → 200; apex → 301 https://www.kefkenahsap.com/tr
    ```
    From here the admin can also be reached before DNS: a hosts entry `45.196.28.107 www.kefkenahsap.com` on the owner's laptop, removed after T0. The browser warns about Traefik's default cert, but CSRF matches. Use it only if an admin edit can't wait for T0.

---

## Phase 3 — Cutover (T0, ~45 min, at a low-traffic hour)

### Go / no-go (T0 − 15 min)

The owner says "go" only when every box is ticked:
- [ ] 1A sign-offs done (native review, lawyer, checklist), or explicitly waived by the owner.
- [ ] Step 2.3 and 2.18 map diffs empty; 2.14 passed (no missing files; extras 0 or deleted with approval).
- [ ] **Legacy targets check = 0 broken** (it was 49 before #193). It runs against the prod origin before DNS, through `--resolve`:
  ```bash
  ( set -euo pipefail; . ~/Documents/projects/senrecep/kefkenahsap-workspace/kefkenahsap-wt/launch/scripts/launch/env.sh
    "$L/scripts/launch/legacy-targets.sh" HEAD https://cdn.kefkenahsap.com https://www.kefkenahsap.com "$SERVER_IP" )   # broken: 0
  ```
- [ ] 2.19 smoke and 2.21 full legacy map green. Users = 1, password rotated (2.17), `/api/users/init` true.
- [ ] 2.23: backup in R2 and the restore drill matched.
- [ ] Freeze held: no dev merges (except step 3's map PR) or admin edits since the 2.10 dump. Otherwise redo 2.10–2.23 (≈45 min).
- [ ] `mail` is an A record since ≥ 1 h (1.15). The cPanel backup and the zone export are on disk (1.13–1.14).
- [ ] The rollback steps (phase 6) have been read. The owner is reachable for the next 2 h.

### Cutover steps

1. [ ] **[Owner] APPROVAL.** Cloudflare DNS: change **one** record, `A kefkenahsap.com` `104.247.167.3` → **`45.196.28.107`**, Proxied, TTL Auto. Note the time (UTC) for the rollback lead export.
   - `www` is a CNAME to the apex and follows it.
   - Leave `cpanel`, `cpcontacts`, `webmail`, `whm` (A records, checked in 1.14) and the SRV/TXT records alone: WordPress stays reachable at the old host.
2. [ ] **[Claude]** Cert (option A), within ~1–2 min:
   ```bash
   for h in www.kefkenahsap.com kefkenahsap.com; do echo | openssl s_client -connect 45.196.28.107:443 -servername $h 2>/dev/null | openssl x509 -noout -issuer -enddate; done   # issuer: Let's Encrypt
   ```
   - Still the default cert? Re-save the domain in Dokploy and redeploy; Traefik retries a failed ACME order only on a config change.
   - Two failed re-saves: stop, wait an hour (mode Full keeps the site up meanwhile), and read the Traefik logs.
3. [ ] **[Owner] APPROVAL.** Cloudflare → Caching → **Purge Everything**. It drops the WordPress HTML cached for the apex and www, and any stale CDN 404.
4. [ ] **[Claude]** Smoke on the live domain. A failure that can't be fixed within 30 min → **rollback** (phase 6).
   ```bash
   ( set -euo pipefail; . ~/Documents/projects/senrecep/kefkenahsap-workspace/kefkenahsap-wt/launch/scripts/launch/env.sh
     cd "$L" && bun scripts/launch/smoke.ts https://www.kefkenahsap.com --production )
   ```

**If the apex has no Dokploy domain** (decision 4 = Cloudflare rules), add these redirect rules before step 1:
- `kefken: apex to www`. When `(http.host eq "kefkenahsap.com")`, then Dynamic `concat("https://www.kefkenahsap.com", http.request.uri.path)`, **301**, preserve query string. WordPress already 301s the apex to www, so it's safe before the flip.
- **After** step 1, dragged **above** the first: `kefken: apex legacy pages`. When `(http.host eq "kefkenahsap.com" and http.request.uri.path in {"/ahsap-yapilar/" "/boya-tamir-ve-bakim/" "/ciceklik-ve-oturma-grubu/" "/deck-ve-zeminler/" "/ireko-teak/" "/kapi-dolap-ve-seperator/" "/kopru-ve-iskele/" "/korkuluk-ve-cit/" "/merdivenler/" "/mobilya-ve-cila/" "/pergola-ve-kamelyalar/" "/hakkimizda/" "/hizmetlerimiz/" "/iletisim/" "/referanslar/"})`, then Dynamic `concat("https://www.kefkenahsap.com/tr", substring(http.request.uri.path, 0, -1))`, 301, preserve query.
  - Check the `substring` expression in the rule preview before saving. If it's rejected, use static per-page rules (Free plan: 10 rules).
  - With this route, old media and attachment URLs on the apex take **two hops**. That's accepted: Google indexed the old site on www.

---

## Phase 4 — Verify live (T0 + 1h)

1. [ ] **[Claude]** Apex: `curl -sI https://kefkenahsap.com/` → one 301 to `https://www.kefkenahsap.com/`, and `curl -sI 'https://kefkenahsap.com/iletisim/?a=1'` → one 301 to `https://www.kefkenahsap.com/tr/iletisim?a=1`.
2. [ ] **[Claude]** Live legacy sample: 20 random WP media URLs against the domain. Each line must be `301 -> 200` or `410 -> -`:
   ```bash
   ( set -euo pipefail; . ~/Documents/projects/senrecep/kefkenahsap-workspace/kefkenahsap-wt/launch/scripts/launch/env.sh
     jq -r '.[].source_url' "$L/docs/legacy/wp-media.json" | shuf -n 20 | sed -E 's#^https?://[^/]+##' | while IFS= read -r p; do
       read -r code loc < <(curl -sg -o /dev/null -w '%{http_code} %{redirect_url}' "https://www.kefkenahsap.com$p")
       final=-; [ "$code" = 301 ] && final=$(curl -sg -o /dev/null -w '%{http_code}' "$loc")
       printf '%s -> %s  "%s"\n' "$code" "$final" "$p"
     done | sort )
   ```
   The full map already ran in 2.21. Re-run it with `BASE=https://www.kefkenahsap.com` only if this sample shows anything odd.
3. [ ] **[Owner]** Change the password once more in the admin on `https://www.kefkenahsap.com/admin`, to confirm admin writes work on the live host. Create the editor user if decision 2 says so.
4. [ ] **[Owner]** Contact form from a phone: test name, the owner's phone, one photo.
   - Turnstile passes on www. If the widget shows error 110200, add `www.kefkenahsap.com` to the widget's hostnames.
   - The lead is in the admin, the photo is in the private store, and the mail from `bildirim@kefkenahsap.com` reaches `LEADS_NOTIFY_EMAIL` without landing in spam.
   - Then delete the test lead.
5. [ ] **[Owner]** GA on the live host: accept in a private window, and the visit shows in GA4 Realtime. Umami, if decision 6 = yes: its script loads, and the visit shows in the prod Umami.
6. [ ] **[Owner]** Uptime Kuma (https://uptime.senrecep.com): add the `kefkenahsap production` monitor, HTTP(s) - Keyword `https://www.kefkenahsap.com/api/health`, keyword `"ok":true`, 60 s, 2 retries, the existing notification channel.
7. [ ] **[Owner]** GSC, Domain property `kefkenahsap.com` (TXT in Cloudflare):
   - Sitemaps → submit `https://www.kefkenahsap.com/sitemap.xml`.
   - URL Inspection → Request indexing for `/tr` and one category.
   - **No Change of Address**: same domain.
8. [ ] **[Claude]** GlitchTip: no new issues in `kefkenahsap-production`. Cloudflare → Analytics: no 5xx spike.
9. [ ] **[Owner]** Phone spot-check: home, a category, the gallery lightbox, a project, the WhatsApp button, one RU/DE/AR page.
10. [ ] **[Owner]** Freeze ends. `development` takes merges again. From now on, **content is edited only in the prod admin**. Remove any hosts entry from 2.26.

---

## Phase 5 — After launch

| When | Who | What |
|---|---|---|
| T+1d | Claude | The nightly backup ran and reached R2 (`docker logs $P-kefken-backup-1`, three `uploaded to r2:` lines). Delete the promotion dump: `ssh senrecep 'rm -r /var/lib/kefken-backups/promote'`. |
| T+1d | Claude | #62: geolyt **baseline** on prod → `docs/geo/`. |
| T+1d | Owner + Claude, **APPROVAL** | Lock dev down again: set `SITE_BASIC_AUTH` back to a credential in the dev Dokploy env and redeploy. Also rotate the dev admin password (it was exposed in chat), with `set-password.ts` over the dev tunnel. This keeps dev's admin and contact form away from the public. |
| T+1d … T+3d daily, then weekly to week 8 | Owner + Claude | 404 watch. Check each URL in GSC → Pages → "Not found (404)" with `curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' '<url>'`:<br>• 410 = intended.<br>• 404 = missing redirect: add it in admin → Redirects, then "Validate fix".<br>• 301 = already fixed.<br>Also watch Cloudflare → HTTP Traffic, filtered on 404 for www. Traefik access logs are off server-wide; turning them on is the owner's call. |
| T+1w | Owner | #54: GBP website link `https://www.kefkenahsap.com/tr?utm_source=gbp&utm_medium=organic`, GA4 ↔ GSC link, Instagram handle and founding year in siteSettings. |
| T+1w | Claude | #189 permanent fix: the CI deploy job also sends the compose file (`compose.update`) before `compose.deploy`, so Dokploy can't drift from the repo again. |
| T+2w | Claude | **#53 acceptance:** every URL in GSC "Not found" checks as 301 or an intended 410 (zero true 404s). Then close #53. |
| T+4w | Claude | #62 re-measure, and open the follow-ups → #66. |
| later, optional | Owner, **APPROVAL** | SSL **Full (strict)**: zone-wide. First check the origin certs of www, development and glitchtip-dev, and the cPanel hosts with `openssl s_client`. Stay on Full if any cPanel host lacks a valid cert. |

---

## Phase 6 — Rollback — **APPROVAL**

**Triggers:** the live smoke test fails and can't be fixed within 30 min; persistent 5xx (Cloudflare analytics or GlitchTip); or a data problem visible to visitors.

**Before T0** (phases 1–2), nothing is public, so there is nothing to roll back. Fix the cause and redo the step. The promotion is repeatable from 2.10, because prod has no leads yet.

**After T0.** WordPress is still live on 104.247.167.3 and its records were never deleted:

1. [ ] **[Claude]** Export the leads received since the cutover: a full data dump of `leads`, `leads_rels` and `lead_photos` (for restoring), plus a CSV (for the owner to read). They are personal data: keep the files private, and delete them once they're handled. The photo files stay in the `lead-photos` volume.
```bash
( set -euo pipefail; . ~/Documents/projects/senrecep/kefkenahsap-workspace/kefkenahsap-wt/launch/scripts/launch/env.sh
  ssh senrecep bash -s -- "$P" <<'EOS'
set -euo pipefail; PG=$1-kefken-postgres-1; DIR=/var/lib/kefken-backups/promote; install -d -m 700 $DIR
docker exec $PG pg_dump -U kefken -d kefken -Fc --data-only -t leads -t leads_rels -t lead_photos > $DIR/leads-keep.dump
docker exec -i $PG pg_restore -l < $DIR/leads-keep.dump > /dev/null   # readable archive, or stop here
chmod 600 $DIR/leads-keep.dump; ls -l $DIR/leads-keep.dump
EOS
  ssh senrecep "docker exec $P-kefken-postgres-1 psql -U kefken -d kefken -c \"COPY (SELECT * FROM leads ORDER BY created_at) TO STDOUT WITH CSV HEADER\"" > "$W/leads-after-cutover.csv"; chmod 600 "$W/leads-after-cutover.csv" )
```

2. [ ] **[Owner]** Cloudflare DNS: `A kefkenahsap.com` → **`104.247.167.3`**, Proxied. `www` follows through its CNAME.
3. [ ] **[Owner]** If `kefken: apex legacy pages` exists, disable it: its `/tr/<slug>` targets don't exist on WordPress. Keep `kefken: apex to www`.
4. [ ] **[Owner]** Purge Everything.
5. [ ] **[Owner]** GSC: remove the sitemap. Uptime Kuma: pause `kefkenahsap production`.
6. [ ] **[Owner]** Stop prod deploys: `gh variable delete PRODUCTION_DEPLOY_APPROVED -R senrecep/kefkenahsap`.
7. [ ] Expect a tail of up to **24 h** from browser caches. The app's legacy 301s carry `max-age=86400`, so a returning visitor may still land on a `/tr/…` path, which 404s on WordPress. Purging doesn't reach browsers.
8. [ ] Leave `mail` as its A record, and leave the prod stack running: no traffic reaches it. **Keep the prod DB**: it holds the cutover-window leads.
9. [ ] **[Claude]** Write what failed into #53 before the next attempt.

**Re-attempt.**
- **Preferred: fix forward on the existing prod DB.** It already holds the promoted content plus any edits and leads. Redeploy the fixed code through the re-release path (2.8), and repeat from 2.16 and phase 3.
- **Re-promote from dev only when the prod content itself is wrong:**
  - a. Export the leads (step 1 above). 2.12 refuses while prod holds leads, unless it's run with `LEADS_EXPORTED=yes` in the calling shell.
  - b. Run 2.10–2.13. Right after the 2.13 commit, put the leads back, then continue with 2.14:
    ```bash
    ( set -euo pipefail; . ~/Documents/projects/senrecep/kefkenahsap-workspace/kefkenahsap-wt/launch/scripts/launch/env.sh
      ssh senrecep "docker exec -i $P-kefken-postgres-1 pg_restore -U kefken -d kefken --data-only --exit-on-error < /var/lib/kefken-backups/promote/leads-keep.dump"
      ssh senrecep "docker exec $P-kefken-postgres-1 psql -U kefken -d kefken -Atc 'select count(*) from leads'" )   # = the exported count
    ```

---

## Owner decisions

| # | Decision | Recommendation |
|---|---|---|
| 1 | Launch date and T0 hour; freeze window (from the T-1d dump to the end of T0) | A weekday morning, low traffic, with the owner reachable for 2 h. |
| 2 | Users on prod: the owner only, or the owner + a fresh editor account | Owner only; the editor is created in the prod admin after T0 if needed. Dev test users never move. |
| 3 | RU / DE / AR without native review: ship them, or hold some (no per-locale switch; holding = clear the slugs on dev before the dump) | Ship only the reviewed ones; TR/EN always. |
| 4 | Apex: a Dokploy domain (one hop, done by `proxy.ts`) or Cloudflare redirect rules (two hops for media) | Dokploy apex domain. |
| 5 | Origin TLS: Let's Encrypt (A) or Cloudflare Origin CA (B) | A, same as dev. |
| 6 | Umami at launch (needs a public domain such as `stats.kefkenahsap.com` + website id baked before the merge) or GA only | GA only at launch; Umami as a follow-up. |
| 7 | GlitchTip for prod: a new project in the existing instance, or a separate prod instance | A new project in the existing one. |
| 8 | Lawyer KVKK/cookie sign-off: a hard blocker, or launch with the current texts | Hard blocker (personal data + consent). |
| 9 | R2 backup token (#51) before T0 | Required: prod content is no longer reproducible from seeds. |
| 10 | Traefik access logs (server-wide) for the 404 watch | Off; GSC + Cloudflare analytics are enough. |
| 11 | GA ID in Site Settings (copied from dev; it overrides the env `G-S84WKG63MS`): same property, another one, or empty (= env) | Empty or `G-S84WKG63MS`, so prod and dev never report into a different property by accident. |
