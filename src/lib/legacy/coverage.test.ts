// Every URL the old WordPress site exposed (16 pages, 1169 originals + all size variants, attachment pages)
// gets a definite answer in one hop: 301 or 410 — never "pass" (which would 404). PLAN §5.2 / #32.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import attachments from './attachment-map.json'
import media from './media-map.json'
import attachmentPathList from './wp-attachment-paths.json'
import { resolveLegacy } from './resolve'

const root = path.resolve(__dirname, '../../..')
const wpMedia = JSON.parse(readFileSync(path.join(root, 'docs/legacy/wp-media.json'), 'utf8')) as {
  source_url: string
  link: string
  sizes: Record<string, string>
}[]
const wpPages = JSON.parse(readFileSync(path.join(root, 'docs/legacy/wp-pages.json'), 'utf8')) as { link: string }[]
const CDN = 'https://cdn.kefkenahsap.com'
const resolve = (u: string) => {
  const url = new URL(u)
  return resolveLegacy(url.pathname, url.search, { media, attachments, attachmentPaths: new Set(attachmentPathList) }, CDN)
}

describe('legacy coverage (real WordPress inventory)', () => {
  const mediaUrls = wpMedia.flatMap((m) => [m.source_url, ...Object.values(m.sizes)])

  it('answers every media URL with 301 to the CDN or 410', () => {
    const results = mediaUrls.map(resolve)
    expect(results.filter((r) => r.kind === 'pass')).toHaveLength(0)
    for (const r of results) if (r.kind === 'redirect') expect(r.location.startsWith(`${CDN}/`)).toBe(true)
    const redirected = new Set(wpMedia.filter((m) => resolve(m.source_url).kind === 'redirect').map((m) => m.source_url))
    // 560 of 1169 originals are provably a seeded photo (same name + shape); the rest are 410 by decision #56.
    expect(redirected.size).toBeGreaterThanOrEqual(550)
    console.info(`[legacy] media URLs: ${mediaUrls.length}, originals redirected: ${redirected.size}/${wpMedia.length}`)
  }, 30_000) // ~17k URLs; shared CI runners are slow

  it('sends every old page to its /tr page', () => {
    for (const p of wpPages) {
      const r = resolve(p.link)
      expect(r.kind === 'redirect' || new URL(p.link).pathname === '/').toBe(true)
      if (r.kind === 'redirect') expect(r.location).toMatch(/^\/tr(\/|$)/)
    }
  })

  it('answers every attachment page with 301 to an image page or 410', () => {
    const results = wpMedia.map((m) => resolve(m.link))
    expect(results.filter((r) => r.kind === 'pass')).toHaveLength(0)
    for (const r of results) if (r.kind === 'redirect') expect(r.location).toMatch(/^\/tr\/galeri\/[a-z0-9-]+$/)
  })
})
