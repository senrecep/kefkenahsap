'use client'

import { MapPin } from 'lucide-react'
import { useState } from 'react'

import { buttonClass } from '@/components/ui/button'

/** Click-to-load map (#143, KVKK): no request reaches Google until the visitor asks; both states share one box (no CLS). */
export function MapEmbed({ src, title, show, note, place }: { src: string; title: string; show: string; note: string; place?: string }) {
  const [shown, setShown] = useState(false)
  return (
    <div className="relative aspect-[4/3] overflow-hidden sm:aspect-[16/10] rounded-[var(--radius-control)] border border-line bg-mist">
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
        <>
          {/* A street-plan texture in the paper/line tokens: reads as "a map goes here" without pretending to be one. */}
          <svg aria-hidden className="absolute inset-0 size-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 320 200">
            <defs>
              <pattern id="map-blocks" width="64" height="48" patternUnits="userSpaceOnUse" patternTransform="rotate(-8)">
                <path d="M0 18H64M40 0V48" className="stroke-paper" strokeWidth="5" />
                <path d="M0 40H64M14 0V48" className="stroke-line" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="320" height="200" fill="url(#map-blocks)" />
            <path d="M-10 150C60 130 110 160 170 112S270 40 330 52" fill="none" className="stroke-paper" strokeWidth="11" />
            <path d="M-10 150C60 130 110 160 170 112S270 40 330 52" fill="none" className="stroke-line" strokeWidth="1" />
          </svg>
          <button type="button" onClick={() => setShown(true)} className="group relative flex size-full flex-col items-center justify-center gap-3 p-6 text-center">
            <span className="flex size-12 items-center justify-center rounded-full border border-line bg-paper">
              <MapPin aria-hidden size={24} strokeWidth={1.75} className="text-action" />
            </span>
            {place && <span className="rounded-[var(--radius-control)] bg-paper/90 px-2 font-[family-name:var(--font-display)] font-semibold">{place}</span>}
            <span className={`${buttonClass.outline} group-hover:border-ink/40 group-hover:bg-mist`}>{show}</span>
            <span className="rounded-[var(--radius-control)] bg-paper/90 px-2 text-[0.95rem] text-ink-soft">{note}</span>
          </button>
        </>
      )}
    </div>
  )
}
