// #52 Lighthouse CI: mobile (Lighthouse default emulation) on the key templates in every locale, against a production
// build. Paths come from .quality-targets.json, written by scripts/quality/fixtures.ts from routing.locales + getPathname
// (this CommonJS file can't import the TS routing). LHCI_BASE_URL sets the server.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- LHCI loads its config as CommonJS
const { existsSync, readFileSync } = require('node:fs')

const TARGETS = `${__dirname}/.quality-targets.json`
const KEY_TEMPLATES = ['home', 'category', 'gallery', 'project', 'contact', 'guide']
const base = process.env.LHCI_BASE_URL ?? 'http://localhost:3210'
// assert/upload load this config too; only collect needs the paths.
const targets = existsSync(TARGETS) ? JSON.parse(readFileSync(TARGETS, 'utf8')) : {}
const paths = Object.values(targets).flatMap((byTemplate) => KEY_TEMPLATES.map((t) => byTemplate[t]))

module.exports = {
  ci: {
    collect: {
      url: paths.map((p) => base + p),
      numberOfRuns: 3,
      settings: {
        // The self-hosted runner crashed the tab (TARGET_CRASHED) during the full-page screenshot: small /dev/shm.
        chromeFlags: '--no-sandbox --headless=new --disable-dev-shm-usage --disable-gpu',
        disableFullPageScreenshot: true,
        // Non-production builds send `X-Robots-Tag: noindex` on purpose (next.config.ts, fixed at build time).
        // Skipped audits leave the SEO score, so every other SEO audit still counts.
        skipAudits: ['is-crawlable'],
      },
    },
    assert: {
      aggregationMethod: 'median-run',
      assertions: {
        // Known red on the photo-heavy templates (home, category, gallery, project ≈ 80–90 locally) until #116 lands.
        'categories:performance': ['error', { minScore: 0.95 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.95 }],
        'categories:seo': ['error', { minScore: 0.95 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.05 }],
        // Transfer size of all JS a page loads (first load + lazy chunks + third parties), in bytes. First-load JS alone
        // is held at ≤150 KB gz (CLAUDE.md); the small margin covers lazy chunks and analytics.
        'resource-summary:script:size': ['error', { maxNumericValue: 160 * 1024 }],
      },
    },
    upload: { target: 'filesystem', outputDir: '.lighthouseci/reports' },
  },
}
