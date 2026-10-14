// #52 Lighthouse CI: mobile (Lighthouse default emulation) on the key templates, against a production build.
// Needs the published project + guide from scripts/quality/fixtures.ts; LHCI_BASE_URL and LHCI_CATEGORY set the target.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- LHCI loads its config as CommonJS
const F = require('./scripts/quality/fixtures.json')

const base = process.env.LHCI_BASE_URL ?? 'http://localhost:3210'
const paths = ['/tr', `/tr/${process.env.LHCI_CATEGORY ?? 'e2e-deck'}`, '/tr/galeri', `/tr/projeler/${F.project.tr}`, '/tr/iletisim', `/tr/rehber/${F.guide.tr}`]

module.exports = {
  ci: {
    collect: {
      url: paths.map((p) => base + p),
      numberOfRuns: 3,
      settings: {
        chromeFlags: '--no-sandbox --headless=new',
        // Non-production builds send `X-Robots-Tag: noindex` on purpose (next.config.ts, fixed at build time).
        // Skipped audits leave the SEO score, so every other SEO audit still counts.
        skipAudits: ['is-crawlable'],
      },
    },
    assert: {
      aggregationMethod: 'median-run',
      assertions: {
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
