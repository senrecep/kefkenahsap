// #187: the homepage hero's first slide list. Fills `slides` of the first hero block ONLY while it is empty (an owner's
// list, even one photo, is left as is), so it is safe to re-run. Runs after editorial.ts (which creates the layout and
// picks the hero image): a homepage without a hero block is skipped with a message.
// Photos are matched by seedKey and must exist and be approved here; a missing one is skipped, not guessed. The order is
// the slide order after the hero image: varied services, alternating warm and cool frames, all landscape ≥2560px wide
// with a single, centred watermark. On desktop the wide frames put it near the headline's first line, under the 0.64
// scrim (white text stays ≥4.5:1); on phones the text sits on Ink below the photo. Picked by eye from the 'good'
// quality review (image-work/review/assignments.jsonl); contact sheet: docs/screens/187-hero-slides-contact.jpg.
// The write keeps every block id and field (Payload merges per-language texts by block). It is published when the latest
// homepage version is. When the latest version is a draft that differs from the published homepage (an owner's pending
// edit, or a stale draft left by tests), it refuses: check the versions in the admin, then re-run with --use-draft to
// add the slides to that draft (saved as a draft, nothing is published).
// --dry-run writes nothing; a non-local database (or SEED_REMOTE=1) needs --yes; SITE_ENV=production is refused.
// Run: bun run payload run scripts/seed/hero-slides.ts [-- --dry-run | --yes | --use-draft]
// The site caches the homepage (unstable_cache) and this CLI process cannot revalidate the running server's cache:
// restart / redeploy the app (or publish the homepage once in the admin) for the slides to show.
import { getPayload } from 'payload'

import config from '@/payload.config'
import { fillHeroSlides } from '@/lib/home/slides'

import { guardTarget } from './i18n'

const HERO_SLIDE_PICKS = [
  'archive/Ireko-Teak/13256.webp', // pergola terrace with seating over the hills (pergola, deck, oturma)
  'archive/Pergola ve Kamelyalar/7829.webp', // seaside pergola and X-railing in low sun (pergola, korkuluk)
  'archive/Ahsap Yapilar/13937.webp', // garden playhouse with a porch (kulübe)
  'archive/Deck ve Zeminler/13932.webp', // hardwood deck wrapping a lavender bed (deck)
  'archive/Merdivenler/2242.webp', // stair and landing by the water (merdiven, korkuluk)
  'archive/Ciceklik ve Oturma Grubu/13863.webp', // hardwood garden sofa set (bahçe mobilyası)
]

const dryRun = process.argv.includes('--dry-run')
const dry = dryRun ? '[dry run] ' : ''

guardTarget(dryRun)
const payload = await getPayload({ config: await config })

const found = await payload.find({ collection: 'media', where: { seedKey: { in: HERO_SLIDE_PICKS } }, limit: HERO_SLIDE_PICKS.length, depth: 0, pagination: false, select: { seedKey: true, status: true } })
const byKey = new Map(found.docs.map((d) => [d.seedKey, d]))
const picks = HERO_SLIDE_PICKS.flatMap((key) => {
  const d = byKey.get(key)
  if (d?.status === 'approved') return [d.id]
  console.log(`${key}: ${d ? `not approved (${d.status})` : 'not in this database'}, skipped`)
  return []
})

const latest = await payload.findGlobal({ slug: 'homepage', locale: 'tr', fallbackLocale: false, draft: true, depth: 0 })
if (latest._status !== 'published' && !process.argv.includes('--use-draft')) {
  const published = await payload.findGlobal({ slug: 'homepage', locale: 'tr', fallbackLocale: false, draft: false, depth: 0 })
  const shape = (l: unknown) => JSON.stringify(l ?? [])
  if (shape(latest.layout) !== shape(published.layout)) {
    console.error(`${dry}hero slides: the latest homepage version is a draft that differs from the published one (blocks: ${(latest.layout ?? []).map((b) => b.blockType).join(', ') || 'none'}). Check the versions in the admin; re-run with --use-draft to add the slides to that draft. Nothing written.`)
    process.exit(1)
  }
}
type Layout = Parameters<typeof fillHeroSlides>[0]
const next = fillHeroSlides((latest.layout ?? []) as unknown as Layout, picks)
if (!next.filled) {
  const hero = latest.layout?.find((b) => b.blockType === 'hero')
  console.log(`${dry}hero slides: ${!hero ? 'no hero block (run editorial.ts first)' : hero.slides?.length ? 'already set, left as is' : 'no approved pick'}; nothing written`)
  process.exit(0)
}
const publish = latest._status === 'published'
const ids = (next.layout.find((b) => b.blockType === 'hero')!.slides as number[]).join(', ')
console.log(`${dry}hero slides: ${ids}${publish ? ' (published)' : ' (as a draft: the homepage has unpublished changes)'}; restart or redeploy the app to show them`)
if (!dryRun) await payload.updateGlobal({ slug: 'homepage', locale: 'tr', draft: !publish, data: { layout: next.layout as never, _status: publish ? 'published' : 'draft' }, depth: 0 })
process.exit(0)
