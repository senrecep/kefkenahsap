# Runbook

Operational notes for kefkenahsap.com. Secrets are never written here.

## Infrastructure map

| Piece | Where |
|---|---|
| Server | 45.196.28.107 (`ssh senrecep`), Dokploy, Docker 28 |
| Dokploy project | `kefkenahsap` — environments `development` (development.kefkenahsap.com) and `production` |
| Cloudflare zone | kefkenahsap.com (Free plan, SSL Full) |
| R2 buckets | `kefkenahsap` (prod media, public via `cdn.kefkenahsap.com`), `kefkenahsap-dev` (dev media, `cdn-dev.kefkenahsap.com`), `kefkenahsap-leads` (private, lead photos), `kefkenahsap-backups` (private, DB backups) |
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

## Observability

### GlitchTip (errors)

- Dev: https://glitchtip-dev.kefkenahsap.com. Compose services `glitchtip-web`/`-worker`/`-migrate` + `kefken-valkey`, enabled by `COMPOSE_PROFILES=observability`; DB `glitchtip` on `kefken-postgres`. Dokploy domain → `glitchtip-web:8000`, Let's Encrypt; Cloudflare A `glitchtip-dev` proxied. One subdomain level on purpose: Universal SSL does not cover `*.development.kefkenahsap.com`.
- Login: superuser `recepsen@taptoweb.com`, password in the owner's local `glitchtip-dev-access.txt`. Registration is off; add users from the UI (org `kefkenahsap`) or `docker exec <project>-glitchtip-web-1 ./manage.py createsuperuser`.
- Project `kefkenahsap-development`. Its DSN is `SENTRY_DSN` in the Dokploy env; `GLITCHTIP_SECRET_KEY` / `GLITCHTIP_DOMAIN` / `GLITCHTIP_FROM_EMAIL` live there too.
- App side: `src/instrumentation.ts` (`onRequestError`) → `src/lib/observability/report.ts`, a small Sentry store-protocol client. Server only: no client SDK, no tracing, no replay. It sends the error type/message/stack, the path without its query, the method and the route; never headers, cookies, bodies or query strings. Errors that Payload catches itself (REST/GraphQL, hooks) are not reported.
- End-to-end check (non-production only; `DEBUG_ERROR_TOKEN` is in the Dokploy env; dev also needs basic auth):
  `curl -u "$SITE_BASIC_AUTH" -H "x-debug-token: $DEBUG_ERROR_TOKEN" https://development.kefkenahsap.com/api/debug-error` → 500, and a "Debug error (reporter check)" issue appears in GlitchTip. Without the header, or in production, the route is a 404.
- Production (at launch): same profile, its own domain (e.g. `glitchtip.kefkenahsap.com`), project and DSN.

### Uptime Kuma

- Existing install in the `tools` project: https://uptime.senrecep.com (container `tools-uptimekuma-ys3qok-uptime-kuma-1`, SQLite). Not part of this compose.
- `/api/health` skips basic auth and returns `{"ok":true}` (200) when the app and DB are up, 503 otherwise.
- Monitors (Add New Monitor):
  1. Type **HTTP(s) - Keyword**, name `kefkenahsap development`, URL `https://development.kefkenahsap.com/api/health`, keyword `"ok":true`, interval 60 s, retries 2, accepted status codes `200-299`; attach the existing notification channel.
  2. At launch: the same for `https://kefkenahsap.com/api/health` (`kefkenahsap production`).

## Backups

- Service `kefken-backup` (compose profile `backup`; dev runs `COMPOSE_PROFILES=observability,backup`) runs `pg_dump -Fc` of DB `kefken` daily at `BACKUP_AT` (HHMM, **UTC**; default `0100` = 04:00 Istanbul).
- Location: host `/var/lib/kefken-backups/<SITE_ENV>/kefken-YYYYmmdd-HHMMSS.dump` (dir 700, files 600, root). Dumps hold personal data (leads): never put them in a public bucket.
- Rotation: the newest **14** dumps are kept. A dump is written as `*.part` first, so a failed one never rotates out a good one.
- Run one now: `docker exec <project>-kefken-backup-1 touch /backups/.run-now` (picked up within ~20 s). `docker logs <project>-kefken-backup-1` shows `wrote …` and the R2 result.
- Off-site copy: after each dump, rclone copies it to `r2:$BACKUP_S3_BUCKET/<SITE_ENV>/` with the `S3_*` key. The bucket name must end in `-backups`; anything else is refused.
- **Pending (owner):** the current R2 token can only write `kefkenahsap`, so the log says `R2 upload skipped: access denied to kefkenahsap-backups (token not widened yet); local copy kept`. Widen the token to `kefkenahsap-backups` (Object Read & Write) and the next run uploads, no redeploy needed. Add a 30-day lifecycle rule on that bucket (PLAN §3.2).
- Not covered: the `lead-photos` volume and the `umami` / `glitchtip` DBs.

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
