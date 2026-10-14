import { execSync } from 'node:child_process'

// Integration tests run against the compose Postgres; bring its schema up to date first.
export default function setup() {
  execSync('bun run migrate', { stdio: 'inherit', stdin: 'ignore' } as Parameters<typeof execSync>[1])
}
