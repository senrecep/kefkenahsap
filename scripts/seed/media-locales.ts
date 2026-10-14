// #138: fills the empty title / alt / caption of the locales beyond TR/EN on the seeded photos, from
// seed/i18n/<locale>/media-meta/<cat>/<file>.json and …/media-meta-archive/… (matched on seedKey, as seed.ts and archive.ts
// key them). Only empty fields are written and `status` is never sent: a pending archive photo stays pending.
// Idempotent: a re-run writes nothing. --dry-run writes nothing; a non-local database needs --yes.
// Run: bun run payload run scripts/seed/media-locales.ts [-- --dry-run | --yes]
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'

import config from '@/payload.config'

import { guardTarget, seedMediaLocales } from './i18n'

const dryRun = process.argv.includes('--dry-run')
guardTarget(dryRun)

const SEED = path.resolve(process.cwd(), 'seed')
const rels = ['media-meta', 'media-meta-archive'].flatMap((tree) =>
  readdirSync(path.join(SEED, tree), { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => `${tree}/${f.split(path.sep).join('/')}`),
)
const payload = await getPayload({ config: await config })
const c = await seedMediaLocales(payload, { seedDir: SEED, rels, dryRun })
console.log(`${dryRun ? '[dry run] ' : ''}media locales: ${c.writes} locale write(s) on ${c.media} photo(s); ${c.noOverlay} of ${rels.length} meta files without any overlay; ${c.noMedia} with no matching photo`)
process.exit(0)
