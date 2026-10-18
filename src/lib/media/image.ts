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
  /** Payload focal point (percent); 50/50 is the upload default, i.e. never set by an editor. */
  focalX?: number | null
  focalY?: number | null
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
    // `portrait` is a phone-hero crop, not another width of this image.
    ...Object.entries(m.sizes ?? {})
      .filter(([name]) => name !== 'portrait')
      .map(([, s]) => s)
      .filter((s): s is NonNullable<Size> => Boolean(s?.url && s.width)),
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

/** The upload-time portrait crop (Media `portrait` size) as its own image, once it exists and is portrait-shaped. */
export function portraitOf(m: MediaLike): MediaLike | undefined {
  const p = m.sizes?.portrait
  // A source smaller than the box is only shrunk (withoutEnlargement), so its "portrait" can still be landscape.
  return p?.url && p.width && p.height && p.height > p.width ? { url: p.url, width: p.width, height: p.height } : undefined
}

/**
 * CSS object-position from the editor's focal point. Unset (or still the 50/50 upload default) → `fallback`: our job
 * photos keep the worked surface low in the frame.
 */
export function focalPosition(m: Pick<MediaLike, 'focalX' | 'focalY'>, fallback = '50% 85%'): string {
  const { focalX: x, focalY: y } = m
  if (typeof x !== 'number' || typeof y !== 'number' || (x === 50 && y === 50)) return fallback
  const pct = (v: number) => `${Math.min(100, Math.max(0, v))}%`
  return `${pct(x)} ${pct(y)}`
}
