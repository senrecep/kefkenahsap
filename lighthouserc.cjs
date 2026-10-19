// #52 Lighthouse CI: mobile (Lighthouse default emulation) on the key templates in every locale, against a production
// build. Paths come from .quality-targets.json, written by scripts/quality/fixtures.ts from routing.locales + getPathname
// (this CommonJS file can't import the TS routing). LHCI_BASE_URL sets the server.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- LHCI loads its config as CommonJS
const { existsSync, readFileSync } = require('node:fs')

const TARGETS = `${__dirname}/.quality-targets.json`
const KEY_TEMPLATES = ['home', 'category', 'gallery', 'project', 'contact', 'guide', 'calculator']
const base = process.env.LHCI_BASE_URL ?? 'http://localhost:3210'
// assert/upload load this config too; only collect needs the paths.
const targets = existsSync(TARGETS) ? JSON.parse(readFileSync(TARGETS, 'utf8')) : {}
// LHCI_LOCALES picks locales and, per locale, optionally fewer templates: "tr,en,ar:home+category+gallery+contact".
// Unset: every locale in the targets file with every key template.
const plan = process.env.LHCI_LOCALES
  ? process.env.LHCI_LOCALES.split(',').map((entry) => {
      const [locale, only] = entry.trim().split(':')
      return [locale, only ? only.split('+') : KEY_TEMPLATES]
    })
  : Object.keys(targets).map((locale) => [locale, KEY_TEMPLATES])
const paths = plan.flatMap(([locale, templates]) => templates.map((t) => targets[locale]?.[t]).filter(Boolean))

// #233 material calculator (every locale's path): its island (~14 KB gz: form, exact BigInt arithmetic, tsentials
// Result/json for the share link) is split from first load with next/dynamic and fetched right after it, so the
// first-load rule (≤150 KB gz) holds while the all-JS total sits at ~165 KB. 170 KB for this URL only.
const CALCULATOR = '/(malzeme-hesaplayici|material-calculator|kalkulyator-materialov|materialrechner)$'

const assertions = (scriptKb) => ({
  // Known red on the photo-heavy templates (home, category, gallery, project ≈ 80–90 locally) until #116 lands.
  'categories:performance': ['error', { minScore: 0.95 }],
  'categories:accessibility': ['error', { minScore: 0.95 }],
  'categories:best-practices': ['error', { minScore: 0.95 }],
  'categories:seo': ['error', { minScore: 0.95 }],
  'cumulative-layout-shift': ['error', { maxNumericValue: 0.05 }],
  // Transfer size of all JS a page loads (first load + lazy chunks + third parties), in bytes. First-load JS alone
  // is held at ≤150 KB gz (CLAUDE.md); the small margin covers lazy chunks and analytics.
  'resource-summary:script:size': ['error', { maxNumericValue: scriptKb * 1024 }],
})

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
      // The calculator (#233) gets its own script budget, see CALCULATOR below; every other page the shared one.
      assertMatrix: [
        { matchingUrlPattern: `^(?!.*${CALCULATOR})`, aggregationMethod: 'median-run', assertions: assertions(160) },
        { matchingUrlPattern: CALCULATOR, aggregationMethod: 'median-run', assertions: assertions(170) },
      ],
    },
    upload: { target: 'filesystem', outputDir: '.lighthouseci/reports' },
  },
}
