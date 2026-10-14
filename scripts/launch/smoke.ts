// Launch smoke test (#53): key pages, canonical/hreflang, robots, sitemap, 5 legacy WP 301s, an unknown upload 410.
// Run: bun scripts/launch/smoke.ts <baseUrl> [--site <canonical origin>] [--media-base <cdn url>] [--production]
//   --site        canonical origin pages must point to (default: baseUrl)
//   --media-base  where legacy media redirects go (default https://cdn.kefkenahsap.com; dev: https://cdn.kefkenahsap.com/dev)
//   --production  robots must allow crawling and list the sitemap (otherwise it must block everything)
// Basic auth (development): SMOKE_BASIC_AUTH=user:password. It is sent only to the base URL's origin, never the CDN.
// Each request times out after 15 s. Exit code 1 when any check fails.
import { parseArgs } from 'node:util'

import { evaluate, smokeChecks } from '@/lib/launch/smoke'

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { site: { type: 'string' }, 'media-base': { type: 'string' }, production: { type: 'boolean', default: false } },
})
const base = positionals[0]?.replace(/\/$/, '')
if (!base) {
  console.error('usage: bun scripts/launch/smoke.ts <baseUrl> [--site <origin>] [--media-base <url>] [--production]')
  process.exit(2)
}
if (new URL(base).username || new URL(base).password) {
  console.error('put credentials in SMOKE_BASIC_AUTH, not in the URL (it would end up in logs and shell history)')
  process.exit(2)
}
const site = values.site ?? base
const auth = process.env.SMOKE_BASIC_AUTH
const checks = smokeChecks({ site, mediaBase: values['media-base'] ?? 'https://cdn.kefkenahsap.com', production: values.production })

let failed = 0
for (const check of checks) {
  const url = new URL(check.path, `${base}/`)
  const headers: Record<string, string> = { 'user-agent': 'kefken-launch-smoke' }
  if (auth && url.origin === new URL(base).origin) headers.authorization = `Basic ${Buffer.from(auth).toString('base64')}`
  let problems: string[]
  try {
    const res = await fetch(url, { redirect: 'manual', headers, signal: AbortSignal.timeout(15_000) })
    problems = evaluate(check, { status: res.status, location: res.headers.get('location'), body: await res.text() }, site)
  } catch (err) {
    problems = [`request failed: ${(err as Error).message}`]
  }
  if (problems.length) failed++
  console.log(`${problems.length ? 'FAIL' : 'PASS'}  ${check.status}  ${check.path}${problems.length ? `\n      ${problems.join('\n      ')}` : ''}`)
}
console.log(`\n${checks.length - failed}/${checks.length} passed against ${base} (canonical origin ${site})`)
process.exit(failed ? 1 : 0)
