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

/** Payload's focal-point crop for a size with both width and height: scale to cover the box, then cut it centred on the focal point (percent), kept inside the image. */
export function focalCrop(source: Box, target: Box, focal: { x: number; y: number }) {
  const byHeight = target.width / target.height < source.width / source.height
  const scaled = byHeight
    ? { width: Math.round((source.width * target.height) / source.height), height: target.height }
    : { width: target.width, height: Math.round((source.height * target.width) / source.width) }
  const bound = (size: number, box: number, pct: number) => Math.floor(Math.max(0, Math.min(size - box, (size * pct) / 100 - box / 2)))
  return {
    resize: byHeight ? { height: target.height } : { width: target.width },
    extract: { left: bound(scaled.width, target.width, focal.x), top: bound(scaled.height, target.height, focal.y), ...target },
  }
}

