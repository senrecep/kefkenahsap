# Launch: production cutover checklist (#53)

Work through the steps in order and tick each one off. A step marked **OWNER APPROVAL REQUIRED** changes something public
(the deploy gate, DNS, the redirect rule, TLS mode), so only the owner runs it or approves it explicitly. Never paste secret values here, in
a PR or in an issue.

## What is already prepared (2026-10-14, PR for #53)

| Piece | State |
|---|---|
| Dokploy compose | `app`, id `e9_MpMOeFkF1QLwEItoeq`, appName `compose-reboot-haptic-feed-t5r4ra`, in project `kefkenahsap` / environment `production` (next to `wood-material-calculator`, which is a separate stack and stays untouched). Raw compose = `docker-compose.dokploy.yml`, isolated deployment on, auto-deploy off. **Never deployed, no domain.** |
| Dokploy env | Saved from the owner's local `../.dokploy-prod.env` (mode 600, outside the repo). Fresh `POSTGRES_PASSWORD`, `PAYLOAD_SECRET`, `UMAMI_APP_SECRET`, `GLITCHTIP_SECRET_KEY`, `GLITCHTIP_DB_PASSWORD`. `SITE_ENV=production`, `NEXT_PUBLIC_SITE_URL=https://www.kefkenahsap.com`, `S3_BUCKET=kefkenahsap`, `S3_PREFIX` empty, `MEDIA_PUBLIC_URL=https://cdn.kefkenahsap.com`, `NEXT_PUBLIC_GA_ID=G-S84WKG63MS`, the real Turnstile keys, `SITE_BASIC_AUTH` empty, `COMPOSE_PROFILES=backup` (dumps go to `/var/lib/kefken-backups/production`). `DEBUG_ERROR_TOKEN` is not set. `SENTRY_DSN` and `GLITCHTIP_DOMAIN` are empty (see step 1.5). |
| GitHub environment `production` | vars `DOKPLOY_COMPOSE_ID`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (the `NEXT_PUBLIC_*` values are baked into the image at build time); secrets `DOKPLOY_URL`, `DOKPLOY_API_KEY`. |
| Deploy gate | Repo variable `PRODUCTION_DEPLOY_APPROVED` is **not set**, so a push to `main` runs CI only. |
| Smoke test | `bun scripts/launch/smoke.ts` (logic and unit tests in `src/lib/launch/`). |
| R2 | Bucket `kefkenahsap` holds only `dev/…` (2599 objects); the root is empty. The production seed uploads to the root. |

Production container names below use `P=compose-reboot-haptic-feed-t5r4ra`.

## 1. Preflight (a day before)

1. [ ] `development` CI is green, and the dev smoke test passes:
   ```sh
   SMOKE_BASIC_AUTH='<user:password from development-access.txt>' \
     bun scripts/launch/smoke.ts https://development.kefkenahsap.com --media-base https://cdn.kefkenahsap.com/dev
   ```
2. [ ] Back up the old site. Take a full cPanel backup at güzelhosting (files + DB) and download it. WordPress stays there untouched as the rollback target.
3. [ ] Export the zone: Cloudflare → DNS → Records → Export (or `GET /zones/04160cf76d6ba4ad5d37d83145eaae57/dns_records/export`), and keep the file with the backups.
4. [ ] **OWNER APPROVAL REQUIRED (DNS, safe to do early).** `mail.kefkenahsap.com` is a **DNS-only CNAME → `kefkenahsap.com`**. If the apex flips, mail would follow it to the new server and expose its IP. Replace it with:
   - `A mail.kefkenahsap.com → 104.247.167.3`, **DNS only**, TTL Auto.
   - Do this ≥ 1 hour before the cutover, so the old CNAME's TTL (Auto = 300 s) has expired everywhere.
