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
