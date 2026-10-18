import { slugify } from '@/lib/slug'

/** #209: stored media files carry the SEO name, not the upload name. Pure naming rules; the storage work is in renameStored.ts. */

const MAX = 60
const dot = (filename: string) => filename.lastIndexOf('.')
export const stemOf = (filename: string) => (dot(filename) < 0 ? filename : filename.slice(0, dot(filename)))
const extOf = (filename: string) => (dot(filename) < 0 ? '' : filename.slice(dot(filename)))

/**
 * Is the stored file already named after the SEO name (or its `-<n>` collision form, which seed/taxonomy-remedy and
 * pickSeoName produce)? This is also how "renamed once" is known: no flag is stored.
 */
export function isSeoNamed(filename: string | null | undefined, seoFilename: string | null | undefined): boolean {
  const seo = seoFilename?.trim()
  if (!filename || !seo) return false
  const stem = stemOf(filename)
  return stem === seo || (stem.startsWith(`${seo}-`) && /^\d{1,3}$/.test(stem.slice(seo.length + 1)))
}

/**
 * Should a seoRename job rename this document's stored files? Approved (or, forced by the one-off script, hidden), not
 * seeded, never renamed by the job (`seoRenamed`, reset when its file is replaced), and not already SEO-named.
 */
export function needsSeoRename(
  doc: { status?: string | null; filename?: string | null; seoFilename?: string | null; seedKey?: string | null; seoRenamed?: boolean | null },
  { force = false }: { force?: boolean } = {},
): boolean {
  const live = doc.status === 'approved' || (force && doc.status === 'hidden')
  return live && !!doc.filename && !doc.seedKey && !doc.seoRenamed && !isSeoNamed(doc.filename, doc.seoFilename)
}

/** seoFilename, else the TR title slug, else kefken-ahsap-<id>; made unique against `taken` (stems) with -2, -3 … */
export function pickSeoName({ seoFilename, titleTr, id, taken }: { seoFilename?: string | null; titleTr?: string | null; id: number | string; taken: ReadonlySet<string> }): string {
  const slug = (s?: string | null) => {
    const r = s?.trim() ? slugify(s, MAX) : null
    return r?.ok ? r.value : ''
  }
  const base = slug(seoFilename) || slug(titleTr) || `kefken-ahsap-${id}`
  let name = base
  for (let n = 2; taken.has(name); n++) name = `${base}-${n}`
  return name
}

type Files = { filename: string; sizes?: Record<string, { filename?: string | null } | null | undefined> | null }

/**
 * Old → new object names for the original and every size. Payload names a size `<stem>-<W>x<H>.<ext>`, so the stem is
 * swapped; a size sharing the original's file (it would upscale) maps to the same new name and moves once.
 */
export function renamePlan(doc: Files, name: string) {
  const oldStem = stemOf(doc.filename)
  const ext = extOf(doc.filename)
  const to = new Map<string, string>([[doc.filename, `${name}${ext}`]])
  const sizes: Record<string, string> = {}
  for (const [key, size] of Object.entries(doc.sizes ?? {})) {
    const old = size?.filename
    if (!old) continue
    if (!to.has(old)) to.set(old, old.startsWith(`${oldStem}-`) ? `${name}${old.slice(oldStem.length)}` : `${name}-${key}${extOf(old)}`)
    sizes[key] = to.get(old)!
  }
  return { filename: to.get(doc.filename)!, sizes, moves: [...to].map(([from, t]) => ({ from, to: t })) }
}
