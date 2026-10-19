// The photo sitemaps read approved gallery photos with one SQL query (the Payload find took ~5 s cold on 3,300 photos).
// Oracle: what the Payload find + afterRead hooks give for the same photos (CDN URLs from the storage plugin).
import { getPayload, type Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, expect, it } from 'vitest'

import { loadSitemapPhotoDocs } from '@/lib/data/seo'
import { responsiveImage } from '@/lib/media/image'
import config from '@/payload.config'

let payload: Payload
const stamp = Date.now()
const ids: number[] = []
const name = (k: string) => `int-sitemap-${k}-${stamp}`

async function photo(k: string, status: 'approved' | 'pending', titles: Record<string, string>, width: number) {
  const data = await sharp({ create: { width, height: Math.round(width * 0.6), channels: 3, background: { r: 90, g: 80, b: 60 } } }).webp().toBuffer()
  const doc = await payload.create({
    collection: 'media',
    locale: 'tr',
    data: { seoFilename: name(k), title: titles.tr, alt: `Alt ${k}`, status },
    file: { data, mimetype: 'image/webp', name: `${name(k)}.webp`, size: data.length },
    context: { skipAi: true },
  })
  ids.push(doc.id)
  for (const [locale, title] of Object.entries(titles)) if (locale !== 'tr') await payload.update({ collection: 'media', id: doc.id, locale: locale as 'en', data: { title }, context: { skipAi: true } })
  return doc.id
}

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  await photo('both', 'approved', { tr: 'İki dilli foto', en: 'Two-language photo' }, 1600)
  // Smaller than 960: no size reaches 960, so the largest one (sizes are never enlarged: kept at 700×420).
  await photo('tr', 'approved', { tr: 'Yalnız Türkçe' }, 700)
  await photo('pending', 'pending', { tr: 'Bekleyen' }, 1600)
})
afterAll(async () => {
  for (const id of ids) await payload.delete({ collection: 'media', id }).catch(() => {})
})

it('lists approved photos only, each live locale with its path, the image src and lastmod the Payload read gives', async () => {
  const docs = (await loadSitemapPhotoDocs(payload)).filter((d) => d.paths.tr?.includes(`-${stamp}`))
  const read = await payload.find({ collection: 'media', where: { id: { in: ids } }, depth: 0, pagination: false })
  const byName = (k: string) => read.docs.find((d) => d.seoFilename === name(k))!
  const none = { ru: null, de: null, ar: null }

  expect(docs).toHaveLength(2)
  expect(docs.find((d) => d.paths.tr === `/tr/galeri/${name('both')}`)).toEqual({
    paths: { tr: `/tr/galeri/${name('both')}`, en: `/en/gallery/${name('both')}`, ...none },
    lastModified: byName('both').updatedAt,
    images: [responsiveImage(byName('both')).src],
  })
  expect(docs.find((d) => d.paths.tr === `/tr/galeri/${name('tr')}`)).toEqual({
    paths: { tr: `/tr/galeri/${name('tr')}`, en: null, ...none },
    lastModified: byName('tr').updatedAt,
    images: [responsiveImage(byName('tr')).src],
  })
  // Independent of responsiveImage: the 960 size of the large photo, the full-width size of the small one, on the CDN.
  expect(docs.flatMap((d) => d.images)).toEqual(expect.arrayContaining([`${process.env.MEDIA_PUBLIC_URL}/${name('both')}-960x576.webp`, `${process.env.MEDIA_PUBLIC_URL}/${name('tr')}-700x420.webp`]))
})
