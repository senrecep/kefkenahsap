// #53: set one user's password through the Payload local API, over a DB tunnel (docs/LAUNCH.md 2G).
// The prod admin can't be used through the SSH tunnel: csrf allows only https://www.kefkenahsap.com, so the admin's
// PATCH from http://localhost is refused. Don't loosen csrf; use this instead. Also clears a login lock.
// The password comes from stdin only (never argv, env or a file):
//   read -rsp 'new password: ' PW; echo; printf '%s' "$PW" | bun run payload run scripts/launch/set-password.ts -- --email <email> --yes; unset PW
import { getPayload } from 'payload'

import config from '@/payload.config'
import { databaseHost } from '@/lib/quality/target'

const i = process.argv.indexOf('--email')
const email = i > 0 ? process.argv[i + 1]?.trim().toLowerCase() : undefined
if (!email || !email.includes('@')) {
  console.error('usage: printf %s "$PW" | bun run payload run scripts/launch/set-password.ts -- --email <email> --yes')
  process.exit(2)
}
if (process.stdin.isTTY) {
  console.error('pipe the password on stdin (read -rs, then printf); it is never taken from argv')
  process.exit(2)
}
const chunks: Buffer[] = []
for await (const c of process.stdin) chunks.push(c as Buffer)
const password = Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '')
if (password.length < 12) {
  console.error('refusing: password shorter than 12 characters')
  process.exit(2)
}

const target = `${databaseHost(process.env.DATABASE_URL) || '?'}/${process.env.DATABASE_URL?.split('/').pop() ?? '?'} (SITE_ENV=${process.env.SITE_ENV ?? '-'})`
console.log(`database: ${target} · user: ${email}`)
if (!process.argv.includes('--yes')) {
  console.error('check the target above, then re-run with --yes')
  process.exit(1)
}

const payload = await getPayload({ config: await config })
const found = await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true })
const user = found.docs[0]
if (!user) {
  console.error(`no user ${email}`)
  process.exit(1)
}
await payload.update({
  collection: 'users',
  id: user.id,
  data: { password, loginAttempts: 0, lockUntil: null },
  overrideAccess: true,
})
// Self-check: the new password logs in.
await payload.login({ collection: 'users', data: { email, password }, overrideAccess: true })
console.log(`password set and verified for ${email}`)
process.exit(0)
