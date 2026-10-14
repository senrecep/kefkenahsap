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
