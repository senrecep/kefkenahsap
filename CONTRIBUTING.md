# Contributing to kefkenahsap

This is the website of a real business, so outside contributions are limited. Issues are welcome: bug reports, accessibility problems, and suggestions. For a larger change, open an issue first.

Conventions for code, tests, and content live in [CLAUDE.md](./CLAUDE.md). Product rules are in [PRODUCT.md](./PRODUCT.md). Note that [CONTENT-LICENSE.md](./CONTENT-LICENSE.md) excludes photos, brand assets, and site copy from the MIT license.

## Development Setup

```bash
git clone https://github.com/senrecep/kefkenahsap.git
cd kefkenahsap
bun install
cp .env.example .env
docker compose --profile local up -d    # Postgres :5433 + S3 (RustFS)
bun dev
```

See the [README](./README.md#local-development) for details.

## Development Workflow

### 1. Branch naming
- `feat/<issue>-short-description`: new feature
- `fix/<issue>-short-description`: bug fix
- `docs/short-description`: documentation only
- `chore/short-description`: tooling, deps, config

Branch from `main`. PRs target `main`.

### 2. Write the test first

The project uses TDD: write one failing test, make it pass, refactor. Pure logic is covered by Vitest next to the code (`src/**/*.test.ts`); integration tests are in `tests/int` and need Postgres; end-to-end tests are Playwright in `tests/e2e`.

### 3. Verify your changes

```bash
bun run typecheck
bun run lint
bun run test
bun run check:generated   # if you touched collections or admin components
```

`bun run check` runs typecheck, lint, and tests together. Schema changes go through migrations (`bun run migrate:create <name>`), never through push.

### 4. Commit message format

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(calc): add unit selector to the timber table
fix(i18n): 404 instead of 500 for an unknown locale
docs(readme): update local development steps
chore(deps): bump payload to 3.90.2
```

Code, identifiers, commits, and tests are in English.

### 5. Pull Request

- Keep PRs focused: one change per PR
- Describe **what** and **why**
- Link the issue (`Closes #123`)

## CI on Pull Requests

CI runs on self-hosted runners that belong to the maintainer, not on GitHub-hosted runners. Workflows on pull requests from forks therefore never run without the maintainer's approval, and the maintainer will normally run the checks on a branch of this repository instead before merging.

## Reporting Issues

- Bugs and suggestions: [GitHub Issues](https://github.com/senrecep/kefkenahsap/issues)
- Security problems: see [SECURITY.md](./SECURITY.md). Do not open a public issue.
