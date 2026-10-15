'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'

import { can3d, keyRotation, rotate, type WoodKey } from '@/lib/wood/samples'

import type { WoodScene } from './wood-scene'

type Labels = { hint: string; note: string; title: string; roledescription: string }
type Sample = { key: WoodKey; texture: string; name: string; fact: string; source?: { label: string; href: string } }
// A board lying face-up, seen from about 40° above and turned a little: top face, front edge, end grain all read at rest.
const START = { x: 0.6, y: -0.26 }

function env() {
  const nav = navigator as Navigator & {
    deviceMemory?: number
    connection?: { saveData?: boolean }
  }
  let webgl = false
  try {
    const gl = document.createElement('canvas').getContext('webgl')
    webgl = Boolean(gl)
    // Release the probe's context at once: browsers cap live WebGL contexts.
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {}
  return {
    webgl,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    saveData: Boolean(nav.connection?.saveData),
    deviceMemory: nav.deviceMemory,
  }
}

/**
 * Wood samples with a real-photo texture (one board each). Server-rendered as flat photos (also the fallback: no WebGL,
 * reduced motion, Save-Data, low memory, lost context). Once the figure nears the viewport and 3D is allowed, OGL is
 * imported and each photo becomes a plank turned by drag or arrow keys.
 */
export function WoodSamplesView({ labels, samples }: { labels: Labels; samples: Sample[] }) {
  const root = useRef<HTMLElement>(null)
  const [on, setOn] = useState(false)
  const [live, setLive] = useState(0)
  const titleId = useId()
  const onReady = useCallback((ready: boolean) => setLive((n) => n + (ready ? 1 : -1)), [])
  const hintId = useId()

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
    <figure ref={root} data-wide className="mt-10! border-y border-line py-6" aria-labelledby={titleId}>
      <figcaption id={titleId} className="font-[family-name:var(--font-display)] text-[1.05rem] font-semibold">
        {labels.title}
      </figcaption>
      <ul role="list" className="mt-4! grid list-none! grid-cols-1 gap-x-6 gap-y-8 ps-0! sm:grid-cols-2">
        {samples.map((s) => (
          <Plank key={s.key} sample={s} roledescription={labels.roledescription} hintId={hintId} on={on} onReady={onReady} />
        ))}
      </ul>
      <p className="mt-5! text-[0.95rem] text-ink-soft">
        {labels.note}
        {/* The hint appears once, and only while at least one plank can actually be turned. */}
        {live > 0 && <span id={hintId}> {labels.hint}.</span>}
      </p>
    </figure>
  )
}

function Plank(props: { sample: Sample; roledescription: string; hintId: string; on: boolean; onReady: (ready: boolean) => void }) {
  const { sample, roledescription, hintId, on, onReady } = props
  const src = sample.texture
  const frame = useRef<HTMLDivElement>(null)
  const scene = useRef<WoodScene | null>(null)
  const rot = useRef(START)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!on || !frame.current) return
    // A fresh canvas per mount: under StrictMode's double effect the first run's loseContext must not hit the second's.
    const canvas = document.createElement('canvas')
    canvas.setAttribute('aria-hidden', 'true')
    canvas.className = 'absolute inset-0 size-full'
    frame.current.append(canvas)
    let cancelled = false
    let shown = false
    const hide = () => {
      if (shown) onReady(false)
      shown = false
      setReady(false)
    }
    import('./wood-scene')
      .then(({ mountWoodScene }) =>
        mountWoodScene(canvas, src, rot.current, () => {
          // Context lost: drop the plank, the photo comes back.
          scene.current = null
          canvas.remove()
          hide()
        }),
      )
      .then((s) => {
        if (cancelled) return s.destroy()
        scene.current = s
        shown = true
        onReady(true)
        setReady(true)
      })
      .catch(() => canvas.remove()) // the flat photo stays: that is the fallback
    return () => {
      cancelled = true
      scene.current?.destroy()
      scene.current = null
      canvas.remove()
      hide()
    }
  }, [on, src, onReady])

  const turn = (d: { x: number; y: number }) => {
    rot.current = rotate(rot.current, d)
    scene.current?.setRotation(rot.current.x, rot.current.y)
  }
  const endDrag = () => (drag.current = null)

  return (
    <li className="mt-0! ps-0!">
      <div
        ref={frame}
        className="relative grid aspect-[3/1] place-items-center rounded-[var(--radius-photo)] focus-visible:outline-2 focus-visible:outline-offset-2"
        {...(ready
          ? {
              tabIndex: 0,
              role: 'group',
              'aria-roledescription': roledescription,
              'aria-label': sample.name,
              'aria-describedby': hintId,
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
              onPointerUp: endDrag,
              onPointerCancel: endDrag,
              onLostPointerCapture: endDrag,
              style: { touchAction: 'pan-y', cursor: 'grab' },
            }
          : {})}
      >
        {/* Flat fallback: the board itself, at the plank's 8:1 face. */}
        <img
          src={src}
          alt=""
          width={1024}
          height={128}
          loading="lazy"
          className={`w-[85%] rounded-[3px] transition-opacity duration-150 ${ready ? 'opacity-0' : ''}`}
        />
      </div>
      <p className="mt-3! font-[family-name:var(--font-display)] font-semibold">{sample.name}</p>
      <p className="mt-1! text-[0.95rem] leading-snug text-ink-soft">{sample.fact}</p>
      {sample.source && (
        <a href={sample.source.href} className="mt-1 inline-flex min-h-11 items-center text-[0.95rem]">
          {sample.source.label}
          {/* Two identical link texts: the sample name tells them apart for screen readers. */}
          <span className="sr-only">: {sample.name}</span>
        </a>
      )}
    </li>
  )
}
