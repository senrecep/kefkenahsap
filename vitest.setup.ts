// Any setup scripts you might need go here

// Load .env files
import 'dotenv/config'

// No test ever calls OpenRouter: every AI task uses the deterministic fake model (src/ai/fake.ts).
process.env.AI_FAKE_PROVIDER = '1'
