// #33 shared I/O for the cluster scripts: load embeddings + dates, and draw contact sheets.
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

import { dayFromFilename, transferDays, type ClusterOptions, type ClusterPhoto } from '@/lib/clusters/cluster'
import { SEED_CATEGORIES } from '@/seed/categories'
import { orderForCategory } from '@/seed/order'

export const ROOT = process.cwd()
export const DATA = process.env.KEFKEN_DATA ?? path.resolve(ROOT, '../../kefken-data/Webiste')
export const CLUSTERS_JSON = path.resolve(ROOT, 'seed/clusters/clusters.json')

// Tuned by looking at the contact sheets (docs/clusters/REPORT.md); ViT-B-32 cosines of unrelated wood photos sit ~0.6–0.8.
export const OPTIONS: ClusterOptions = { threshold: 0.82, sameDayBonus: 0.1, maxGapDays: 30, minSize: 3, maxSize: 24 }

export type ReviewedCluster = { key: string; title: string; category: string; seedKeys: string[]; from?: string; to?: string }

/** All photos in seed (live-page) order per category, with EXIF day, else the file-name day. */
export function loadPhotos(): (ClusterPhoto & { folder: string; file: string })[] {
  const emb = JSON.parse(readFileSync(path.resolve(ROOT, 'seed/clusters/embeddings.json'), 'utf8')) as {
    photos: { folder: string; file: string; exif: string | null; v: number[] }[]
  }
  const live = JSON.parse(readFileSync(path.resolve(ROOT, 'docs/legacy/live-site-images-ordered.json'), 'utf8')) as Record<string, string[]>
  const byPath = new Map(emb.photos.map((p) => [`${p.folder}/${p.file}`, p]))
  const photos = SEED_CATEGORIES.flatMap((cat) => {
    const local = readdirSync(path.join(DATA, cat.folder)).filter((f) => /\.(webp|jpe?g|png)$/i.test(f))
    return orderForCategory(live[cat.folder] ?? [], local).map((file) => {
      const e = byPath.get(`${cat.folder}/${file}`)
      if (!e) throw new Error(`no embedding for ${cat.folder}/${file} (run scripts/clusters/embed.py)`)
      return { key: `${cat.slug.tr}/${file}`, category: cat.slug.tr, v: e.v, exif: e.exif, nameDay: dayFromFilename(file), folder: cat.folder, file }
    })
  })
  // EXIF wins; a file-name day counts only when it isn't a bulk WhatsApp transfer day.
  const transfers = transferDays(photos.flatMap((p) => (p.nameDay ? [{ category: p.category, day: p.nameDay }] : [])))
  return photos.map(({ exif, nameDay, ...p }) => ({ ...p, day: exif ?? (nameDay && !transfers.has(nameDay) ? nameDay : undefined) }))
}

/** Numbered thumbnail grid (≤ 200 KB): 6 columns of 160 px squares. */
export async function contactSheet(files: string[], out: string): Promise<number> {
  const S = 160
  const cols = Math.min(6, files.length)
  const rows = Math.ceil(files.length / cols)
  const tiles = await Promise.all(
    files.map(async (f, i) => {
      const label = Buffer.from(
        `<svg width="${S}" height="${S}"><rect width="28" height="20" fill="#000" opacity=".7"/><text x="4" y="15" font-size="14" font-family="sans-serif" fill="#fff">${i + 1}</text></svg>`,
      )
      const input = await sharp(f).resize(S, S, { fit: 'cover' }).composite([{ input: label, top: 0, left: 0 }]).toBuffer()
      return { input, left: (i % cols) * S, top: Math.floor(i / cols) * S }
    }),
  )
  const info = await sharp({ create: { width: cols * S, height: rows * S, channels: 3, background: '#fff' } })
    .composite(tiles)
    .webp({ quality: 70 })
    .toFile(out)
  if (info.size > 200_000) throw new Error(`${out} is ${info.size} bytes (> 200 KB)`)
  return info.size
}
