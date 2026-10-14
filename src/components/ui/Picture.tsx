import { responsiveImage, type MediaLike } from '@/lib/media/image'

type Props = {
  media: MediaLike
  /** CSS sizes attribute describing the rendered width, e.g. "(min-width: 1024px) 33vw, 50vw" */
  sizes: string
  className?: string
  imgClassName?: string
  priority?: boolean
  maxWidth?: number
  alt?: string
  /** Art direction: shown below 768px instead of `media` (e.g. a portrait crop for the phone hero). */
  mobile?: MediaLike
}

/** CDN image with srcset, intrinsic size (no CLS) and a blurred LQIP/dominant-colour backdrop while loading. */
export function Picture({ media, sizes, className = '', imgClassName = '', priority = false, maxWidth, alt, mobile }: Props) {
  const img = responsiveImage(media, { maxWidth })
  const small = mobile ? responsiveImage(mobile, { maxWidth }) : undefined
  if (!img.src) return null
  const image = (
    <img
      src={img.src}
      srcSet={img.srcSet}
      sizes={sizes}
      width={img.width || undefined}
      height={img.height || undefined}
      alt={alt ?? img.alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      fetchPriority={priority ? 'high' : undefined}
      className={`block h-full w-full object-cover ${imgClassName}`}
    />
  )
  return (
    <span
      className={`relative block overflow-hidden ${className}`}
      style={{
        aspectRatio: img.width && img.height ? `${img.width} / ${img.height}` : undefined,
        backgroundColor: img.color,
        backgroundImage: img.placeholder ? `url("${img.placeholder}")` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* `contents`: the img keeps sizing against the wrapper. */}
      {small?.src ? (
        <picture className="contents">
          <source media="(max-width: 767px)" srcSet={small.srcSet || small.src} sizes={sizes} width={small.width || undefined} height={small.height || undefined} />
          {image}
        </picture>
      ) : (
        image
      )}
    </span>
  )
}