5. [ ] Optional: production error reporting.
   - In GlitchTip (https://glitchtip-dev.kefkenahsap.com, org `kefkenahsap`), create a project `kefkenahsap-production`.
   - Put its DSN in the production Dokploy env as `SENTRY_DSN` (Dokploy UI → `app` → Environment).
   - Leave it empty to launch without error reports.
6. [ ] Optional: the dedicated R2 backup token (RUNBOOK → Backups → Pending). Until it's set, dumps stay on the host only.
7. [ ] Open the release PR `development → main`: `gh pr create -R senrecep/kefkenahsap -B main -H development -t "Release F1: launch"`.
   - Wait until CI is green.
   - Don't merge yet.
   - Use a **merge commit** (not squash), so the two branches stay in step.

## 2. Turn on production deploys and deploy

1. [ ] **OWNER APPROVAL REQUIRED.** Set the gate **before** merging. The image is built only by the deploy job on the push to `main`.
   ```sh
   gh variable set PRODUCTION_DEPLOY_APPROVED -R senrecep/kefkenahsap -b true
   ```
2. [ ] Merge the release PR. CI `check` runs, then `deploy` does three things:
   - builds `kefkenahsap-app:production` on the server;
   - calls Dokploy `compose.deploy` for `e9_MpMOeFkF1QLwEItoeq`;
   - boots the stack, and migrations run on boot.
3. [ ] Check the stack. Nothing is public yet: there is no domain and no DNS.
   ```sh
   ssh senrecep "docker ps --format '{{.Names}}\t{{.Status}}' | grep $P"   # app (healthy), kefken-postgres (healthy), umami, kefken-backup
   ssh senrecep "docker exec $P-app-1 wget -qO- http://127.0.0.1:3000/api/health"   # {"ok":true}
   ```

## 3. Admin user and production seed (through SSH tunnels, like dev)

The fresh DB has no users. Until the first one exists, **anyone who reaches `/admin` could create the admin**, so create it now, before any domain is added.

1. [ ] Open tunnels to the containers' IPs on the stack's own network:
   ```sh
   PGIP=$(ssh senrecep "docker inspect $P-kefken-postgres-1 -f '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}'" | awk '{print $1}')
   APPIP=$(ssh senrecep "docker inspect $P-app-1 -f '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}'" | awk '{print $1}')
   ssh -N -L 15432:$PGIP:5432 -L 13000:$APPIP:3000 senrecep    # leave running
   ```
2. [ ] Open http://localhost:13000/admin → create the first admin (the owner's email and a strong password), then the editor user.
3. [ ] Run the seed from a clean checkout of `main`, in a fresh shell, with **no `.env` file** in it. A dev `.env` would point Payload at the wrong DB or prefix.
   ```sh
   set -a; . ../../.dokploy-prod.env; set +a          # adjust the path to the workspace root
   export DATABASE_URL="postgres://kefken:$POSTGRES_PASSWORD@127.0.0.1:15432/kefken" S3_PREFIX=
   export KEFKEN_DATA=<workspace>/kefken-data/Webiste   # the 568 source photos
   bun run payload run scripts/seed/seed.ts           # 11 categories + 568 images → R2 bucket root; expect "568 created"
   bun run payload run scripts/seed/content.ts        # category texts, FAQ, pages, references, guides (drafts)
   bun run payload run scripts/seed/project-drafts.ts # draft projects from the photo clusters
   git status --short src/lib/legacy/                 # MUST be empty
   ```
   - The seed rewrites `src/lib/legacy/media-map.json` and `attachment-map.json`. The redirect map is baked into the image, so a diff means production's file names differ from the committed map. If so, stop and open an issue.
   - The seed uploads to the bucket **root**. Afterwards, `cdn.kefkenahsap.com/<file>.webp` answers 200.
4. [ ] In the admin, review and publish the drafts (content, guides, projects) the owner wants live on day one.
5. [ ] Take the first production dump now and check it:
   ```sh
   ssh senrecep "docker exec $P-kefken-backup-1 touch /backups/.run-now; sleep 40; docker logs --tail 5 $P-kefken-backup-1"   # "wrote /backups/kefken-…dump"
   ```
6. [ ] Smoke-test production through the tunnel. Canonicals must already be on www, robots must allow crawling, and the CDN files must exist:
   ```sh
   bun scripts/launch/smoke.ts http://localhost:13000 --site https://www.kefkenahsap.com --production
   ```

## 4. Dokploy domain and TLS

Cloudflare proxies the site (orange cloud), and the zone SSL mode is **Full** today, not strict. Visitors get Cloudflare's edge certificate. The origin certificate matters only for the Cloudflare → server leg. There are two ways to do it:

- **A. Let's Encrypt via HTTP-01 (recommended; the same as `development.kefkenahsap.com` and `glitchtip-dev` on this server).**
  - Traefik asks Let's Encrypt for the cert. Let's Encrypt fetches `http://www.kefkenahsap.com/.well-known/acme-challenge/…`, and Cloudflare forwards that to the origin. "Always Use HTTPS" is off in the zone, so the request reaches port 80.
  - This works only **after** DNS points at the server. Before that, the challenge would land at the old host.
  - Until the cert is issued, Traefik answers with its default self-signed cert. Mode **Full** accepts it, so the site stays up during those minutes. Mode **Full (strict)** would show 526, so keep **Full** for the cutover.
  - Optionally switch to **Full (strict)** later (step 8.4).
- **B. Cloudflare Origin CA certificate.**
  - Create it in Cloudflare → SSL/TLS → Origin Server for `kefkenahsap.com, *.kefkenahsap.com`, valid 15 years.
  - Add it in Dokploy → Certificates and use it on the domain instead of Let's Encrypt.
  - You get strict mode from minute one and no ACME dependency.
  - The cert is trusted only by Cloudflare. If the record is ever set to DNS-only, browsers reject it.

With option A:

1. [ ] Add the Dokploy domain on the production `app` compose: host `www.kefkenahsap.com`, path `/`, service `app`, port `3000`, HTTPS on, certificate **Let's Encrypt**.
   - A compose domain is applied through Traefik labels, so **redeploy the compose** after saving it (the data is kept; this only recreates the containers). The route then exists before the DNS change.
   - Let's Encrypt fails at this point because DNS still points at the old host. That's expected.
2. [ ] No Dokploy domain for the apex. `kefkenahsap.com → www` is a single Cloudflare redirect rule at the edge (PLAN §5.1, step 5.3), so the apex never reaches the origin.
3. [ ] Check the route before DNS changes. The origin answers for the host, using Traefik's default cert, hence `-k`:
   ```sh
   curl -sk -o /dev/null -w '%{http_code}\n' --resolve www.kefkenahsap.com:443:45.196.28.107 https://www.kefkenahsap.com/tr   # 200
   ```

## 5. DNS cutover — **OWNER APPROVAL REQUIRED**

Current records (read from Cloudflare 2026-10-14; zone `04160cf76d6ba4ad5d37d83145eaae57`):

| Type | Name | Content | Proxy | TTL |
|---|---|---|---|---|
| A | `kefkenahsap.com` | `104.247.167.3` | proxied | Auto |
| CNAME | `www.kefkenahsap.com` | `kefkenahsap.com` | proxied | Auto |
| CNAME | `mail.kefkenahsap.com` | `kefkenahsap.com` | DNS only | Auto |
| A | `cpanel`, `cpcontacts`, `webmail`, `whm` | `104.247.167.3` | proxied | Auto |
| A | `development`, `glitchtip-dev` | `45.196.28.107` | proxied | Auto |
| CNAME | `cdn`, `cdn-dev` | `public.r2.dev` (R2 custom domains) | proxied | Auto |
| CNAME | `send`, `rsend` (Resend) | `*.forge.rmta.net` | DNS only | 3600 |
| SRV/TXT | `_carddav(s)`, `_caldav(s)` → `mt-dandy.guzelhosting.com`; SPF/verification/DKIM/ACME TXT | — | DNS only | — |

There is no MX record. Zone SSL is `full`, Always Use HTTPS is off, and there are no redirect rules.

**TTL plan.**
- The web records are **proxied**. Resolvers see only Cloudflare's anycast IPs, so changing the origin IP takes effect at Cloudflare's edge within seconds, whatever the TTL. Rollback is just as fast.
- The only DNS-only record that would have followed the apex is `mail`, and step 1.4 moved it off a day before. Nothing needs a TTL lowered.

1. [ ] **OWNER APPROVAL REQUIRED.** Change **one** record: `A kefkenahsap.com` `104.247.167.3` → **`45.196.28.107`**, keep it **Proxied**, TTL Auto.
   - `www` is a CNAME to the apex and follows it. Leave it as it is.
   - Leave the cPanel records (`cpanel`, `cpcontacts`, `webmail`, `whm`, SRV/TXT) alone. WordPress stays reachable on the old host as a backup.
2. [ ] Get the Let's Encrypt cert for www.
   - Within ~1–2 min, check:
     ```sh
     echo | openssl s_client -connect 45.196.28.107:443 -servername www.kefkenahsap.com 2>/dev/null | openssl x509 -noout -issuer -enddate   # issuer: Let's Encrypt
     ```
   - If it's still the default cert, re-save the domain in Dokploy and redeploy the compose. Traefik retries a failed ACME order only when its config changes.
3. [ ] **OWNER APPROVAL REQUIRED.** Add the apex → www rule **after** the flip. If WordPress canonicalises to the apex, a www rule before the flip could loop with it.
   - Go to Cloudflare → Rules → Redirect Rules → Create.
   - Name: `kefken: apex to www`.
   - When: custom filter `(http.host eq "kefkenahsap.com")`.
   - Then: Dynamic, `concat("https://www.kefkenahsap.com", http.request.uri.path)`, status **301**, **Preserve query string** on.
   - Check it: `curl -sI 'https://kefkenahsap.com/deck-ve-zeminler/?a=1'` → `301`, `location: https://www.kefkenahsap.com/deck-ve-zeminler/?a=1`. The next hop is the app's own single 301 to `/tr/deck-ve-zeminler`.

## 6. Cloudflare cache purge

1. [ ] Cloudflare → Caching → Configuration → **Purge Everything**. This drops WordPress HTML cached at the edge for the apex and www. It also drops any 404 that `cdn.kefkenahsap.com` cached for a root file before the seed: the CDN rule caches for a year at the edge, overriding the origin.

## 7. Smoke tests on the live domain

1. [ ] Automated:
   ```sh
   bun scripts/launch/smoke.ts https://www.kefkenahsap.com --production
   ```
   It covers health, `/tr` `/en` and a category with canonicals and hreflang, robots with the sitemap, the sitemap, 5 legacy WP URLs → one 301 each, an unknown upload → 410, and the redirected CDN file → 200.
2. [ ] Apex: `curl -sI https://kefkenahsap.com/` → 301 to `https://www.kefkenahsap.com/`.
3. [ ] Wider legacy sample. CI already resolves all 14,468 WP media URLs in the unit suite (`src/lib/legacy/coverage.test.ts`). This checks 20 of them live, and each must be a single `301` or `410`, never `200` or `404`:
   ```sh
   jq -r '.[].source_url' docs/legacy/wp-media.json | shuf -n 20 | sed -E 's#^https?://[^/]+##' | while read -r p; do
     echo "$(curl -s -o /dev/null -w '%{http_code}' "https://www.kefkenahsap.com$p") $p"; done | sort | awk '{print $1}' | uniq -c
   ```
4. [ ] Form, by hand:
   - Submit the contact form on `/tr/iletisim` from a phone, with a test name, the owner's phone and one photo. Turnstile must pass on `www` (the widget lists `kefkenahsap.com`).
   - Check three things: the lead is in the admin, the photo is in the private store, and the notification mail reaches `LEADS_NOTIFY_EMAIL`.
   - Then delete the test lead.
5. [ ] GA consent, in a private window with DevTools → Network:
   - Before the banner is answered, there must be **no** request to `googletagmanager.com` or `google-analytics.com`.
   - Accept analytics. Now `gtag/js?id=G-S84WKG63MS` loads, and GA4 → Reports → Realtime shows the visit.
   - Reject in a second private window. No GA requests.
6. [ ] Uptime Kuma: add the `kefkenahsap production` monitor (RUNBOOK → Uptime Kuma). Use the URL **`https://www.kefkenahsap.com/api/health`**, not the apex, which now 301s.
7. [ ] Spot-check on a phone: home, a category, the gallery lightbox, a project, the WhatsApp button.

## 8. After launch

1. [ ] Google Search Console:
   - Domain property `kefkenahsap.com` (PLAN §13.1: TXT verification in Cloudflare).
   - Sitemaps → submit `https://www.kefkenahsap.com/sitemap.xml`.
   - **No Change of Address**: the domain is the same, and only the host canonical and paths moved, all with 301s.
   - Use URL Inspection on `/tr` and one category → Request indexing.
2. [ ] 404/410 monitoring for **2 weeks**. Check daily the first 3 days, then twice a week.
   - **GSC → Indexing → Pages → "Not found (404)"**: the main signal. Any old URL listed there is a missing redirect. Add it in the admin (Redirects) or fix the map, then "Validate fix".
   - **Cloudflare → Analytics & Logs → HTTP Traffic** (Free plan): filter by edge status code 404, host `www.kefkenahsap.com`, and watch the top paths.
   - **Server**: Traefik access logs are **off** on this server (no `access.log`). To get request logs, enable Dokploy → Settings → Requests. That is a server-wide Traefik change, so the owner decides.
   - **GlitchTip** gets 5xx/unhandled errors only, not 404s, and only if `SENTRY_DSN` was set (step 1.5).
   - Acceptance (#53): the redirect E2E is green in production, and the 404 report shows 0 old URLs → close #53.
3. [ ] Google Business Profile: website link `https://www.kefkenahsap.com/tr?utm_source=gbp&utm_medium=organic` (PLAN §13.1).
4. [ ] **OWNER APPROVAL REQUIRED.** Optional, Full (strict):
   - It's zone-wide. First confirm that each proxied host has a valid origin cert: `www`, `development` and `glitchtip-dev` (Let's Encrypt). `cpanel`/`webmail`/`whm`/`cpcontacts` sit at güzelhosting, so check them with `openssl s_client`.
   - If a cPanel host has no valid cert, stay on Full.

## 9. Rollback — **OWNER APPROVAL REQUIRED**

The old WordPress is still live on 104.247.167.3, and its records were never deleted.

1. [ ] Cloudflare DNS: `A kefkenahsap.com` → **`104.247.167.3`**, Proxied, TTL Auto. `www` follows through its CNAME. This restores the table in step 5.
2. [ ] Disable the `kefken: apex to www` redirect rule. Otherwise www → WordPress may loop with WordPress's own host redirect.
3. [ ] Purge Everything (Cloudflare cache).
4. [ ] Leave `mail` as an A record to 104.247.167.3. It's correct for both states.
5. [ ] Leave the production stack running (no domain traffic reaches it). Set `PRODUCTION_DEPLOY_APPROVED` to anything but `true` to stop deploys.
6. [ ] Write down what failed in #53 before trying again.
