// #140: seeds only the site settings: TR while the global has no phones, EN and seed/i18n/<locale>/site-settings.json
// only into empty values. Idempotent. --dry-run writes nothing; a non-local database needs --yes.
// Run: bun run payload run scripts/seed/run-site-settings.ts [-- --dry-run | --yes]
import { getPayload } from 'payload'

import config from '@/payload.config'

import { guardTarget } from './i18n'
import { seedSiteSettings } from './site-settings'

const dryRun = process.argv.includes('--dry-run')
guardTarget(dryRun)

try {
  console.log(await seedSiteSettings(await getPayload({ config: await config }), { dryRun }))
  process.exit(0)
} catch (err) {
  console.error('site settings seed failed', err)
  process.exit(1)
}
