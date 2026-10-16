// #172: moves an already-seeded category to its new name and slugs (CATEGORY_RENAMES in src/seed/categories.ts): the
// same record, so its photos, cover, projects and order stay. Per locale (renamePatch): name and slug move while they
// are still the old seeded value; shortDesc/body/FAQ are replaced while the intro is still the old seeded intro
// (OLD below), else only empty ones are filled. Anything the owner edited stays, and a re-run writes nothing.
// The old URLs answer 301 from code (src/lib/legacy/resolve.ts), not from the Redirects collection.
// Where the write goes (as project-slugs.ts): a published category gets a new published version, a never-published one a
// new draft. A published one with a newer unpublished draft is skipped and listed: Payload merges any write into the
// latest version, so publishing the rename would publish that draft too. --publish-drafts does exactly that, on purpose:
// use it once the drafts are known to be seed drafts (content.ts) or reviewed, so the new slug goes live with the 301.
// Order on an existing database: categories-rename.ts → categories-new.ts → content.ts. A fresh database needs none of
// this: seed.ts creates the category under its new slugs.
// --dry-run writes nothing; a non-local database needs --yes; SITE_ENV=production is refused.
// Run: bun run payload run scripts/seed/categories-rename.ts [-- [--dry-run | --yes] [--publish-drafts]]
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { convertMarkdownToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { renamePatch } from '@/lib/content/merge'
import { parseCategory, parseCategoryOverlay } from '@/lib/content/schema'
import type { Config } from '@/payload-types'
import { CATEGORY_RENAMES, SEED_CATEGORIES } from '@/seed/categories'

import { guardTarget, loadOverlay, unwrap } from './i18n'

type Locale = Config['locale']
// The seeded name and intro before the rename (seed/content/categories/ahsap-yapilar.json and its overlays at 8c68da7).
const OLD: Record<string, Record<Locale, { name: string; shortDesc: string }>> = {
  'ahsap-yapilar': {
    tr: { name: 'Ahşap Yapılar', shortDesc: "Ahşap ev, bahçe evi, kulübe ve cephe kaplaması gibi ahşap yapıları Arnavutköy'deki atölyemizde ölçüye göre hazırlayıp yerinde kuruyoruz." },
    en: { name: 'Wooden Structures', shortDesc: 'We build timber houses, garden houses, sheds and timber cladding to measure in our Arnavutköy workshop and assemble them on site.' },
    ru: { name: 'Деревянные конструкции', shortDesc: 'Деревянные дома, садовые домики, хозяйственные постройки и деревянную облицовку фасадов мы изготавливаем по размерам в нашей мастерской в Арнавуткёе и собираем на месте.' },
    de: { name: 'Holzbauten', shortDesc: 'Holzhäuser, Gartenhäuser, Hütten und Fassadenverkleidungen fertigen wir nach Maß in unserer Werkstatt in Arnavutköy und bauen sie vor Ort auf.' },
    ar: { name: 'هياكل خشبية', shortDesc: 'نُعِدّ الهياكل الخشبية، مثل البيوت الخشبية وبيوت الحدائق والأكواخ وتكسيات الواجهات، حسب المقاس في ورشتنا في أرناؤوط كوي، ثم نركّبها في الموقع.' },
  },
}

const dryRun = process.argv.includes('--dry-run')
const publishDrafts = process.argv.includes('--publish-drafts')
const SEED = path.resolve(process.cwd(), 'seed')
guardTarget(dryRun)
const payload = await getPayload({ config: await config })
const editorConfig = await editorConfigFactory.default({ config: payload.config })
const lexical = (markdown: string) => convertMarkdownToLexical({ editorConfig, markdown })
const tag = dryRun ? '[dry run] ' : ''
let writes = 0
const pending: string[] = []
const failed: string[] = []

for (const { key, from, to } of CATEGORY_RENAMES) {
  const cat = SEED_CATEGORIES.find((c) => c.key === key)!
  const content = unwrap(parseCategory(readFileSync(path.join(SEED, `content/categories/${cat.slug.tr}.json`), 'utf8')))
  const target: Record<Locale, { name: string; slug: string; shortDesc: string; body: unknown; faq: { q: string; a: string }[] }> = {
    tr: { name: cat.name.tr, slug: to.tr, ...content.tr, body: lexical(content.tr.body) },
    en: { name: cat.name.en, slug: to.en, ...content.en, body: lexical(content.en.body) },
    ...(Object.fromEntries(
      (['ru', 'de', 'ar'] as const).map((l) => {
        const o = loadOverlay(SEED, l, `content/categories/${cat.slug.tr}.json`, parseCategoryOverlay)
        if (!o) throw new Error(`${l}/content/categories/${cat.slug.tr}.json missing`)
        return [l, { ...o, body: lexical(o.body) }]
      }),
    ) as Record<'ru' | 'de' | 'ar', never>),
  }
  const label = `category ${key} → ${to.tr}`
  const doc = (await payload.find({ collection: 'categories', locale: 'tr', where: { slug: { in: [from.tr, to.tr] } }, limit: 1, depth: 0 })).docs[0]
  if (!doc) {
    console.log(`${label}: not in this database (seed.ts creates it under the new slug)`)
    continue
  }
  try {
    const published = doc._status === 'published'
    if (published && !publishDrafts && (await payload.findByID({ collection: 'categories', id: doc.id, draft: true, depth: 0 }))._status !== 'published') {
      pending.push(label)
      continue
    }
    for (const locale of Object.keys(target) as Locale[]) {
      // The latest version: the one a write builds on (with --publish-drafts, a newer draft over the published one).
      const current = await payload.findByID({ collection: 'categories', id: doc.id, locale, fallbackLocale: false, draft: true, depth: 0 })
      const patch = renamePatch(current as never, { ...OLD[key]![locale], slug: from[locale] }, target[locale])
      if (!Object.keys(patch).length) continue
      console.log(`${tag}${label} [${locale}] ${published ? 'published' : 'draft'}: ${Object.keys(patch).join(', ')}`)
      if (!dryRun)
        await payload.update({
          collection: 'categories',
          id: doc.id,
          locale,
          draft: !published,
          data: (published ? { ...patch, _status: 'published' } : patch) as never,
          context: { skipAi: true },
        })
      writes++
    }
  } catch (err) {
    failed.push(label)
    console.error(`${label}: ${err instanceof Error ? err.message : err}`)
  }
}
console.log(`${tag}categories-rename: ${writes} locale write(s), ${pending.length} skipped (unpublished draft edits), ${failed.length} failed`)
for (const [what, list] of [['unpublished drafts, left as is (see --publish-drafts)', pending], ['failed', failed]] as const) if (list.length) console.log(`${what}: ${list.join(' · ')}`)
process.exit(failed.length ? 1 : 0)
