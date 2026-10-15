'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type MouseEvent } from 'react'

import { buttonClass } from '@/components/ui/button'
import { Picture } from '@/components/ui/Picture'
import type { GalleryItem } from '@/lib/gallery/item'
import type { GalleryLabels } from '@/lib/gallery/labels'
import { distribute, largestFirstScreenItem, trimColumns } from '@/lib/gallery/masonry'

import type { LightboxProps } from './Lightbox'

// One server-computed layout per breakpoint; the hidden copies are display:none, so their lazy images never load.
const LAYOUTS = [
  { cols: 2, className: 'grid grid-cols-2 gap-2 sm:gap-3 md:hidden' },
  { cols: 3, className: 'hidden grid-cols-3 gap-4 md:grid lg:hidden' },
  { cols: 4, className: 'hidden grid-cols-4 gap-4 lg:grid' },
] as const
// Scrolling loads at most this many pages by itself; then the button takes over so the footer stays reachable.
const AUTO_PAGES = 2
const SIZES = '(min-width: 1280px) 296px, (min-width: 1024px) 23vw, (min-width: 768px) 31vw, 48vw'
// `priority` (a grid at the top of the page): the phone grid's likely LCP card, the tallest of the first two rows, loads
// eagerly (#129). Just that one: every eager byte competes with it. Only in the 2-column copy, because an eager image in
// a display:none copy still downloads (on desktop it resolves to the w320 the visible grid uses anyway).
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
  /** A fixed set (no feed): drop overhanging tail tiles so every layout ends on an even line. The lightbox keeps them all. */
  trim?: boolean
}) {
  const [items, setItems] = useState(initial)
  const [cursor, setCursor] = useState(nextCursor)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState<number | null>(null)
  const [Lightbox, setLightbox] = useState<ComponentType<LightboxProps> | null>(null)
  const inFlight = useRef(false)
  const [autoLoads, setAutoLoads] = useState(0)
  const sentinel = useRef<HTMLDivElement>(null)

  const layouts = useMemo(
    () =>
      LAYOUTS.map((l) => {
        const columns = distribute(items, l.cols)
        return { ...l, columns: trim ? trimColumns(items, columns) : columns }
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

  const openAt = async (index: number) => {
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
    setOpen(index)
  }
  const onCardClick = (e: MouseEvent<HTMLAnchorElement>, index: number) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    void openAt(index)
  }

  return (
    <div>
      {layouts.map((layout) => (
        <div key={layout.cols} className={layout.className}>
          {layout.columns.map((col, c) => (
            <ul key={c} className="flex min-w-0 flex-col gap-2 sm:gap-3 md:gap-4">
              {col.map((i) => {
                const item = items[i]!
                return (
                  <li key={item.id}>
                    <a
                      href={item.href}
                      onClick={(e) => onCardClick(e, i)}
                      data-gallery-item
                      data-umami-event="gallery_open"
                      className="group block overflow-hidden rounded-[var(--radius-photo)]"
                    >
                      <Picture
                        media={item.media}
                        alt={item.alt}
                        altLang={item.altLang}
                        sizes={SIZES}
                        maxWidth={960}
                        // Hidden on desktop yet still fetched: it resolves to the w320 the visible grid shows, so no extra bytes.
                        priority={layout === phone && i === lcpItem}
                        imgClassName="transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:scale-[1.03]"
                      />
                    </a>
                  </li>
                )
              })}
            </ul>
          ))}
        </div>
      ))}

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
          items={items}
          index={open}
          total={Math.max(total, items.length)}
          onIndex={(i) => {
            setOpen(i)
            if (i >= items.length - 3) void loadMore()
          }}
          onClose={() => setOpen(null)}
          labels={labels}
        />
      )}
    </div>
  )
}
