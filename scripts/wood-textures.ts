// #60: textures for the 3D wood samples → public/wood/*.webp (committed; rerun only to change them).
// Iroko and pine are crops of real library photos (clear of the watermark, rotated so the boards run along the plank).
// The library has no teak or thermowood photo, so those two are procedural wood, labelled as such on the page.
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

// Value noise (deterministic hash) for the procedural grain.
const hash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}
const noise = (x: number, y: number) => {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const a = hash(xi, yi) + (hash(xi + 1, yi) - hash(xi, yi)) * u
  const b = hash(xi, yi + 1) + (hash(xi + 1, yi + 1) - hash(xi, yi + 1)) * u
  return a + (b - a) * v
}

/** Flat-sawn grain running along x: wavy growth rings between a light and a dark tone. */
function procedural(
  light: [number, number, number],
  dark: [number, number, number],
  rings: number,
) {
  const px = Buffer.alloc(W * H * 3)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const warp = noise(x / 160, y / 40) * 1.1 + noise(x / 30, y / 8) * 0.12
      const t = (y / H) * rings + warp
      const ring = Math.pow(Math.abs(Math.sin(t * Math.PI)), 12)
      const fleck = noise(x / 4, y / 1.2) * 0.18
      const k = Math.min(1, ring * 0.55 + fleck)
      for (let c = 0; c < 3; c++)
        px[(y * W + x) * 3 + c] = Math.round(light[c]! + (dark[c]! - light[c]!) * k)
    }
  return sharp(px, { raw: { width: W, height: H, channels: 3 } })
}

await mkdir(out, { recursive: true })
await (await crop(crops.iroko!)).webp({ quality: 80 }).toFile(`${out}/iroko.webp`)
await (await crop(crops.cam!)).webp({ quality: 80 }).toFile(`${out}/cam.webp`)
await procedural([176, 128, 72], [112, 76, 40], 16).webp({ quality: 80 }).toFile(`${out}/teak.webp`)
await procedural([122, 84, 58], [72, 46, 30], 18)
  .webp({ quality: 80 })
  .toFile(`${out}/thermowood.webp`)
console.log('wrote', out)
