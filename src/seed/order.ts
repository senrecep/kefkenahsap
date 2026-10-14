const TR_FOLD: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' }

/** Name-independent key for an image file: lowercase ASCII, no extension, no WP "-WxH" size suffix or ".jpg1_" quirk. */
export function fileKey(name: string): string {
  return name
    .normalize('NFC')
    .toLowerCase()
    .replace(/\.(webp|jpe?g|png|gif)$/, '')
    .replace(/\.(jpe?g|png)1_$/, '')
    .replace(/-\d+x\d+$/, '')
    .replace(/[çğıöşü]/g, (c) => TR_FOLD[c] ?? c)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
}

/** Gallery order for a category: the live WordPress page order first, then photos that only exist locally (sorted). */
export function orderForCategory(liveFiles: string[], localFiles: string[]): string[] {
  const byKey = new Map(localFiles.map((f) => [fileKey(f), f]))
  const out: string[] = []
  const used = new Set<string>()
  for (const live of liveFiles) {
    const f = byKey.get(fileKey(live))
    if (f && !used.has(f)) {
      out.push(f)
      used.add(f)
    }
  }
  return [...out, ...localFiles.filter((f) => !used.has(f)).sort()]
}

type Upload = { w: number; h: number; page?: string }
const sameShape = (a: { w: number; h: number }, b: { w: number; h: number }) => Math.abs(a.w / a.h - b.w / b.h) <= 0.02 * (b.w / b.h)
const sameSize = (a: Upload, b: Upload) => a.w === b.w && a.h === b.h

/**
 * The WP uploads (same file key) that really are this local photo. Generic names like "20.jpg" repeat across months
 * with different content, so a wrong guess would 301 old links to the wrong image — ambiguous cases return [] (410).
 */
export function uploadsForPhoto<T extends Upload>(
  candidates: T[],
  local: { w: number; h: number; category: string },
  seededCategories: Set<string>,
): T[] {
  const usable = candidates.filter((c) => !(c.page && c.page !== local.category && seededCategories.has(c.page)) && sameShape(c, local))
  const own = usable.filter((c) => c.page === local.category)
  if (own.length) return usable.filter((c) => own.includes(c) || (!c.page && own.some((o) => sameSize(o, c))))
  const loose = usable.filter((c) => !c.page || !seededCategories.has(c.page))
  return loose.length && loose.every((c) => sameSize(c, loose[0]!)) ? loose : []
}
