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
        test: { name: 'unit', environment: 'node', include: ['src/**/*.test.ts', 'src/**/*.test.tsx'] },
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
