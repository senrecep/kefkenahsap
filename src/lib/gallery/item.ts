import type { MediaLike } from '@/lib/media/image'

/** One gallery image as sent to the page and the feed (same shape for SSR props and JSON). */
export type GalleryItem = {
  id: number
  slug: string
  href: string
  title: string
  alt: string
  /** Set when `alt` is the default locale's stand-in. */
  altLang?: string
  caption?: string
  width: number
  height: number
  media: MediaLike
  category?: { name: string; href: string }
}
