// #27: admin PWA icons from public/brand/icon-512.png. Run: bun scripts/brand/make-pwa-icons.ts (PNGs are committed).
import sharp from 'sharp'

const paper = '#fbfaf7' // --color-paper
const src = 'public/brand/icon-512.png'

// Opaque square on paper; `inset` shrinks the leaf so a maskable icon keeps it inside the 80% safe zone.
const make = async (size: number, inset: number, out: string) => {
  const inner = Math.round(size * (1 - inset * 2))
  const leaf = await sharp(src).resize(inner, inner, { fit: 'contain', background: '#0000' }).toBuffer()
  await sharp({ create: { width: size, height: size, channels: 3, background: paper } })
    .composite([{ input: leaf, gravity: 'center' }])
    .png()
    .toFile(out)
}

await make(192, 0.1, 'public/brand/pwa-192.png')
await make(512, 0.1, 'public/brand/pwa-512.png')
await make(512, 0.2, 'public/brand/pwa-maskable-512.png')
await make(180, 0.1, 'public/brand/apple-touch-icon.png')
