// Any setup scripts you might need go here

// Load .env files
import 'dotenv/config'

// No test ever calls OpenRouter: every AI task uses the deterministic fake model (src/ai/fake.ts).
process.env.AI_FAKE_PROVIDER = '1'
// No test ever purges the real Cloudflare cache; media-cdn-purge.int.spec.ts sets fake values and fakes the API.
delete process.env.CLOUDFLARE_ZONE_ID
delete process.env.CLOUDFLARE_PURGE_TOKEN
