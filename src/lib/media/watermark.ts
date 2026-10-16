import sharp from 'sharp'

import { WATERMARK_GLYPHS as G } from './watermark-glyphs'

// Port of kefken-ahsap-image-pipeline/scripts/24_watermark.py (#169): same sizing, contrast and softening, drawn with the
// site's Montserrat (baked to a path, so no font is needed on the server) instead of Windows Arial.
const TARGET_SIZE_FRAC = 0.34 // text width as a fraction of √(w·h)
const MAX_HEIGHT_FRAC = 0.06 // text height never exceeds this fraction of the image height
const MIN_FONT_PX = 14

/** Formats that are stamped; GIF/SVG and anything else pass through untouched. */
export const WATERMARK_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/tiff']

const strokeOf = (size: number) => Math.max(1, Math.floor(size / 22))

/** Pillow's textbbox for the text with its stroke: advance width × ink height, each side snapped outward to whole pixels. */
function textBox(size: number) {
  const s = size / G.unitsPerEm
  const stroke = strokeOf(size)
  return {
    width: Math.round(G.advance * s) + 2 * stroke,
    height: Math.ceil(G.ink.y1 * s) - Math.floor(G.ink.y0 * s) + 2 * stroke,
  }
}

/** fit_font_size: the largest size whose text box fits 0.34·√(w·h) wide and 6% of the height tall, never under 14 px. */
export function fitFontSize(width: number, height: number): number {
  const targetWidth = Math.sqrt(width * height) * TARGET_SIZE_FRAC
  const maxHeight = height * MAX_HEIGHT_FRAC
  let [lo, hi, best] = [6, 800, 6]
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    const box = textBox(mid)
    if (box.width <= targetWidth && box.height <= maxHeight) [best, lo] = [mid, mid + 1]
    else hi = mid - 1
  }
  return Math.max(best, MIN_FONT_PX)
}

export function watermarkLayout(width: number, height: number) {
  const fontSize = fitFontSize(width, height)
  const box = textBox(fontSize)
  return { fontSize, stroke: strokeOf(fontSize), blur: Math.max(1, Math.floor(fontSize / 90)), textWidth: box.width, textHeight: box.height }
}

/** Alpha (0–255) of the white fill and the black outline from the mean luma behind the text. */
export function watermarkAlphas(luma: number): { fill: number; outline: number } {
  if (luma < 110) return { fill: 110, outline: 50 } // dark: white reads on its own
  if (luma > 170) return { fill: 75, outline: 100 } // bright: lean on the dark outline
  return { fill: 95, outline: 75 }
}

/** Mean Rec.601 luma (Pillow's "L") of a box of raw pixels. */
function meanLuma(data: Buffer, info: { width: number; height: number; channels: number }, box: { x0: number; y0: number; x1: number; y1: number }) {
  let sum = 0
  for (let y = box.y0; y < box.y1; y++) {
    for (let x = box.x0; x < box.x1; x++) {
      const i = (y * info.width + x) * info.channels
      sum += info.channels < 3 ? data[i]! : (data[i]! * 299 + data[i + 1]! * 587 + data[i + 2]! * 114) / 1000
    }
  }
  return sum / Math.max(1, (box.x1 - box.x0) * (box.y1 - box.y0))
}

function overlaySvg(width: number, height: number, luma: number) {
  const { fontSize, stroke, blur } = watermarkLayout(width, height)
  const { fill, outline } = watermarkAlphas(luma)
  const s = fontSize / G.unitsPerEm
  // anchor "mm": horizontal middle of the advance, vertical middle between ascender and descender, at (w//2, h//2).
  const x = Math.floor(width / 2) - (G.advance * s) / 2
  const y = Math.floor(height / 2) + ((G.ascender + G.descender) / 2) * s
  const strokeWidth = (2 * stroke) / s // centred on the outline, so twice Pillow's outward stroke
  // Pillow paints the fill over the stroke without blending; the mask keeps the outline outside the glyphs to match.
  // The mask sits on an untransformed group: on the scaled path its content would be scaled twice.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
<defs>
<filter id="b" x="-5%" y="-50%" width="110%" height="200%"><feGaussianBlur stdDeviation="${blur}"/></filter>
<mask id="o" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#fff"/><path transform="translate(${x} ${y}) scale(${s})" d="${G.d}" fill="#000"/></mask>
</defs>
<g filter="url(#b)">
<g mask="url(#o)"><path transform="translate(${x} ${y}) scale(${s})" d="${G.d}" fill="none" stroke="#000" stroke-opacity="${outline / 255}" stroke-width="${strokeWidth}" stroke-linejoin="round"/></g>
<path transform="translate(${x} ${y}) scale(${s})" d="${G.d}" fill="#fff" fill-opacity="${fill / 255}"/>
</g>
</svg>`
}

/**
 * Stamps "kefkenahsap.com" in the centre and re-encodes in the input's format at high quality (Payload converts it to
 * WebP afterwards). EXIF orientation is applied first, so the mark is upright in the stored image.
 */
export async function applyWatermark(input: Buffer, mimetype: string): Promise<Buffer> {
  const { data, info } = await sharp(input).rotate().raw().toBuffer({ resolveWithObject: true })
  const { textWidth, textHeight } = watermarkLayout(info.width, info.height)
  const [cx, cy] = [Math.floor(info.width / 2), Math.floor(info.height / 2)]
  const [hw, hh] = [Math.floor(textWidth / 2) + 10, Math.floor(textHeight / 2) + 10]
  const luma = meanLuma(data, info, { x0: Math.max(0, cx - hw), y0: Math.max(0, cy - hh), x1: Math.min(info.width, cx + hw), y1: Math.min(info.height, cy + hh) })

  const out = sharp(data, { raw: info }).composite([{ input: Buffer.from(overlaySvg(info.width, info.height, luma)) }])
  const format = mimetype.split('/')[1] as 'jpeg' | 'png' | 'webp' | 'avif' | 'tiff'
  return (format === 'png' ? out.png() : out.toFormat(format, { quality: 95 })).toBuffer()
}
