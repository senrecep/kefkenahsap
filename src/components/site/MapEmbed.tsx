'use client'

import { MapPin } from 'lucide-react'
import { useState } from 'react'

import { buttonClass } from '@/components/ui/button'

/** Click-to-load map (#143, KVKK): no request reaches Google until the visitor asks; both states share one box (no CLS). */
export function MapEmbed({ src, title, show, note }: { src: string; title: string; show: string; note: string }) {
  const [shown, setShown] = useState(false)
  return (
    <div className="aspect-[4/3] overflow-hidden sm:aspect-[16/10] rounded-[var(--radius-control)] border border-line bg-mist">
      {shown ? (
        <iframe
          src={src}
          title={title}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          className="size-full border-0"
          ref={(el) => el?.focus()}
        />
      ) : (
        <button type="button" onClick={() => setShown(true)} className="group flex size-full flex-col items-center justify-center gap-3 p-6 text-center">
          <MapPin aria-hidden size={26} strokeWidth={1.75} className="text-action" />
          <span className={`${buttonClass.outline} group-hover:border-ink/40`}>{show}</span>
          <span className="text-[0.95rem] text-ink-soft">{note}</span>
        </button>
      )}
    </div>
  )
}
