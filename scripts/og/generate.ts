// #199: the site-wide Open Graph cards → public/og-<locale>.png (committed; rerun only to change them).
// Screenshots scripts/og/og.html at 1200×630 with Playwright's Chromium (the e2e dev dependency), one per routing.locales,
// with the locale's Site.tagline from messages/<locale>/common.json, then palette-quantizes each with sharp to stay
// small enough for WhatsApp/Facebook crawlers. Used by pages while siteSettings.defaultOgImage is empty (siteOgImage).
// Run: bun run og:generate   (first time: bunx playwright install chromium)
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { chromium } from '@playwright/test'
import sharp from 'sharp'

import { localeDir, routing } from '../../src/i18n/routing'

const MAX_BYTES = 300 * 1024
const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '../..')
const template = pathToFileURL(join(here, 'og.html')).href

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
try {
  for (const locale of routing.locales) {
    const messages = JSON.parse(await readFile(join(root, 'messages', locale, 'common.json'), 'utf8')) as { Site: { tagline: string } }
    await page.goto(template)
    await page.evaluate(
      async ({ lang, dir, tagline }) => {
        document.documentElement.lang = lang
        document.documentElement.dir = dir
        document.getElementById('tagline')!.textContent = tagline
        await document.fonts.ready
        await Promise.all(Array.from(document.images, (img) => img.decode()))
      },
      { lang: locale, dir: localeDir(locale), tagline: messages.Site.tagline },
    )
    const png = await sharp(await page.screenshot({ type: 'png' }))
      .png({ palette: true, quality: 80, effort: 10, compressionLevel: 9, dither: 0.5 })
      .toBuffer()
    if (png.length > MAX_BYTES) throw new Error(`og-${locale}.png is ${png.length} bytes (> ${MAX_BYTES})`)
    const out = join(root, 'public', `og-${locale}.png`)
    await writeFile(out, png)
    console.log(`${out} ${Math.round(png.length / 1024)} KB`)
  }
} finally {
  await browser.close()
}
