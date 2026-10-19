'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type MouseEvent } from 'react'

import { buttonClass } from '@/components/ui/button'
import { Picture } from '@/components/ui/Picture'
import type { GalleryItem } from '@/lib/gallery/item'
import type { GalleryLabels } from '@/lib/gallery/labels'
import { distribute, evenColumns, largestFirstScreenItem, placements, ratio } from '@/lib/gallery/masonry'

import type { LightboxProps } from './Lightbox'

// One server-computed column layout per breakpoint (2 / 3 / 4 columns, `.masonry` in styles.css). The tiles render once
// and CSS places them for the active breakpoint (#215); `media` picks that layout for the lightbox on click.
const LAYOUTS = [
  { cols: 2, media: '(width < 48rem)' },
  { cols: 3, media: '(48rem <= width < 64rem)' },
  { cols: 4, media: '(width >= 64rem)' },
] as const
// Scrolling loads at most this many pages by itself; then the button takes over so the footer stays reachable.
const AUTO_PAGES = 2
// Column width inside the Container (px-4 / md:px-6) less the gaps: 2 / 3 / 4 columns (#211).
const SIZES = '(min-width: 1280px) 296px, (min-width: 1024px) calc(25vw - 1.5rem), (min-width: 768px) calc(33.4vw - 1.6rem), calc(50vw - 1.25rem)'
// `priority` (a grid at the top of the page): the phone grid's likely LCP card, the tallest of the first two rows, loads
// with high priority (#129); the other cards of those rows load eagerly at normal priority, as a lazy image only starts
// after layout and the real LCP card can be another one (#211). Picked from the phone layout; on wider screens these are
// still first-screen cards.
const FIRST_SCREEN_ROWS = 2

