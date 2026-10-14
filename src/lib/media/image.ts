type Size = { url?: string | null; width?: number | null; height?: number | null } | null | undefined
export type MediaLike = {
  url?: string | null
  width?: number | null
  height?: number | null
  alt?: string | null
  lqip?: string | null
  dominantColor?: string | null
  sizes?: Record<string, Size> | null
}
export type ResponsiveImage = {
  src: string
  srcSet: string
  width: number
  height: number
  alt: string
  placeholder?: string
  color?: string
}

/** srcset straight from the CDN sizes Payload generated at upload (no runtime image optimizer). */
export function responsiveImage(m: MediaLike, opts: { maxWidth?: number } = {}): ResponsiveImage {
  const max = opts.maxWidth ?? Infinity
  const candidates = [
    ...Object.values(m.sizes ?? {}).filter((s): s is NonNullable<Size> => Boolean(s?.url && s.width)),
    ...(m.url && m.width ? [{ url: m.url, width: m.width, height: m.height }] : []),
  ]
    .filter((s) => s.width! <= max)
    .sort((a, b) => a.width! - b.width!)
    .filter((s, i, all) => i === 0 || s.width !== all[i - 1]!.width)
  const preferred = candidates.find((c) => c.width! >= 960) ?? candidates.at(-1)
  return {
    src: preferred?.url ?? m.url ?? '',
    srcSet: candidates.map((c) => `${c.url} ${c.width}w`).join(', '),
    width: m.width ?? preferred?.width ?? 0,
    height: m.height ?? preferred?.height ?? 0,
    alt: m.alt ?? '',
    ...(m.lqip ? { placeholder: m.lqip } : {}),
    ...(m.dominantColor ? { color: m.dominantColor } : {}),
  }
}
