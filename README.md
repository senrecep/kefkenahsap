<p align="center">
  <img src="public/brand/logo.png" alt="Kefken Ahşap Dekorasyon logo" width="494" height="112" />
</p>

# kefkenahsap

[![CI](https://img.shields.io/github/actions/workflow/status/senrecep/kefkenahsap/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/senrecep/kefkenahsap/actions)
[![code license: MIT](https://img.shields.io/badge/code-MIT-blue?style=flat-square)](./LICENSE)
[![content: all rights reserved](https://img.shields.io/badge/content-all%20rights%20reserved-lightgrey?style=flat-square)](./CONTENT-LICENSE.md)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=nextdotjs)](https://nextjs.org)
[![Payload](https://img.shields.io/badge/Payload-3-000000?style=flat-square&logo=payloadcms)](https://payloadcms.com)

Multilingual portfolio and quote-request site for a woodwork and decking business in Kefken, Kocaeli, built on Next.js and Payload CMS.

**Live site: [www.kefkenahsap.com](https://www.kefkenahsap.com)**

---

## What it is

The website of Kefken Ahşap Dekorasyon, a contractor that builds and installs decks, pergolas, gazebos, fences, stairs, doors, and wood furniture. Visitors browse photos of finished work, read guides, and contact the business on WhatsApp or through a form with photo upload.

- **Five languages:** Turkish, English, Russian, German, Arabic (RTL), with translated URLs and hreflang.
- **Payload admin** at `/admin` for categories, projects, references, guides, pages, photos, and inquiries.
- **Photo gallery** with categories, tags, and per-photo alt text and SEO file names.
- **AI-assisted media metadata:** tags, alt texts, and translations are drafted through OpenRouter. Nothing is published automatically; AI output lands as a draft for review.
- **Material and quote calculator** at `/malzeme-hesaplayici`: timber, deck, and related material estimates. The user enters the prices; the site has no price list.
- **Inquiry form** with photo upload. Photos go to a private bucket and are deleted after the retention period.
- **SEO and GEO:** JSON-LD, sitemaps, `llms.txt`, redirects from the old WordPress site.
- **Analytics and observability:** consent-gated analytics, GlitchTip error tracking.

## Tech Stack

| Area | Choice |
|------|--------|
| App | Next.js 16 (App Router, React 19), Payload CMS 3 in the same app |
| Language | TypeScript, [tsentials](https://github.com/senrecep/tsentials) (`Result<T>`, `Maybe<T>`) |
| Database | PostgreSQL 17 (`@payloadcms/db-postgres`, migrations only) |
| Media | S3-compatible storage (Cloudflare R2 in production, RustFS locally) |
| Styling | Tailwind CSS 4 |
| i18n | next-intl 4 |
| AI | Vercel AI SDK with OpenRouter |
| Email | Resend |
| Tests | Vitest, Playwright, axe, Lighthouse CI |
| Tooling | bun, ESLint, Prettier |

## Architecture

One Next.js app serves the public site (`src/app/(frontend)/[locale]`) and the Payload admin and API (`src/app/(payload)`). Content lives in Postgres through Payload collections; photos are stored in S3 and served straight from the CDN. Domain logic is kept as pure functions in `src/lib/` that return `Result<T>`, separate from Payload and Next, so it can be unit tested without a database.

## Project Structure

```
src/app/         — Next.js routes: public site, Payload admin, sitemaps, llms.txt
src/collections/ — Payload collections (media, categories, projects, guides, leads, ...)
src/lib/         — Domain logic and tested seams (calc, leads, legacy redirects, seo, gallery, ...)
src/ai/          — OpenRouter tasks, prompts, schemas, budget guard, fake provider for tests
src/jobs/        — Background jobs (image tagging, media translation, lead retention)
src/migrations/  — Database migrations
messages/        — UI strings and site copy per locale
seed/            — Seed content and photo metadata
scripts/         — Seed, media, launch, and OG image scripts
tests/           — Integration (needs Postgres), e2e, fixtures
docs/            — Plan, runbook, launch playbook, and notes
```

## Local Development

Requirements: [bun](https://bun.sh), Node.js 22 or newer, Docker.

```bash
git clone https://github.com/senrecep/kefkenahsap.git
cd kefkenahsap
bun install
cp .env.example .env                    # local defaults work with the compose services
docker compose --profile local up -d    # Postgres on :5433, S3 (RustFS) on :9000
bun dev                                 # http://localhost:3000 (site at /tr, admin at /admin)
```

Set `AI_FAKE_PROVIDER=1` in `.env` to run the AI features without an OpenRouter key.

Useful commands:

```bash
bun run migrate:create <name>   # schema changes go through migrations
bun run generate:types          # regenerate Payload types
bun run check:generated         # generated types and admin import map are committed and current
```

## Testing

```bash
bun run typecheck
bun run lint
bun run test            # unit tests, plus integration tests in tests/int (need Postgres)
bun run test:e2e        # Playwright (starts bun dev if it is not running)
bun run check           # typecheck + lint + test
```

Tests never call external services: AI tasks answer from a fake provider.

## Deployment

Production runs as a Docker Compose stack on Dokploy behind Cloudflare. Merging to `main` builds the image and triggers the deploy; checks run on the pull request on self-hosted GitHub runners. Details are in [docs/RUNBOOK.md](./docs/RUNBOOK.md) and [docs/LAUNCH.md](./docs/LAUNCH.md).

## Documentation

| File | Contents |
|------|----------|
| [docs/PLAN.md](./docs/PLAN.md) | Architecture, data model, URLs, SEO, phases |
| [docs/RUNBOOK.md](./docs/RUNBOOK.md) | Infrastructure, CI runners, deploys, operations |
| [docs/LAUNCH.md](./docs/LAUNCH.md) | Go-live playbook |
| [docs/AI-PROMPTS.md](./docs/AI-PROMPTS.md) | AI prompt workflow and Turkish rules |
| [PRODUCT.md](./PRODUCT.md) | Users, positioning, brand commitments |
| [DESIGN.md](./DESIGN.md) | Design system |
| [CLAUDE.md](./CLAUDE.md) | Conventions for contributors and agents |

Most project documents are written in Turkish or mix Turkish and English.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Security reports: [SECURITY.md](./SECURITY.md).

## License

The **source code** is released under the [MIT License](./LICENSE).

The **content** is not: photos, logo and brand assets, seed content, site copy, legal texts, and screenshots are all rights reserved by Kefken Ahşap Dekorasyon (Murat Şen). The full list is in [CONTENT-LICENSE.md](./CONTENT-LICENSE.md). The business name and logo are trademarks, so a fork must replace the content and branding with its own.
