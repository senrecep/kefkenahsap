# kefkenahsap.com — instructions for agents

The site of a wood fabrication and installation contractor in Istanbul. Next.js 16 + Payload CMS 3 in one app, bilingual (TR/EN, AR/RU/DE later).

**Read in this order before any work:**
1. `docs/PLAN.md` — the approved plan. Single source of truth for architecture, data model, URLs, SEO/GEO, AI and phases.
2. `PRODUCT.md` — users, positioning, brand commitments, and claims that must not be invented.
3. `docs/legacy/decisions.md` — the user's confirmed decisions (#1–#59). Don't reopen them; ask if something seems wrong.
4. The active goal in `.omc/ultragoal/` — which phase is running and its acceptance criteria.

User-visible copy is in Turkish. Code, identifiers, commits and tests are in English.

## Hard rules

- **Never invent a claim.** Years of experience ("30 yıl"), project counts, prices, testimonials and certificates come only from the admin (siteSettings / collections). An empty field renders nothing.
- **Don't add a feature outside the plan.** If something is needed, add it to the "Açık noktalar" section of `docs/PLAN.md` and ask.
- Stack is fixed: bun, Next 16 App Router, Payload 3.x (the version pinned in the spike), Postgres 17, Tailwind 4, next-intl 4, Vercel AI SDK + OpenRouter, Motion / GSAP / OGL (lazy loaded only). Ask before adding a new dependency. Don't add a package for something a few lines can do.
- Next 16: `proxy.ts` (not `middleware`); the Payload revalidate hooks use `revalidateTag(tag, { expire: 0 })` (read-your-writes from route handlers, #192), elsewhere `revalidateTag(tag, 'max')`.
- No hardcoded locales: always use `routing.locales` and Payload `localization`. Write CSS with logical properties (`ms-`/`me-`, `start`/`end`) — Arabic RTL comes later.
- Media is served directly from the CDN (`cdn.kefkenahsap.com`), never through `/api/media/file`. Lead photos go only to a private disk volume, never the CDN bucket. No clean originals of watermarked uploads are kept (#204).
- Performance budget: initial JS ≤150KB gz, Lighthouse mobile ≥95, CLS <0.05. Any heavy library goes behind a dynamic import.
- Accessibility: WCAG 2.2 AA. Published images must have approved alt text. Admin tap targets are ≥48px.
- Secrets come only from env. `.env*` is never committed.

## Development: TDD (red → green → refactor)

Use the `oh-my-claudecode:tdd` workflow. One test, one implementation, small steps.

1. **Write the test first** and watch it fail for the right reason. Compute expected values independently of the code: from the plan, the legacy data or a hand calculation. Never copy them from the implementation's output.
2. Write the minimum implementation to pass it, then refactor.
3. `test.skip`, `.only`, empty or placeholder tests, and TODO branches are blockers, not done.
4. Commit only when tests pass.

**Test seams** (pure logic goes here, kept separate from Payload and Next):

| Seam | Location | What it tests |
|---|---|---|
| Legacy redirect resolver | `src/lib/legacy/` | Every URL in `docs/legacy/wp-media.json`: URI decode + NFC, `-WxH`/`-N`/`.jpg1_` suffixes, trailing slash, Turkish characters → 301 target or 410, in a single hop |
| Locale "published" rule | `src/lib/i18n/` | slug + title filled → hreflang/sitemap/noindex decision |
| WhatsApp message builder | `src/lib/whatsapp.ts` | Template per page type, URL encoding |
| SEO/JSON-LD builders | `src/lib/seo/` | Output for each schema type; no field missing from the visible text |
| Slug / SEO filename | `src/lib/slug.ts` | Turkish → ASCII, length limit, uniqueness per locale |
| Lead validation + retention | `src/lib/leads/` | Required fields, file limits, 2-year deletion date (with the fake time provider) |
| AI output schemas | `src/ai/` | Zod schemas, JSON repair, model-chain fallback (fake provider; no real API in tests) |
| Gallery cursor / masonry layout | `src/lib/gallery/` | Cursor stability, column distribution from known aspect ratios |

- Unit/integration: Vitest. E2E: Playwright (smoke, the full legacy redirect map, i18n/hreflang, sitemap, JSON-LD, form, admin upload/reorder). Accessibility: axe. Performance: Lighthouse CI.
- Payload integration tests use a real Postgres (compose `postgres`). Don't mock the DB; mock only external services (OpenRouter, Resend, Cloudflare, Turnstile) at the seam.

## Error handling: tsentials

Use [`tsentials`](https://github.com/senrecep/tsentials) (pinned: v1.0.0, see #134; 0.1.x → 1.0 behaviour changes: its `docs/BEHAVIOUR-CHANGES.md`). Install its skills once at the start of F0: `npx skills add senrecep/tsentials`. Use them for the correct API and import paths.

- **Return `Result<T>` from domain and service functions.** Don't throw inside the domain. Every seam above returns `Result<T>` / `ResultAsync<T>`.
- Create errors with `Err.*`. Codes are `Area.Reason`, e.g. `Lead.PhoneRequired`, `Legacy.UnknownMedia`, `AI.BudgetExceeded`, `Translate.SchemaMismatch`.
- External HTTP (Cloudflare purge, OpenRouter `/models`, Turnstile verify) goes through `tsentials/http` `fetchResult`. JSON parsing goes through `tsentials/json` `parseAndValidate` / `safeJsonParse`.
- Write async chains with `fromAsync(...).andThen().ensure().map()`. Don't scatter `await`/`try` around them.
- Get time from `DateTimeProvider` (`SystemDateTimeProvider` in production, `createFakeDateTimeProvider` in tests). Never call `new Date()` directly in the domain.
- Use `Maybe<T>` for optional content (founding year, price range, testimonial). This enforces the "no claim when empty" rule in types.
- **Edges only:** in Payload hooks/endpoints and Next route handlers/server actions, unwrap the `Result` with `match`. On failure, map it to `APIError` / an HTTP status / a form error. That is the only place `try/catch` and `throw` are allowed.
- Import subpaths only (`tsentials/result`, `tsentials/errors`, …) — this keeps them tree-shakeable.

## Design: impeccable

- `PRODUCT.md` is in place (init done). The visual direction is the **category standard executed at full craft**. The quality bar is `docs/PLAN.md` §11 (Millboard, Archadeck, Oakwrights).
- At the start of F1, run `/impeccable hooks on`. The design detector then runs automatically after every UI file edit.
- Before writing the first public UI, follow impeccable `new-work` (code-led). The direction contract goes into the surface brief. Finish with the finish review, then write `DESIGN.md` + `.impeccable/design.json`.
- Admin screens are Operate mode, guides are Read mode, and galleries are Experience mode.

## AI content

- Prompts live in `src/ai/prompts/` as TS modules with a version constant. Turkish rules are in `docs/CONTENT-STYLE-TR.md` (prompt summary: `src/ai/prompts/turkish.ts`, workflow: `docs/AI-PROMPTS.md`): correct Turkish characters, apostrophe before suffixes on proper nouns, no translationese, no list of clichés ("eşsiz", "hayallerinizdeki"…), and no invented facts.
- Nothing is published automatically. AI output always lands in a `pending`/draft state.
- Seed metadata (568 images) is prepared locally with Claude and reviewed, then loaded as `approved`. Runtime `tagImage` is for new uploads only.

## Commands

```bash
bun install
cp ../../kefkenahsap.dev.env .env       # worktree; from the main checkout: cp ../kefkenahsap.dev.env .env (else cp .env.example .env)
docker compose --profile local up -d    # postgres:5433 + S3 (RustFS :9000, console :9001), host networking
bun dev                                 # Next + Payload (localhost:3000 → /tr, /admin)
bun run test                            # vitest: unit (src/**/*.test.ts) + int (tests/int, needs postgres)
bun run test:e2e                        # playwright (starts bun dev if not running)
bun run typecheck && bun run lint
bun run check:generated                 # payload types + admin import map are committed and current (CI enforces it)
bun run migrate:create <name>           # schema changes only via migrations (push is off)
```

Agent skills are installed: `.claude/skills/payload` (Payload reference) and `.claude/skills/tsentials*`.

## Work order and GitHub flow

Phases come from the ultragoal ledger: F0 spike → F1 launch → F2 content and AI tools → F3 expansion. Each phase maps to an epic on GitHub:

| Ultragoal | Epic | Milestone |
|---|---|---|
| G001 F0 Spike | #1 | F0 Spike |
| G002 F1a Foundations | #2 | F1 Lansman |
| G003 F1b Content model & admin | #3 | F1 Lansman |
| G004 F1c Seed & legacy redirects | #4 | F1 Lansman |
| G005 F1d Public site & design | #5 | F1 Lansman |
| G006 F1e SEO/GEO & launch | #6 | F1 Lansman |
| G007 F2 Content & AI tools | #7 | F2 İçerik & AI |
| G008 F3 Expansion | #8 | F3 Genişleme |

- Issues: https://github.com/senrecep/kefkenahsap/issues. Board: https://github.com/users/senrecep/projects/5. Key → number map: `docs/issue-map.json`.
- **Order**: work the epic's sub-issues top to bottom. Don't start an issue until the issues in its "Bağımlılıklar" (dependencies) line are closed.
- **One issue = one branch = one worktree = one PR**:
  1. Set the issue to "In Progress" on the board and assign it.
  2. Create a branch from `main`: `feat/<no>-<slug>`, `spike/<no>-<slug>`, `chore/…`, `docs/…` or `design/…`.
  3. `git worktree add ../kefkenahsap-wt/<no>-<slug> -b <branch> origin/main`. Parallel work happens only in separate worktrees.
  4. TDD commits use Conventional Commits and reference the issue (`feat(legacy): resolve WP size variants (#20)`).
  5. Open the PR against `main`. Put `Closes #<no>` and `Part of #<epic>` in the body, add the matching labels and milestone, and list the acceptance criteria as a checklist with evidence (test output, screenshots, Lighthouse).
  6. Merge only when CI is green and the `code-reviewer` / `verifier` review is clean (squash). Then remove the worktree.
- PRs target `main` (the default branch), so `Closes #n` closes the issue on merge. Merging a PR **is the production deploy** (once `PRODUCTION_DEPLOY_APPROVED=true`): the push to `main` only builds and deploys, the checks ran on the PR. Branch protection on `main`: require the `test` and `e2e (1/2)` checks and "Require branches to be up to date before merging".
- Payload config changes need `bun run generate:types` + `bun run generate:importmap` (otherwise rich-text/admin components silently fail to render) and a migration.
- Design detector: the impeccable hook is enabled in `.impeccable/config.json`; if no per-edit reminders appear, run `$HOME/.claude/skills/impeccable/scripts/impeccable detect --json <changed UI files>` once before opening a UI PR.
- When the epic's last sub-issue closes, check the epic's acceptance criteria with evidence, close the epic, and run the ultragoal `checkpoint`.
- The `development` branch and the dev environment are retired (owner decision 2026-10-19): no release PRs, no `development` target. The branch stays until the owner deletes it.
- New work that comes up is never done silently: open a new issue (link it to the right epic as a sub-issue) and write it into the plan.
