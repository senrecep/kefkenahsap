type Size = { url?: string | null; width?: number | null; height?: number | null } | null | undefined
export type MediaLike = {
  url?: string | null
  width?: number | null
  height?: number | null
  alt?: string | null
  /** Set when `alt` is another locale's stand-in (see withDefaultAlt): the img's `lang`. */
  altLang?: string
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
  altLang?: string
  placeholder?: string
  color?: string
}

/** srcset straight from the CDN sizes Payload generated at upload (no runtime image optimizer). */
export function responsiveImage(m: MediaLike, opts: { maxWidth?: number; minWidth?: number } = {}): ResponsiveImage {
  const max = opts.maxWidth ?? Infinity
  const sorted = [
    ...Object.values(m.sizes ?? {}).filter((s): s is NonNullable<Size> => Boolean(s?.url && s.width)),
    ...(m.url && m.width ? [{ url: m.url, width: m.width, height: m.height }] : []),
  ]
    .filter((s) => s.width! <= max)
    .sort((a, b) => a.width! - b.width!)
    .filter((s, i, list) => i === 0 || s.width !== list[i - 1]!.width)
  // minWidth: for slots that crop (object-cover) and so render wider than `sizes` can say; the largest always stays.
  const min = opts.minWidth ?? 0
  const candidates = sorted.filter((c, i) => c.width! >= min || i === sorted.length - 1)
  const preferred = candidates.find((c) => c.width! >= 960) ?? candidates.at(-1)
  return {
    src: preferred?.url ?? m.url ?? '',
    srcSet: candidates.map((c) => `${c.url} ${c.width}w`).join(', '),
    width: m.width ?? preferred?.width ?? 0,
    height: m.height ?? preferred?.height ?? 0,
    alt: m.alt ?? '',
    ...(m.altLang ? { altLang: m.altLang } : {}),
    ...(m.lqip ? { placeholder: m.lqip } : {}),
    ...(m.dominantColor ? { color: m.dominantColor } : {}),
  }
}
