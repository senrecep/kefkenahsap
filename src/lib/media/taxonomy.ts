// #175: pure rules of the photo-taxonomy loaders (scripts/seed/taxonomy-*.ts, plan in seed/taxonomy/photo-plan.json).

export type Axis = 'type' | 'setting' | 'wood' | 'finish' | 'stage'
export type TagRef = { id: number; axis: string; slug: string; name: string }
type Values = Partial<Record<Axis, string[]>>

const AXES: Axis[] = ['type', 'setting', 'wood', 'finish', 'stage']
// One value per photo on these: a tag already there (seeded or the owner's) is never joined by a second one.
const SINGLE: ReadonlySet<Axis> = new Set(['wood', 'finish', 'stage'])
// Facts and tagImage name stages in English; the tags are Turkish. A finished photo has no stage tag; a workshop photo
// shows the work in progress.
const STAGE_SLUG: Record<string, string | null> = { before: 'oncesi', after: 'sonrasi', process: 'uygulama-asamasi', workshop: 'uygulama-asamasi', detail: 'detay', finished: null }
// Owner decision (2026-10-16): the frequent roof-frame facts get their own type tag.
// The other frequent other:* facts fold into the existing type tags they belong to (no new tags).
const TYPE_ALIAS: Record<string, string> = {
  'other:cati-kirisi': 'cati-iskeleti',
  'other:roof-truss-frame': 'cati-iskeleti',
  'other:lamine-cati': 'cati-iskeleti',
  'other:ahsap-koltuk': 'oturma-grubu',
  'other:yüzer platform': 'deck',
  'other:el-arabasi-ciceklik': 'ciceklik',
}
const norm = (s: string) => s.trim().toLocaleLowerCase('tr')

/**
 * The tag ids to add to a photo: per axis from the vetted facts (tag slugs), or, where the facts have nothing, from the
 * tagImage meta (tag names). Only adds: a tag the photo has stays, and a single-value axis the photo already has is left
 * alone; otherwise it gets only the first of its values that maps to a tag. `unmapped` lists `<axis>:<value>` without a matching tag.
 */
export function tagIdsToAdd(facts: Values, meta: Values | undefined, tags: TagRef[], current: { id: number; axis: string }[]): { add: number[]; unmapped: string[] } {
  const has = new Set(current.map((t) => t.id))
  const add: number[] = []
  const unmapped: string[] = []
  for (const axis of AXES) {
    const values = facts[axis]?.length ? facts[axis] : (meta?.[axis] ?? [])
    if (SINGLE.has(axis) && current.some((t) => t.axis === axis)) continue
    let taken = false
    for (const value of values) {
      const key = axis === 'stage' && Object.hasOwn(STAGE_SLUG, value) ? STAGE_SLUG[value] : axis === 'type' && Object.hasOwn(TYPE_ALIAS, value) ? TYPE_ALIAS[value] : value
      if (key === null) continue
      const tag = tags.find((t) => t.axis === axis && (t.slug === key || norm(t.name) === norm(key!)))
      if (!tag) unmapped.push(`${axis}:${value}`)
      else if (SINGLE.has(axis) && taken) continue
      else if (!has.has(tag.id) && !add.includes(tag.id)) add.push(tag.id)
      if (tag) taken = true
    }
  }
  return { add: add.sort((a, b) => a - b), unmapped }
}

/**
 * Owner decision (2026-10-16): approving a photo attaches the tags its tagImage suggestion names, by the rules of
 * tagIdsToAdd (existing tags only, add-only, single-value axes kept). Returns `current` itself when nothing is added,
 * also for a missing or malformed suggestion or one older than tagImage@2 (no tag names before it).
 */
