import sharp from 'sharp'

type Doc = { filename?: string | null; width?: number | null; sizes?: Record<string, { filename?: string | null } | null | undefined> | null }

/** Payload's name for an image size: `<name>-<width>x<height>.<ext>`. */
export function derivativeFilename(filename: string, width: number, height: number): string {
  const dot = filename.lastIndexOf('.')
  return dot < 0 ? `${filename}-${width}x${height}` : `${filename.slice(0, dot)}-${width}x${height}${filename.slice(dot)}`
}

/** A size is added only where Payload would have made one at upload: the original is wider (no enlargement). */
export function needsDerivative(doc: Doc, size: string, width: number): boolean {
  return Boolean(doc.filename) && !doc.sizes?.[size]?.filename && (doc.width ?? 0) > width
}

type Box = { width: number; height: number }

/** Payload's cover scale for a size with width and height: by height when the source is wider than the box, else by width. */
export function coverResize(source: Box, target: Box): { height: number } | { width: number } {
  return target.width / target.height < source.width / source.height ? { height: target.height } : { width: target.width }
}

/** Payload's focal-point cut: the box centred on the focal point (percent), kept inside the `scaled` image sharp produced. */
export function focalBox(scaled: Box, target: Box, focal: { x: number; y: number }) {
  const bound = (size: number, box: number, pct: number) => Math.floor(Math.max(0, Math.min(size - box, (size * pct) / 100 - box / 2)))
  return { left: bound(scaled.width, target.width, focal.x), top: bound(scaled.height, target.height, focal.y), width: target.width, height: target.height }
}

/** The crop Payload makes at upload (createImageSizes, resizeWithFocalPoint), as WebP. Measures the resize before cutting: sharp's width can differ from a rounding guess by 1px. */
export async function cropAroundFocalPoint(input: Buffer, target: Box & { quality: number }, focal: { x: number; y: number }) {
  const rotated = await sharp(input).rotate().raw().toBuffer({ resolveWithObject: true })
  const raw = (r: typeof rotated) => ({ raw: { width: r.info.width, height: r.info.height, channels: r.info.channels } })
  const scaled = await sharp(rotated.data, raw(rotated)).resize(coverResize(rotated.info, target)).raw().toBuffer({ resolveWithObject: true })
  const box = focalBox(scaled.info, target, focal)
  return sharp(scaled.data, raw(scaled)).extract(box).webp({ quality: target.quality }).toBuffer({ resolveWithObject: true })
}
