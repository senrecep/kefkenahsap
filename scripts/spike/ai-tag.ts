// Spike #15: vision tagging through OpenRouter with AI SDK v7 structured output. Run: bun scripts/spike/ai-tag.ts
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateText, Output } from 'ai'
import { z } from 'zod'

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })

const TagSchema = z.object({
  title: z.object({ tr: z.string().max(80), en: z.string().max(80) }),
  alt: z.object({ tr: z.string().max(125), en: z.string().max(125) }),
  seoFilename: z.string().regex(/^[a-z0-9-]{3,60}$/),
  tags: z.object({
    wood: z.array(z.string()),
    setting: z.array(z.string()),
    finish: z.array(z.string()),
    stage: z.array(z.enum(['before', 'after', 'process', 'detail', 'finished'])),
  }),
  categoryAgrees: z.boolean(),
  confidence: z.number().min(0).max(1),
})

const DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../kefken-data/Webiste')
const samples = [
  ['Deck ve Zeminler', '1-1.webp'],
  ['Pergola ve Kamelyalar', null],
  ['Korkuluk ve Cit', null],
] as const

for (const [cat, file] of samples) {
  const dir = path.join(DATA, cat)
  const name = file ?? readdirSync(dir)[0]
  const image = readFileSync(path.join(dir, name))
  const t0 = Date.now()
  const res = await generateText({
    model: openrouter('google/gemini-3.8-flash', { usage: { include: true } }),
    temperature: 0.2,
    output: Output.object({ schema: TagSchema }),
    system:
      'Ahşap dekorasyon firmasının gerçek iş fotoğrafını tanımla. Doğal Türkçe kullan, Türkçe karakterler zorunlu. ' +
      'Görmediğin şeyi uydurma (ahşap türünden emin değilsen boş bırak). Görsel üzerindeki filigran yazısını metne ekleme.',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: `Kategori: ${cat}. Bugünün tarihi: ${new Date().toISOString().slice(0, 10)}.` },
          { type: 'image', image, mediaType: 'image/webp' },
        ],
      },
    ],
  })
  const cost = (res.providerMetadata?.openrouter as { usage?: { cost?: number } } | undefined)?.usage?.cost
  console.log(JSON.stringify({ cat, name, ms: Date.now() - t0, cost, tokens: res.usage, output: res.output }, null, 1))
}
