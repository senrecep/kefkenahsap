/** Old WordPress page path → its slug ('' for the home page). */
export function pageKey(pathname: string): string {
  return decode(pathname).replace(/^\/+|\/+$/g, '')
}

const UPLOADS = /^\/wp-content\/uploads\/\d{4}\/\d{2}\/(.+)$/

/**
 * WordPress upload URL → lookup key of the original file:
 * decoded, NFC, lowercased (ASCII rules — not Turkish, so "IMG" stays "img"),
 * without extension, "-WxH" size suffix or the ".jpg1_" scrape quirk.
 */
export function mediaKey(pathname: string): string | null {
  const m = UPLOADS.exec(decode(pathname))
  if (!m) return null
  return m[1]
    .replace(/\.[a-z0-9]+$/i, '') // extension
    .replace(/-\d+x\d+$/, '') // WP size variant
    .replace(/\.(jpe?g|png)1_$/i, '') // "IMG_x.jpg1_" quirk
    .toLowerCase()
}

function decode(p: string): string {
  try {
    return decodeURIComponent(p).normalize('NFC')
  } catch {
    return p.normalize('NFC') // malformed %-sequence: keep raw
  }
}
