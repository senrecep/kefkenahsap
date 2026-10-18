// #60/#146: textures for the 3D wood samples → public/wood/*.webp (committed; rerun only to change them).
// Each is ONE real board from a library photo (no deck gaps, clear of the watermark), levelled so the grain runs along
// the plank, at the sharpest crop the photo holds: the plank is board-shaped (8:1), so the 1024×128 texture maps 1:1.
// No drawn wood (DESIGN.md): teak and thermowood get a texture only once a real close-up photo exists; add a crop here,
// and its media id / gallery slug in src/lib/wood/samples.ts.
// Run: bun scripts/wood-textures.ts   (MEDIA_BASE defaults to the local S3 bucket)
import { mkdir } from 'node:fs/promises'

import sharp from 'sharp'

const base = process.env.MEDIA_BASE ?? 'http://localhost:9000/kefken-media'
const out = 'public/wood'
const W = 1024
const H = 128

type Crop = { file: string; angle: number; region: { left: number; top: number; width: number; height: number } }
const crops: Record<string, Crop> = {
  // #156: media "İroko deck zemin, ahşap dolap kapağı" (1204×1600): the top rail of the oiled iroko cabinet frame, shot
  // face-on and level, between its two mitres and clear of the watermark: 570×60 px of sharp interlocked grain (the
  // earlier deck side board was ≈20 px tall, stretched into a flat orange slab). Never recoloured.
  iroko: { file: 'iroko-deck-zemin-ahsap-dolap-kapagi.webp', angle: 0, region: { left: 290, top: 258, width: 570, height: 60 } },
  // Media 1307 "Bahçede emprenyeli çam deck zemin" (960×960): the front fascia board, levelled (-24.5°).
  cam: { file: 'bahce-emprenyeli-cam-deck-zemin.webp', angle: -24.5, region: { left: 250, top: 863, width: 800, height: 34 } },
}

async function crop(c: Crop) {
  const res = await fetch(`${base}/${c.file}`)
  if (!res.ok) throw new Error(`${c.file}: HTTP ${res.status}`)
  const levelled = await sharp(Buffer.from(await res.arrayBuffer())).rotate(c.angle).toBuffer()
  return sharp(levelled).extract(c.region).resize(W, H, { fit: 'fill', kernel: 'lanczos3' })
}

await mkdir(out, { recursive: true })
for (const [key, c] of Object.entries(crops)) await (await crop(c)).webp({ quality: 86 }).toFile(`${out}/${key}.webp`)
console.log('wrote', out)
