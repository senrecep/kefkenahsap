// #60: textures for the 3D wood samples → public/wood/*.webp (committed; rerun only to change them).
// Iroko and pine are crops of real library photos (clear of the watermark, rotated so the boards run along the plank).
// No drawn wood (DESIGN.md): teak and thermowood get a texture only once a real close-up photo exists; add a crop here.
// Run: bun scripts/wood-textures.ts   (MEDIA_BASE defaults to the local S3 bucket)
import { mkdir } from 'node:fs/promises'

import sharp from 'sharp'

const base = process.env.MEDIA_BASE ?? 'http://localhost:9000/kefken-media'
const out = 'public/wood'
const W = 384
const H = 192

type Crop = {
  file: string
  region: { left: number; top: number; width: number; height: number }
  angle: number
  w: number
  h: number
}
const crops: Record<string, Crop> = {
  // "Bahçe Girişinde Iroko Deck Zemin" (media 1676), oiled boards above the watermark.
  iroko: {
    file: 'iroko-deck-zemin-bahce-girisi.webp',
    region: { left: 500, top: 560, width: 480, height: 240 },
    angle: 52,
    w: 170,
    h: 85,
  },
  // "Bahçede Emprenyeli Çam Deck Zemin" (media 1307), boards below the watermark.
  cam: {
    file: 'bahce-emprenyeli-cam-deck-zemin.webp',
    region: { left: 360, top: 520, width: 400, height: 200 },
    angle: 6,
    w: 280,
    h: 140,
  },
}

async function crop(c: Crop) {
  const res = await fetch(`${base}/${c.file}`)
  if (!res.ok) throw new Error(`${c.file}: HTTP ${res.status}`)
  const r = await sharp(Buffer.from(await res.arrayBuffer()))
    .extract(c.region)
    .rotate(c.angle)
    .toBuffer({ resolveWithObject: true })
  return sharp(r.data)
    .extract({
      left: Math.round((r.info.width - c.w) / 2),
      top: Math.round((r.info.height - c.h) / 2),
      width: c.w,
      height: c.h,
    })
    .resize(W, H)
}

await mkdir(out, { recursive: true })
await (await crop(crops.iroko!)).webp({ quality: 80 }).toFile(`${out}/iroko.webp`)
await (await crop(crops.cam!)).webp({ quality: 80 }).toFile(`${out}/cam.webp`)
console.log('wrote', out)
