import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    setupFiles: ['./vitest.setup.ts'],
    projects: [
      {
        extends: true,
        // Pure seams: no DB, no network.
        // next-intl is inlined so its extensionless `next/*` imports resolve (pathname parity test).
        // CI runners share the host with the e2e shards; heavy property and content-scan tests blow the 5 s default there.
        test: { name: 'unit', environment: 'node', testTimeout: 30_000, include: ['src/**/*.test.ts', 'src/**/*.test.tsx'], server: { deps: { inline: ['next-intl'] } } },
      },
      {
        extends: true,
        // Payload integration tests against the compose Postgres.
        test: {
          name: 'int',
          environment: 'node',
          include: ['tests/int/**/*.int.spec.ts'],
          globalSetup: ['./tests/int/global-setup.ts'],
          testTimeout: 60_000,
          hookTimeout: 60_000,
          fileParallelism: false,
        },
      },
    ],
  },
})
