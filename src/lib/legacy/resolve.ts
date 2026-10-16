import { CATEGORY_RENAMES } from '@/seed/categories'
import { fileKey } from '@/seed/order'

export type LegacyTarget = { file: string; category: string }
export type LegacyMaps = {
  /** "YYYY/MM/<fileKey>" of the WP original → seeded file */
  media: Record<string, LegacyTarget>
  /** WP attachment page pathname → seeded file */
  attachments: Record<string, LegacyTarget>
  /** Every attachment page the old site had ("/…/" form); unmapped ones answer 410 */
  attachmentPaths: ReadonlySet<string>
}
export type LegacyResult = { kind: 'redirect'; status: 301; location: string } | { kind: 'gone' } | { kind: 'pass' }

// Old WordPress pages → new TR paths (TR slugs were kept on purpose). A renamed category's WP page goes to its new TR
// path; until categories-rename.ts has run, the category page sends that on to the old slug still live (#172).
const PAGES: Record<string, string> = {
  ...Object.fromEntries(CATEGORY_RENAMES.map(({ key, to }) => [key, `/tr/${to.tr}`])),
  'kefken-ahsap-dekorasyon': '/tr',
  'boya-tamir-ve-bakim': '/tr/boya-tamir-ve-bakim',
  'ciceklik-ve-oturma-grubu': '/tr/ciceklik-ve-oturma-grubu',
  'deck-ve-zeminler': '/tr/deck-ve-zeminler',
  'ireko-teak': '/tr/ireko-teak',
  'kapi-dolap-ve-seperator': '/tr/kapi-dolap-ve-seperator',
  'kopru-ve-iskele': '/tr/kopru-ve-iskele',
  'korkuluk-ve-cit': '/tr/korkuluk-ve-cit',
  merdivenler: '/tr/merdivenler',
  'mobilya-ve-cila': '/tr/mobilya-ve-cila',
  'pergola-ve-kamelyalar': '/tr/pergola-ve-kamelyalar',
  hakkimizda: '/tr/hakkimizda',
  hizmetlerimiz: '/tr/hizmetlerimiz',
  iletisim: '/tr/iletisim',
  referanslar: '/tr/referanslar',
}
const GONE = /^\/(wp-admin|wp-includes|wp-json|wp-content\/(?!uploads\/)|category|author|tag|comments)(\/|$)|^\/(wp-login|xmlrpc|wp-cron)\.php$/
const UPLOAD = /^\/wp-content\/uploads\/(\d{4})\/(\d{2})\/([^/]+)$/
const UPLOADS_ANY = /^\/wp-content\/uploads\//

const decode = (p: string) => {
  try {
    return decodeURIComponent(p).normalize('NFC')
  } catch {
    return p.normalize('NFC')
  }
}
const redirect = (location: string): LegacyResult => ({ kind: 'redirect', status: 301, location })

/** One-hop decision for any URL of the old WordPress site (PLAN §5.2). Pure: maps and CDN base are passed in. */
export function resolveLegacy(pathname: string, search: string, maps: LegacyMaps, mediaBase: string): LegacyResult {
  const path = decode(pathname)

  const upload = UPLOAD.exec(path)
  if (upload) {
    const hit = maps.media[`${upload[1]}/${upload[2]}/${fileKey(upload[3]!)}`]
    return hit ? redirect(`${mediaBase}/${hit.file}`) : { kind: 'gone' }
  }
  // Theme/plugin assets (e.g. uploads/revslider/…) and other retired WP paths.
  if (UPLOADS_ANY.test(path) || GONE.test(path)) return { kind: 'gone' }

  if (path === '/' || path === '') {
    const s = new URLSearchParams(search).get('s')
    return s ? redirect(`/tr/ara?q=${encodeURIComponent(s)}`) : { kind: 'pass' }
  }
  if (/^\/feed\/?$/i.test(path)) return redirect('/tr')

  // WordPress matched slugs case-insensitively (/Deck-ve-Zeminler/ worked), so we do too.
  const trimmed = path.replace(/^\/+|\/+$/g, '').toLowerCase()
  if (PAGES[trimmed]) return redirect(PAGES[trimmed] + search)
  const withSlash = `/${trimmed}/`
  const hit = maps.attachments[withSlash]
  if (hit) return redirect(`/tr/galeri/${hit.file.replace(/\.[a-z0-9]+$/i, '')}`)
  if (maps.attachmentPaths.has(withSlash)) return { kind: 'gone' }
  return { kind: 'pass' }
}
