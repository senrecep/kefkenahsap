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
