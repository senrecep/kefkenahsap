// Seeds only the references. Run: bun run payload run scripts/seed/run-references.ts
import { getPayload } from 'payload'

import config from '@/payload.config'

import { seedReferences } from './references'

try {
  console.log(await seedReferences(await getPayload({ config })))
  process.exit(0)
} catch (err) {
  console.error('references seed failed', err)
  process.exit(1)
}
