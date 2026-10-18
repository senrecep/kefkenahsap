// #223: the owner-answer rules written the way scripts/seed/owner-answers.ts writes them (per locale, the changed fields
// only, published) remove a Lexical list item and a FAQ sentence, keep the FAQ row ids and leave the other locale alone.
import { convertMarkdownToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, expect, it } from 'vitest'

import { applyTextRules, OWNER_ANSWER_RULES } from '@/lib/content/owner-answers'
import config from '@/payload.config'

const SLUG = 'owner-answers-223'
let payload: Payload
const cleanup = () => payload.delete({ collection: 'categories', where: { slug: { in: [SLUG, `${SLUG}-en`] } } })

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  await cleanup()
})
afterAll(async () => {
  await cleanup()
})

it('removes the meeting-table item and the anti-slip sentence per locale, keeps FAQ ids, slug and the other locale', async () => {
  const editorConfig = await editorConfigFactory.default({ config: payload.config })
  const md = (items: string[]) => convertMarkdownToLexical({ editorConfig, markdown: `## Neler?\n\n${items.map((i) => `- ${i}`).join('\n')}` })
  const cat = await payload.create({
    collection: 'categories',
    locale: 'tr',
    data: {
      name: 'Kapı, Dolap ve Seperatör',
      slug: SLUG,
      body: md(['Mutfak dolapları', 'Toplantı masaları ve yönetici ofisi mobilyaları', 'Tekne kamaraları']),
      faq: [{ q: 'Kayar mı?', a: 'Temiz tutun. İstenirse basamak yüzeyine kaydırmaz detaylar eklenebilir.' }],
      _status: 'published',
    } as never,
    context: { skipAi: true },
  })
  await payload.update({
    collection: 'categories',
    id: cat.id,
    locale: 'en',
    data: { name: 'Doors', slug: `${SLUG}-en`, body: md(['Kitchen cabinets', 'Meeting tables and executive office furniture']), faq: [{ q: 'Slippery?', a: 'Keep it clean. Anti-slip details can be added to the treads if wanted.' }], _status: 'published' } as never,
    context: { skipAi: true },
  })
  const read = (locale: 'tr' | 'en') => payload.findByID({ collection: 'categories', id: cat.id, locale, fallbackLocale: false, draft: true, depth: 0 })
  const enBefore = await read('en')

  // The script's write for tr: changed top-level fields only, published.
  const trBefore = await read('tr')
  const rules = OWNER_ANSWER_RULES.filter((r) => r.locale === 'tr')
  const patch = Object.fromEntries(
    (['name', 'body', 'faq'] as const).map((k) => [k, applyTextRules(trBefore[k], rules).value] as const).filter(([k, v]) => v !== trBefore[k]),
  )
  expect(Object.keys(patch).sort()).toEqual(['body', 'faq', 'name'])
  await payload.update({ collection: 'categories', id: cat.id, locale: 'tr', data: { ...patch, _status: 'published' } as never, context: { skipAi: true } })

  const tr = await payload.findByID({ collection: 'categories', id: cat.id, locale: 'tr', fallbackLocale: false, depth: 0 })
  expect(tr.name).toBe('Kapı, Dolap ve Separatör')
  expect(tr.slug).toBe(SLUG)
  const body = JSON.stringify(tr.body)
  expect(body).not.toContain('Toplantı')
  expect(body).toContain('Mutfak dolapları')
  expect(body).toContain('Tekne kamaraları')
  expect(tr.faq).toEqual([{ id: trBefore.faq![0]!.id, q: 'Kayar mı?', a: 'Temiz tutun.' }])
  // A second pass finds nothing.
  expect(applyTextRules([tr.name, tr.body, tr.faq], rules).hits.size).toBe(0)
  // en untouched by the tr write.
  const en = await read('en')
  expect([en.name, en.slug, en.body, en.faq]).toEqual([enBefore.name, enBefore.slug, enBefore.body, enBefore.faq])
})
