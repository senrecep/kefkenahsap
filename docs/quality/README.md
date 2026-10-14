# Quality gates (#52)

Budgets come from `CLAUDE.md`: initial JS ≤150 KB gz, Lighthouse mobile ≥95, CLS <0.05, WCAG 2.2 AA.

## What runs where

| Gate | Where | Blocks CI? |
|---|---|---|
| axe (`tests/e2e/a11y.e2e.spec.ts`): WCAG 2.0/2.1/2.2 A+AA tags, every public template at 1440 and 390 px, plus lightbox, mobile menu and cookie banner open | e2e job, production build | yes, like every e2e spec |
| Lighthouse CI (`lighthouserc.cjs`): perf/a11y/best-practices/SEO ≥0.95, CLS <0.05, total JS ≤160 KB, on home, category, gallery, project, contact and guide (3 runs, median) | CI step after e2e, same build; reports are uploaded as the `lighthouse` artifact | no (`continue-on-error`): lab scores on a shared runner are noisy, and CI photos are synthetic |

- Both use `scripts/quality/fixtures.ts`. It creates a published project and guide at the fixed slugs in `scripts/quality/fixtures.json`, because seed projects and guides are drafts and CI starts from an empty DB.
- `is-crawlable` is the only skipped audit. Non-production builds send `X-Robots-Tag: noindex` on purpose, and that header is fixed at build time.
- CI builds with `NEXT_PUBLIC_SITE_URL` set to the probed port, so canonical and hreflang URLs point at the server under test.

## Run locally (real seed)

```bash
bun run payload run scripts/quality/fixtures.ts            # publishes the two fixtures in your DB
NEXT_PUBLIC_SITE_URL=http://localhost:3210 bun run build
rm -rf .next/cache                                          # a fixture created after a visit stays cached as 404
NEXT_PUBLIC_SITE_URL=http://localhost:3210 bun run start -- -p 3210
export CHROME_PATH=$(node -p "require('playwright-core').chromium.executablePath()")
LHCI_CATEGORY=deck-ve-zeminler bunx lhci collect --config=lighthouserc.cjs && bunx lhci assert --config=lighthouserc.cjs
bun run payload run scripts/quality/fixtures.ts -- --remove # don't leave them in a shared DB
```

## Results, 2026-10-14 (local real seed, Lighthouse 12 mobile, simulated throttling, median of 3)

| Template | Perf | A11y | Best pr. | SEO | LCP | CLS | TBT | JS transfer |
|---|---|---|---|---|---|---|---|---|
| `/tr` | 80 | 100 | 100 | 100 | 5.3 s | 0 | 39 ms | 145.5 KB |
| `/tr/deck-ve-zeminler` | 81 | 100 | 100 | 100 | 5.2 s | 0 | 32 ms | 142.8 KB |
| `/tr/galeri` | 76 | 100 | 100 | 100 | 8.2 s | 0 | 36 ms | 145.5 KB |
| `/tr/projeler/<fixture>` | 90 | 100 | 100 | 100¹ | 3.6 s | 0 | 37 ms | 142.8 KB |
| `/tr/iletisim` | 95 | 100 | 100 | 100 | 3.0 s | 0 | 60 ms | 147.2 KB |
| `/tr/rehber/<fixture>` | 99 | 100 | 100 | 100 | 2.0 s | 0 | 38 ms | 142.8 KB |

Gallery varies a lot from run to run because its LCP is a lazy masonry photo. Five runs gave 70–82 on this branch and 68–78 on the base, so this branch is no worse.

¹ One cold run reported a missing meta description: the first render after a cache wipe streams metadata into `<body>`. CI warms each URL before collecting.

Home, category, gallery and project stay below 95. Image weight is the cause, not JS. See #116 for the LCP breakdown and the proposed fix: an intermediate derivative width and gallery LCP priority.
- On mobile, the 2-column grids need about 322 px per card. That is just above `w320`, so the browser downloads `w640` at 50–170 KB per card.
- About 1.7 MB of those photos sit inside Chrome's lazy-load distance, and they compete with the hero.
- Media is served from local RustFS (HTTP/1.1, no cache headers). Production uses the Cloudflare CDN, so production numbers will differ.

## First-load JS (gzip, module `<script src>` under `/_next`, nomodule polyfills excluded)

| Template | Before | After |
|---|---|---|
| home (TR/EN), gallery, image page | 157.9 KB | 142.0 KB |
| contact | 159.7 KB | 143.8 KB |
| every other template | 155.6 KB | 139.8 KB |
| 404 | 129.4 KB | 129.4 KB |

How the 16 KB came off:
- next-intl's `createNavigation` shipped its client `Link`, and with it the whole message formatter (`intl-messageformat`, about 13 KB gz), to every page. The layout-wide `NextIntlClientProvider` also serialized every message into each page's HTML, about 5 KB gz.
- Links and pathnames are now resolved on the server (`src/lib/i18n/pathname.ts`, tested for parity with next-intl). The cookie banner and contact form get server-translated copy, and Umami loads with a plain deferred `<script>` instead of `next/script`.
- What's left is about 129 KB of React and the Next runtime, which is the floor, plus 10–14 KB of site code: header and menu, consent, `next/link`, the gallery grid, and the contact form.
