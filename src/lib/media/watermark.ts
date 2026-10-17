import sharp from 'sharp'

import { WATERMARK_GLYPHS as G } from './watermark-glyphs'

// Port of kefken-ahsap-image-pipeline/scripts/24_watermark.py (#169): same sizing, contrast and softening, drawn with the
// site's Montserrat (baked to a path, so no font is needed on the server) instead of Windows Arial.
const TARGET_SIZE_FRAC = 0.34 // text width as a fraction of √(w·h)
const MAX_HEIGHT_FRAC = 0.06 // text height never exceeds this fraction of the image height
const MIN_FONT_PX = 14

/** Formats that are stamped; GIF/SVG and anything else pass through untouched. */
const WATERMARK_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/tiff']

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

type Box = { left: number; top: number; width: number; height: number }

/** Clips a box to the image; null when nothing of it is inside. */
function clip(b: { x0: number; y0: number; x1: number; y1: number }, width: number, height: number): Box | null {
  const [x0, y0] = [Math.max(0, Math.floor(b.x0)), Math.max(0, Math.floor(b.y0))]
  const [x1, y1] = [Math.min(width, Math.ceil(b.x1)), Math.min(height, Math.ceil(b.y1))]
  return x1 > x0 && y1 > y0 ? { left: x0, top: y0, width: x1 - x0, height: y1 - y0 } : null
}

/**
 * The text drawn into a box just big enough for it (stroke and blur included), so memory follows the text, not the
 * photo. Returns the SVG and where it goes on the image.
 */
function overlay(width: number, height: number, luma: number) {
  const { fontSize, stroke, blur } = watermarkLayout(width, height)
  const { fill, outline } = watermarkAlphas(luma)
  const s = fontSize / G.unitsPerEm
  // anchor "mm": horizontal middle of the advance, vertical middle between ascender and descender, at (w//2, h//2).
  const x = Math.floor(width / 2) - (G.advance * s) / 2
  const y = Math.floor(height / 2) + ((G.ascender + G.descender) / 2) * s
  const pad = stroke + 3 * blur + 1
  const box = clip({ x0: x + G.ink.x0 * s - pad, y0: y + G.ink.y0 * s - pad, x1: x + G.ink.x1 * s + pad, y1: y + G.ink.y1 * s + pad }, width, height)
  if (!box) return null
  const t = `translate(${x - box.left} ${y - box.top}) scale(${s})`
  const strokeWidth = (2 * stroke) / s // centred on the outline, so twice Pillow's outward stroke
  // Pillow paints the fill over the stroke without blending; the mask keeps the outline outside the glyphs to match.
  // The mask sits on an untransformed group: on the scaled path its content would be scaled twice.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${box.width}" height="${box.height}">
<defs>
<filter id="b" x="0" y="0" width="${box.width}" height="${box.height}" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="${blur}"/></filter>
<mask id="o" maskUnits="userSpaceOnUse" x="0" y="0" width="${box.width}" height="${box.height}"><rect width="100%" height="100%" fill="#fff"/><path transform="${t}" d="${G.d}" fill="#000"/></mask>
</defs>
<g filter="url(#b)">
<g mask="url(#o)"><path transform="${t}" d="${G.d}" fill="none" stroke="#000" stroke-opacity="${outline / 255}" stroke-width="${strokeWidth}" stroke-linejoin="round"/></g>
<path transform="${t}" d="${G.d}" fill="#fff" fill-opacity="${fill / 255}"/>
</g>
</svg>`
  return { svg: Buffer.from(svg), ...box }
}

/** Still raster images are stamped; GIF/SVG, other formats and animations (only one frame would get the mark) are not. */
export async function isStampable(input: Buffer, mimetype: string): Promise<boolean> {
  if (!WATERMARK_MIME_TYPES.includes(mimetype)) return false
  return ((await sharp(input).metadata()).pages ?? 1) <= 1
}

/**
 * Stamps "kefkenahsap.com" in the centre and re-encodes in the input's format at high quality (Payload converts it to
 * WebP afterwards). EXIF orientation is applied first, so the mark is upright in the stored image.
 */
export async function applyWatermark(input: Buffer, mimetype: string): Promise<Buffer> {
  const meta = await sharp(input).metadata()
  const { width, height } = meta.autoOrient ?? { width: meta.width!, height: meta.height! }
  const { textWidth, textHeight } = watermarkLayout(width, height)
  const [cx, cy] = [Math.floor(width / 2), Math.floor(height / 2)]
  const [hw, hh] = [Math.floor(textWidth / 2) + 10, Math.floor(textHeight / 2) + 10]
  const sample = clip({ x0: cx - hw, y0: cy - hh, x1: cx + hw, y1: cy + hh }, width, height)!
  // Mean Rec.601 luma (Pillow's "L") behind the text: the luma of the channel means equals the mean of the lumas.
  const { channels: c } = await sharp(input).rotate().extract(sample).stats()
  const luma = c.length < 3 ? c[0]!.mean : 0.299 * c[0]!.mean + 0.587 * c[1]!.mean + 0.114 * c[2]!.mean

  const mark = overlay(width, height, luma)
  let out = sharp(input).rotate()
  if (mark) out = out.composite([{ input: mark.svg, left: mark.left, top: mark.top }])
  const format = mimetype.split('/')[1] as 'jpeg' | 'png' | 'webp' | 'avif' | 'tiff'
  return (format === 'png' ? out.png() : out.toFormat(format, { quality: 95 })).toBuffer()
}

// Long-side cap for the clean original kept beside a stamped upload. The site's largest generated size is 1920 px wide;
// 2560 leaves room for a future larger size or a re-crop without keeping multi-MB camera files on the shared server disk.
export const ORIGINAL_MAX_PX = 2560

/**
 * The clean original as stored on the private volume: upright (EXIF orientation applied), long side at most 2560 px
 * (never upscaled), high-quality WebP with the source's ICC profile, instead of the raw upload bytes.
 */
export function cleanOriginal(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize(ORIGINAL_MAX_PX, ORIGINAL_MAX_PX, { fit: 'inside', withoutEnlargement: true })
    .keepIccProfile()
    .webp({ quality: 90 })
    .toBuffer()
}
