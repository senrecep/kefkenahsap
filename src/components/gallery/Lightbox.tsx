'use client'

import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react'

import type { GalleryItem } from '@/lib/gallery/item'
import { responsiveImage } from '@/lib/media/image'

export type LightboxProps = {
  items: GalleryItem[]
  index: number
  total: number
  onIndex: (index: number) => void
  onClose: () => void
}

const control =
  'inline-flex size-12 items-center justify-center rounded-full bg-black/45 text-white shadow-[var(--shadow-float)] transition-colors hover:bg-black/70 disabled:opacity-30'

/** Native modal <dialog> (focus stays inside, Esc closes, focus returns to the card). The URL follows the open image. */
export function Lightbox({ items, index, total, onIndex, onClose }: LightboxProps) {
  const t = useTranslations('Gallery')
  const dialog = useRef<HTMLDialogElement>(null)
  const swipeX = useRef<number | null>(null)
  const item = items[index]!
  const img = responsiveImage(item.media)
  const prev = index > 0 ? index - 1 : null
  const next = index < items.length - 1 ? index + 1 : null

  useEffect(() => {
    const d = dialog.current!
    const back = window.location.href
    const opener = document.activeElement as HTMLElement | null
    if (!d.open) d.showModal()
    return () => {
      window.history.replaceState(window.history.state, '', back)
      opener?.focus()
    }
  }, [])

  useEffect(() => {
    window.history.replaceState(window.history.state, '', item.href)
  }, [item.href])

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && prev !== null) onIndex(prev)
    if (e.key === 'ArrowRight' && next !== null) onIndex(next)
  }
  const onPointerUp = (e: PointerEvent) => {
    if (swipeX.current === null) return
    const dx = e.clientX - swipeX.current
    swipeX.current = null
    if (dx > 50 && prev !== null) onIndex(prev)
    if (dx < -50 && next !== null) onIndex(next)
  }

  return (
    <dialog
      ref={dialog}
      aria-label={t('lightbox')}
      onClose={onClose}
      onKeyDown={onKeyDown}
      className="fixed inset-0 m-0 size-full max-h-none max-w-none bg-[#141513] p-0 text-white backdrop:bg-black/80"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <p className="font-[family-name:var(--font-display)] text-sm font-semibold tabular-nums" aria-live="polite">
            {t('counter', { current: index + 1, total })}
          </p>
          <button type="button" autoFocus onClick={() => dialog.current?.close()} className={control} aria-label={t('close')}>
            <X aria-hidden size={22} strokeWidth={1.75} />
          </button>
        </div>

        <div
          className="relative flex min-h-0 flex-1 touch-pan-y items-center justify-center px-2 md:px-20"
          onPointerDown={(e) => (swipeX.current = e.clientX)}
          onPointerUp={onPointerUp}
        >
          <img
            key={item.id}
            src={img.src}
            srcSet={img.srcSet}
            sizes="100vw"
            width={img.width || undefined}
            height={img.height || undefined}
            alt={item.alt}
            className="max-h-full w-auto max-w-full rounded-[var(--radius-photo)] object-contain"
            style={{ backgroundColor: img.color }}
          />
          <button type="button" onClick={() => prev !== null && onIndex(prev)} disabled={prev === null} aria-label={t('prev')} className={`${control} absolute start-3 top-1/2 -translate-y-1/2 max-md:hidden`}>
            <ChevronLeft aria-hidden size={26} strokeWidth={1.75} className="rtl:rotate-180" />
          </button>
          <button type="button" onClick={() => next !== null && onIndex(next)} disabled={next === null} aria-label={t('next')} className={`${control} absolute end-3 top-1/2 -translate-y-1/2 max-md:hidden`}>
            <ChevronRight aria-hidden size={26} strokeWidth={1.75} className="rtl:rotate-180" />
          </button>
        </div>

        <div className="mx-auto w-full max-w-3xl px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <h2 className="text-lg text-white">{item.title}</h2>
          {item.caption && <p className="mt-1 text-[0.95rem] text-white/80">{item.caption}</p>}
          <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[0.95rem]">
            {item.category && (
              <a href={item.category.href} className="text-white underline decoration-white/40 hover:decoration-white">
                {item.category.name}
              </a>
            )}
            <a href={item.href} className="text-white underline decoration-white/40 hover:decoration-white">
              {t('openPage')}
            </a>
          </p>
          <div className="mt-3 flex justify-between gap-3 md:hidden">
            <button type="button" onClick={() => prev !== null && onIndex(prev)} disabled={prev === null} aria-label={t('prev')} className={control}>
              <ChevronLeft aria-hidden size={26} strokeWidth={1.75} className="rtl:rotate-180" />
            </button>
            <button type="button" onClick={() => next !== null && onIndex(next)} disabled={next === null} aria-label={t('next')} className={control}>
              <ChevronRight aria-hidden size={26} strokeWidth={1.75} className="rtl:rotate-180" />
            </button>
          </div>
        </div>
      </div>
    </dialog>
  )
}
