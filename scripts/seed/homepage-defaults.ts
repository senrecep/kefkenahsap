// #213: copies the site's built-in homepage text (messages/<locale>/home.json) into the admin fields that are still empty,
// so the Ana Sayfa global shows what the site shows. Never overwrites a value; a re-run writes nothing.
//   bun run payload run scripts/seed/homepage-defaults.ts -- --dry-run | --yes [--use-draft]
import { getPayload } from 'payload'

import { routing } from '@/i18n/routing'
import { effectiveHomeText, fillHomeDefaults, type HomeBlock, type HomeMessages } from '@/lib/home/defaults'
import config from '@/payload.config'

import { guardTarget } from './i18n'

const dryRun = process.argv.includes('--dry-run')
const dry = dryRun ? '[dry run] ' : ''

const messages = Object.fromEntries(
  await Promise.all(routing.locales.map(async (l) => [l, ((await import(`../../messages/${l}/home.json`)) as { default: { Home: HomeMessages } }).default.Home] as const)),
)

guardTarget(dryRun)
const payload = await getPayload({ config: await config })

const read = async (locale: string, draft: boolean) => {
  const g = await payload.findGlobal({ slug: 'homepage', locale: locale as never, fallbackLocale: false, draft, depth: 0 })
  return { status: g._status, layout: (g.layout ?? []) as unknown as HomeBlock[] }
}
const latest = await read(routing.defaultLocale, true)
const publish = latest.status === 'published'
if (!publish && !process.argv.includes('--use-draft')) {
  for (const locale of routing.locales) {
    if (JSON.stringify((await read(locale, true)).layout) !== JSON.stringify((await read(locale, false)).layout)) {
      console.error(`${dry}homepage: the latest version is a draft that differs from the published one. Publishing would release the owner's unpublished edits. Check the versions in the admin; re-run with --use-draft to fill that draft instead. Nothing written.`)
      process.exit(1)
    }
  }
}
if (!latest.layout.length) {
  console.log(`${dry}homepage: no sections yet (run editorial.ts first); nothing written`)
  process.exit(0)
}

// The block rows are shared and Payload merges a per-locale write into the other locales by row position, so every write
// sends the same rows in the same order; the read-back below proves no locale moved.
const planned = new Map<string, HomeBlock[]>()
let fields = 0
for (const locale of routing.locales) {
  const before = (await read(locale, true)).layout
  const { layout, filled } = fillHomeDefaults(before, messages[locale])
  const same = JSON.stringify(effectiveHomeText(layout, messages[locale])) === JSON.stringify(effectiveHomeText(before, messages[locale]))
  console.log(`${dry}[${locale}] ${filled.join(', ') || 'nothing to fill'} · site text unchanged: ${same}`)
  if (!same) process.exit(1)
  fields += filled.length
  planned.set(locale, layout)
}
if (!fields || dryRun) process.exit(0)

const untouched = new Map<string, string>()
for (const locale of routing.locales) untouched.set(locale, JSON.stringify((await read(locale, true)).layout))
for (const [locale, layout] of planned) {
  if (JSON.stringify(layout) === untouched.get(locale)) continue
  // beforeOperation drops publishSpecificLocale, so a published write publishes every locale.
  await payload.updateGlobal({ slug: 'homepage', locale: locale as never, draft: !publish, data: { layout: layout as never, _status: publish ? 'published' : 'draft' }, depth: 0 })
}
// Read back: every locale must equal its plan, block ids included; only the step/item row ids are new.
const shape = (l: HomeBlock[]) => JSON.stringify([l.map((b) => b.id), JSON.stringify(l, (k, v) => (k === 'id' ? undefined : v))])
const bad = []
for (const [locale, layout] of planned) if (shape((await read(locale, !publish)).layout) !== shape(layout)) bad.push(locale)
if (bad.length) {
  console.error(`homepage: read-back differs from the plan for ${bad.join(', ')}; check the versions in the admin`)
  process.exit(1)
}
console.log(`homepage: ${fields} fields filled${publish ? ' and published' : ' as a draft'}; restart or redeploy the app to show it right away`)
process.exit(0)
