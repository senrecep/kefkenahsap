'use client'

import { useEffect, useRef, useState } from 'react'

import { can3d, keyRotation, rotate, shownSamples, type WoodKey } from '@/lib/wood/samples'

import type { WoodScene } from './wood-scene'

type Labels = { names: Record<WoodKey, string>; hint: string; note: string; title: string }
const START = { x: 0.35, y: -0.5 }

function env() {
  const nav = navigator as Navigator & {
    deviceMemory?: number
    connection?: { saveData?: boolean }
  }
  let webgl = false
  try {
    webgl = Boolean(document.createElement('canvas').getContext('webgl'))
  } catch {}
  return {
    webgl,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    saveData: Boolean(nav.connection?.saveData),
    deviceMemory: nav.deviceMemory,
  }
}

/**
 * Four wood samples. Server-rendered as flat photos (also the fallback: no WebGL, reduced motion, Save-Data). Once the
 * figure nears the viewport and 3D is allowed, OGL is imported and each photo becomes a plank turned by drag or arrow keys.
 */
export function WoodSamplesView({ labels }: { labels: Labels }) {
  const root = useRef<HTMLElement>(null)
  const [on, setOn] = useState(false)

  useEffect(() => {
    const el = root.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        io.disconnect()
        if (can3d(env())) setOn(true)
      },
      { rootMargin: '200px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <figure ref={root} className="mt-8" aria-labelledby="wood-samples-title">
      <figcaption
        id="wood-samples-title"
        className="font-[family-name:var(--font-display)] font-semibold"
      >
        {labels.title}
      </figcaption>
      <ul className="mt-4! grid list-none! grid-cols-2 gap-x-4 gap-y-6 ps-0!">
        {shownSamples().map((s) => (
          <Sample
            key={s.key}
            src={s.texture}
            name={labels.names[s.key]}
            hint={labels.hint}
            on={on}
          />
        ))}
      </ul>
      <p className="mt-4 text-[0.95rem] text-ink-soft">
        {labels.note}
        {on && <> {labels.hint}.</>}
      </p>
    </figure>
  )
}

function Sample({ src, name, hint, on }: { src: string; name: string; hint: string; on: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const scene = useRef<WoodScene | null>(null)
  const rot = useRef(START)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!on || !canvas.current) return
    let cancelled = false
    import('./wood-scene')
      .then(({ mountWoodScene }) => mountWoodScene(canvas.current!, src, rot.current))
      .then((s) => {
        if (cancelled) return s.destroy()
        scene.current = s
        setReady(true)
      })
      .catch(() => {}) // the flat photo stays: that is the fallback
    return () => {
      cancelled = true
      scene.current?.destroy()
      scene.current = null
    }
  }, [on, src])

  const turn = (d: { x: number; y: number }) => {
    rot.current = rotate(rot.current, d)
    scene.current?.setRotation(rot.current.x, rot.current.y)
  }

  return (
    <li className="mt-0! ps-0!">
      <div
        className="relative aspect-[2/1] overflow-hidden rounded-[var(--radius-photo)] bg-mist focus-visible:outline-2 focus-visible:outline-offset-2"
        {...(ready
          ? {
              tabIndex: 0,
              role: 'img',
              'aria-label': `${name}. ${hint}`,
              onKeyDown: (e: React.KeyboardEvent) => {
                const d = keyRotation(e.key)
                if (!d) return
                e.preventDefault()
                turn(d)
              },
              onPointerDown: (e: React.PointerEvent) => {
                drag.current = { x: e.clientX, y: e.clientY }
                e.currentTarget.setPointerCapture(e.pointerId)
              },
              onPointerMove: (e: React.PointerEvent) => {
                if (!drag.current) return
                turn({
                  x: (e.clientY - drag.current.y) * 0.01,
                  y: (e.clientX - drag.current.x) * 0.01,
                })
                drag.current = { x: e.clientX, y: e.clientY }
              },
              onPointerUp: () => (drag.current = null),
              style: { touchAction: 'pan-y', cursor: 'grab' },
            }
          : {})}
      >
        <img
          src={src}
          alt=""
          width={384}
          height={192}
          loading="lazy"
          className={`size-full object-cover transition-opacity duration-150 ${ready ? 'opacity-0' : ''}`}
        />
        {on && <canvas ref={canvas} aria-hidden className="absolute inset-0 size-full" />}
      </div>
      <p className="mt-2! font-[family-name:var(--font-display)] font-semibold">{name}</p>
    </li>
  )
}