export function approvalTags(suggestion: unknown, tags: TagRef[], current: number[]): number[] {
  const s = suggestion as { promptVersion?: unknown; tags?: unknown } | null | undefined
  const version = typeof s?.promptVersion === 'string' ? /^tagImage@(\d+)$/.exec(s.promptVersion) : null
  if (!version || Number(version[1]) < 2 || !s?.tags || typeof s.tags !== 'object') return current
  const meta: Values = {}
  for (const axis of AXES) {
    const v = (s.tags as Record<string, unknown>)[axis]
    if (Array.isArray(v) && v.every((x) => typeof x === 'string')) meta[axis] = v
  }
  const axisOf = new Map(tags.map((t) => [t.id, t.axis]))
  const { add } = tagIdsToAdd({}, meta, tags, current.flatMap((id) => (axisOf.has(id) ? [{ id, axis: axisOf.get(id)! }] : [])))
  const fresh = add.filter((id) => !current.includes(id))
  return fresh.length ? [...current, ...fresh] : current
}

/** Owner decision (2026-10-16): every imported photo is published, except one the tagger doubted. */
export const importStatus = (meta: { categoryAgrees: boolean; confidence: number }): 'approved' | 'pending' =>
  !meta.categoryAgrees && meta.confidence <= 0.3 ? 'pending' : 'approved'

/** A planned move happens only from the planned category; anywhere else it is reported, not forced. */
export const moveAction = (current: number | undefined, from: number, to: number): 'move' | 'done' | 'mismatch' =>
  current === to ? 'done' : current === from ? 'move' : 'mismatch'

/** A file is replaced only while it is still exactly the stored file the plan was made from (not replaced since). */
export const remedyDue = (current: { filename?: string | null; filesize?: number | null }, planned: { filename: string; filesize: number }) =>
  current.filename === planned.filename && current.filesize === planned.filesize

/**
 * An unstamped replacement that died between its upload (skipWatermark leaves 'none') and the follow-up write of
 * 'already': the record already holds a file of the source's size. Stamped ones end 'applied' in the upload itself.
 */
export const remedyUnfinished = (current: { watermark?: string | null; width?: number | null; height?: number | null }, source: { width: number; height: number }, stamp: boolean) =>
  !stamp && current.watermark === 'none' && current.width === source.width && current.height === source.height

/** Category cover: a good, landscape photo at least 1280 px wide; live photos first, then the widest, then the lowest id. */
export function pickCover(candidates: { id: number; width: number; height: number; live: boolean; quality?: string }[]): number | undefined {
  return candidates
    .filter((c) => c.quality === 'good' && c.width >= 1280 && c.width > c.height)
    .sort((a, b) => Number(b.live) - Number(a.live) || b.width - a.width || a.id - b.id)[0]?.id
}

// Upload fields that point at media (collections and globals; see `relationTo: 'media'`).
const UPLOAD_KEYS = new Set(['cover', 'gallery', 'image', 'mobileImage', 'slides', 'logo', 'ogImage', 'defaultOgImage'])
const idOf = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'object' && v && typeof (v as { id?: unknown }).id === 'number' ? (v as { id: number }).id : undefined)

/** The media ids a document shows (its upload fields and rich-text upload nodes, at any depth and in every locale). */
export function mediaRefs(doc: unknown, into = new Set<number>()): Set<number> {
  if (Array.isArray(doc)) for (const v of doc) mediaRefs(v, into)
  else if (doc && typeof doc === 'object') {
    // A Lexical upload node: an image placed in rich text.
    const node = doc as { type?: unknown; relationTo?: unknown; value?: unknown }
    if (node.type === 'upload' && node.relationTo === 'media' && idOf(node.value) !== undefined) into.add(idOf(node.value)!)
    for (const [k, v] of Object.entries(doc)) {
      if (UPLOAD_KEYS.has(k)) for (const x of Array.isArray(v) ? v : [v]) if (idOf(x) !== undefined) into.add(idOf(x)!)
      mediaRefs(v, into)
    }
  }
  return into
}

/** Which copy of a same-category duplicate to hide: the planned one, unless a page uses it; never one in use. */
export const duplicateToHide = (hide: { id: number; used: boolean }, keep: { id: number; used: boolean }): number | undefined =>
  !hide.used ? hide.id : !keep.used ? keep.id : undefined
