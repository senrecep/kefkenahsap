import { expect, test } from '@playwright/test'

// #211: an image's `sizes` must say the width it really renders at, or the browser picks a bigger srcset candidate
// than it needs. Measured on a phone viewport (Lighthouse's mobile profile), where every byte counts.
test.use({ viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true })

const PAGES = ['/tr', '/tr/galeri', '/tr/projeler']

for (const path of PAGES) {
  test(`sizes matches the rendered width on a phone: ${path}`, async ({ page }) => {
    await page.goto(path)
    const rows = await page.$$eval('img[sizes]', (imgs: HTMLImageElement[]) =>
      imgs
        .filter((img) => img.offsetWidth > 0)
        .map((img) => {
          // The first entry whose media condition matches (or the bare default), resolved to CSS px like the browser does.
          const entry = img.sizes
            .split(/,(?![^(]*\))/)
            .map((s) => s.trim())
            .find((s) => {
              const m = /^(\(.*\))\s+(.+)$/.exec(s)
              return !m || matchMedia(m[1]!).matches
            })!
          const probe = document.createElement('div')
          probe.style.width = entry.replace(/^\(.*\)\s+/, '')
          document.body.append(probe)
          const said = probe.getBoundingClientRect().width
          probe.remove()
          // offsetWidth: the layout width, without the hero's settle/drift scale transform.
          return { src: img.currentSrc || img.src, rendered: img.offsetWidth, said }
        }),
    )
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) {
      // Never smaller than rendered (blur), at most a few px over (rounding, scrollbar-free 100vw).
      expect(r.said, r.src).toBeGreaterThanOrEqual(r.rendered - 2)
      expect(r.said, r.src).toBeLessThanOrEqual(r.rendered + 4)
    }
  })
}