/** Masonry gallery: SSR first page, infinite feed appended to column ends, lightbox loaded on first open. */
export function GalleryGridClient({
  initial,
  total,
  nextCursor = null,
  feedUrl,
  moreHref,
  labels,
  priority = false,
  trim = false,
}: {
  initial: GalleryItem[]
  total: number
  nextCursor?: string | null
  feedUrl?: string
  moreHref?: string
  labels: GalleryLabels
  priority?: boolean
  /** A fixed set (no feed): drop overhanging tail tiles so every layout ends on an even line; the lightbox shows the same photos. */
  trim?: boolean
}) {
  const [items, setItems] = useState(initial)
  const [cursor, setCursor] = useState(nextCursor)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState<number | null>(null)
  // A trimmed layout opens the lightbox on just its own photos (indexes into `items`), so grid and lightbox match.
  const [seq, setSeq] = useState<number[] | null>(null)
  const [Lightbox, setLightbox] = useState<ComponentType<LightboxProps> | null>(null)
  const inFlight = useRef(false)
  const [autoLoads, setAutoLoads] = useState(0)
  const sentinel = useRef<HTMLDivElement>(null)

  const layouts = useMemo(
    () =>
      LAYOUTS.map((l) => {
        const all = distribute(items, l.cols)
        // A fixed set is evened by moving tiles first (#156), so trimming hides as few as it can.
        const columns = trim ? evenColumns(items, all) : all
        // The photos this layout shows, in feed order: what its lightbox steps through.
        const shown = trim ? columns.flat().sort((a, b) => a - b) : null
        return { ...l, columns, shown, ...placements(items, columns) }
      }),
    [items, trim],
  )
  const phone = layouts.find((l) => l.cols === 2)!
  const lcpItem = priority ? largestFirstScreenItem(items, phone.columns, FIRST_SCREEN_ROWS) : undefined

  const loadMore = useCallback(async () => {
    if (!cursor || !feedUrl || inFlight.current) return
    inFlight.current = true
    setLoading(true)
    setFailed(false)
    try {
      const url = new URL(feedUrl, window.location.href)
      url.searchParams.set('cursor', cursor)
      const res = await fetch(url)
      if (!res.ok) throw new Error(`feed ${res.status}`)
      const data = (await res.json()) as { items: GalleryItem[]; nextCursor: string | null }
      setItems((prev) => [...prev, ...data.items])
      setCursor(data.nextCursor)
    } catch {
      setFailed(true)
    } finally {
      inFlight.current = false
      setLoading(false)
    }
  }, [cursor, feedUrl])

  // Auto-load near the end (a limited number of times); after a failure only the button retries.
  useEffect(() => {
    const el = sentinel.current
    if (!el || !cursor || failed || autoLoads >= AUTO_PAGES) return
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || inFlight.current) return
        setAutoLoads((n) => n + 1)
        void loadMore()
      },
      { rootMargin: '900px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [cursor, failed, autoLoads, loadMore])

  const openAt = async (index: number, shown: number[] | null) => {
    if (!Lightbox) {
      try {
        const mod = await import('./Lightbox')
        setLightbox(() => mod.Lightbox)
      } catch {
        // Chunk failed (offline, new deploy): the card's own page still works.
        window.location.assign(items[index]!.href)
        return
      }
    }
    setSeq(shown)
    setOpen(shown ? shown.indexOf(index) : index)
  }
  const onCardClick = (e: MouseEvent<HTMLAnchorElement>, index: number) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    // Tracked here, not with `data-umami-event` on the card: Umami follows such links itself (`location.href`) and that
    // full page load replaced the lightbox (#226).
    window.umami?.track('gallery_open')
    // The layout on screen now decides which photos (a trimmed grid hides some per layout) the lightbox steps through.
    const active = layouts.find((l) => window.matchMedia(l.media).matches) ?? phone
    void openAt(index, active.shown)
  }
  const lightboxItems = seq ? seq.map((i) => items[i]!) : items

  return (
    <div>
      {/* One list in feed order (DOM, tab and lightbox order agree); each tile carries its place in every layout. */}
      <div className="masonry">
        <ul style={Object.fromEntries(layouts.map((l) => [`--h${l.cols}`, l.height]))}>
          {items.map((item, i) => {
            const place = Object.fromEntries(layouts.flatMap((l) => { const p = l.at[i]; return p ? [[`--c${l.cols}`, p.col], [`--y${l.cols}`, p.y], [`--k${l.cols}`, p.k]] : [] }))
            // A trimmed grid hides a tile in the layouts that drop it (masonry-hide-N in styles.css).
            const hidden = layouts.filter((l) => !l.at[i]).map((l) => `masonry-hide-${l.cols}`).join(' ')
            const top = phone.at[i]
            return (
              <li key={item.id} style={place} className={hidden || undefined}>
                <a
                  href={item.href}
                  onClick={(e) => onCardClick(e, i)}
                  data-gallery-item
                  className="group block overflow-hidden rounded-[var(--radius-photo)]"
                  // The tile is drawn at the ratio its slot was laid out with (a photo without stored dimensions is
                  // square, cropped by object-cover), so absolutely placed tiles never overlap; an empty Picture keeps it.
                  style={{ aspectRatio: `1 / ${ratio(item)}` }}
                >
                  <Picture
                    media={item.media}
                    alt={item.alt}
                    altLang={item.altLang}
                    sizes={SIZES}
                    maxWidth={960}
                    className="h-full"
                    priority={i === lcpItem}
                    eager={priority && top !== undefined && top.k < FIRST_SCREEN_ROWS}
                    imgClassName="transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:scale-[1.03]"
                  />
                </a>
              </li>
            )
          })}
        </ul>
      </div>

      {cursor && (
        <div ref={sentinel} className="mt-6 flex flex-col items-center gap-4">
          {loading && (
            <div aria-hidden className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="aspect-[4/3] animate-pulse rounded-[var(--radius-photo)] bg-mist" />
              ))}
            </div>
          )}
          {failed && <p role="alert" className="text-ink-soft">{labels.loadFailed}</p>}
          <a
            href={moreHref}
            onClick={(e) => {
              e.preventDefault()
              void loadMore()
            }}
            aria-disabled={loading || undefined}
            className={buttonClass.outline}
          >
            {loading ? labels.loading : failed ? labels.retry : labels.more}
          </a>
        </div>
      )}

      {Lightbox && open !== null && (
        <Lightbox
          items={lightboxItems}
          index={open}
          total={seq ? seq.length : Math.max(total, items.length)}
          onIndex={(i) => {
            setOpen(i)
            if (!seq && i >= items.length - 3) void loadMore()
          }}
          onClose={() => setOpen(null)}
          labels={labels}
        />
      )}
    </div>
  )
}
