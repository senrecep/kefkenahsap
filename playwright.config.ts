import { defineConfig, devices } from '@playwright/test'

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import 'dotenv/config'

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  // Seeds photos into an empty DB (CI) before any page is rendered and cached.
  globalSetup: './tests/e2e/global-setup.ts',
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  // Admin specs share one seeded user and one database, so run serially.
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI ? 'github' : 'list',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: `http://localhost:${process.env.E2E_PORT ?? 3000}`,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: /consent\.e2e\.spec\.ts/,
      // A stored "denied" choice keeps the cookie banner from covering controls in unrelated specs.
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chromium',
        storageState: {
          cookies: [{ name: 'kh_consent', value: 'denied', domain: 'localhost', path: '/', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax' }],
          origins: [],
        },
      },
    },
    {
      name: 'consent',
      testMatch: /consent\.e2e\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
  webServer: {
    // CI runs against the production build (E2E_START_COMMAND=bun run start).
    command: process.env.E2E_START_COMMAND ?? 'bun run dev',
    timeout: 180_000,
    // Locally reuse a running `bun dev`; in CI always start our own server on the probed free port.
    reuseExistingServer: !process.env.CI,
    // A static file: the readiness probe must not render (and cache) a data page before globalSetup seeds.
    url: `http://localhost:${process.env.E2E_PORT ?? 3000}/brand/logo.png`,
  },
})
