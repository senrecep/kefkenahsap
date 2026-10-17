'use client'

import { Pause, Play } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'

/** How long a photo stays before the next fades in (ms), and the fade itself (Tailwind duration below). */
const STAY = 6500
const FADE = 'duration-[1400ms]'

type Labels = { group: string; pause: string; play: string; slides: string[] }

const REDUCE = '(prefers-reduced-motion: reduce)'
const onReduceChange = (fn: () => void) => {
  const q = window.matchMedia(REDUCE)
  q.addEventListener('change', fn)
  return () => q.removeEventListener('change', fn)
}

/**
 * #187: cycles the hero photos. `children` is the server-rendered first photo (the LCP image, in the HTML as before);
 * `slides` are the following photos as server-rendered <Picture>s that only enter the DOM one ahead, after the page has
 * loaded and gone idle, so they never compete with the first. Autoplay stops for reduced motion, on hover or focus in
 * the hero (keyboard focus), while the tab is hidden or the hero is off screen, and with the pause button (WCAG 2.2.2).
 */
export function HeroSlides({ children, slides, labels }: { children: ReactNode; slides: ReactNode[]; labels: Labels }) {
  const total = slides.length + 1
  const root = useRef<HTMLDivElement>(null)
  const layers = useRef<(HTMLDivElement | null)[]>([])
  const [active, setActive] = useState(0)
  const [prev, setPrev] = useState<number | null>(null)
  // Layers whose photo is in the DOM / decoded; 0 is the server-rendered one.
  const [mounted, setMounted] = useState<ReadonlySet<number>>(() => new Set([0]))
  const [ready, setReady] = useState<ReadonlySet<number>>(() => new Set([0]))
  // Has the show come round to a layer again (layer 0 first appears with its own settle, not the drift)?
  const [shown, setShown] = useState<ReadonlySet<number>>(() => new Set())
  // Reduced motion: no autoplay unless the visitor presses play (the server renders the playing state).
  const reduced = useSyncExternalStore(onReduceChange, () => window.matchMedia(REDUCE).matches, () => false)
  const [choice, setChoice] = useState<boolean | null>(null)
  const playing = choice ?? !reduced
  const [held, setHeld] = useState({ hover: false, focus: false, hidden: false, offscreen: false })
  const running = playing && !held.hover && !held.focus && !held.hidden && !held.offscreen
  // Time left on the current photo, so a pause resumes where it stopped instead of starting over.
  const left = useRef({ index: 0, ms: STAY })
  const pending = useRef<number | null>(null)
  const swipeX = useRef<number | null>(null)
  const dots = useRef<(HTMLButtonElement | null)[]>([])

  const mount = useCallback((i: number) => setMounted((m) => (m.has(i) ? m : new Set(m).add(i))), [])

  const goTo = useCallback(
    (i: number) => {
      if (i === active) return
      left.current = { index: i, ms: STAY }
      pending.current = null
      setPrev(active)
      // The incoming photo: layer 0 drifts only once it comes round again (it entered with its own settle).
      setShown((s) => new Set(s).add(i))
      setActive(i)
      mount(i)
      mount((i + 1) % total)
    },
    [active, mount, total],
  )

  const advance = useCallback(() => {
    const next = (active + 1) % total
    if (ready.has(next)) goTo(next)
    else {
      // Slow network: wait on the next photo rather than fading to its blurred placeholder.
      pending.current = next
      mount(next)
    }
  }, [active, total, ready, goTo, mount])

  useEffect(() => {
    if (pending.current !== null && ready.has(pending.current)) goTo(pending.current)
  }, [ready, goTo])

  // The second photo is fetched only after the page's load event and an idle moment.
  useEffect(() => {
    let idle = 0
    let timer = 0
    const start = () => {
      // Safari has no requestIdleCallback.
      if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(() => mount(1), { timeout: 3000 })
      else timer = window.setTimeout(() => mount(1), 1500)
    }
    if (document.readyState === 'complete') start()
    else window.addEventListener('load', start, { once: true })
    return () => {
      window.removeEventListener('load', start)
      if (idle) window.cancelIdleCallback(idle)
      window.clearTimeout(timer)
    }
  }, [mount])

  // A photo counts as ready once decoded, so the crossfade never shows it half-painted.
  useEffect(() => {
    for (const i of mounted) {
      if (ready.has(i)) continue
      const img = layers.current[i]?.querySelector('img')
      if (!img) continue
      const done = () => void img.decode().catch(() => undefined).then(() => setReady((r) => new Set(r).add(i)))
      if (img.complete && img.naturalWidth) done()
      else img.addEventListener('load', done, { once: true })
    }
  }, [mounted, ready])

  // Hover, focus, a hidden tab and an off-screen hero hold the show; leaving them lets it run on.
  useEffect(() => {
    const hero = root.current?.closest('section') ?? root.current
    if (!hero) return
    const hold = (k: keyof typeof held, v: boolean) => setHeld((h) => (h[k] === v ? h : { ...h, [k]: v }))
    const enter = (e: globalThis.PointerEvent) => e.pointerType === 'mouse' && hold('hover', true)
    const leave = (e: globalThis.PointerEvent) => e.pointerType === 'mouse' && hold('hover', false)
    // Keyboard focus only: a mouse click on a control focuses it too, and must not stop the show for good.
    const focusIn = (e: FocusEvent) => (e.target as Element).matches(':focus-visible') && hold('focus', true)
    const focusOut = (e: FocusEvent) => !hero.contains(e.relatedTarget as Node | null) && hold('focus', false)
    const visibility = () => hold('hidden', document.hidden)
    const io = new IntersectionObserver(([e]) => hold('offscreen', !e!.isIntersecting))
    hero.addEventListener('pointerenter', enter)
    hero.addEventListener('pointerleave', leave)
    hero.addEventListener('focusin', focusIn)
    hero.addEventListener('focusout', focusOut)
    document.addEventListener('visibilitychange', visibility)
    io.observe(hero)
    return () => {
      hero.removeEventListener('pointerenter', enter)
      hero.removeEventListener('pointerleave', leave)
      hero.removeEventListener('focusin', focusIn)
      hero.removeEventListener('focusout', focusOut)
      document.removeEventListener('visibilitychange', visibility)
      io.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!running) return
    const since = performance.now()
    const timer = window.setTimeout(advance, left.current.ms)
    return () => {
      window.clearTimeout(timer)
      // Only a pause of this same photo keeps its remaining time; goTo already reset it for the next one.
      if (left.current.index === active) left.current.ms = Math.max(0, left.current.ms - (performance.now() - since))
    }
  }, [running, active, advance])

  const toggle = () => {
    // An explicit play wins over the hover/focus that the click itself causes.
    if (!playing) setHeld((h) => ({ ...h, hover: false, focus: false }))
    setChoice(!playing)
  }

  // The indicators are one tab stop (the current one); arrow keys move along them, mirrored in RTL like the row.
  const onDotKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const rtl = getComputedStyle(e.currentTarget).direction === 'rtl'
    const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[e.key]
    const to = e.key === 'Home' ? 0 : e.key === 'End' ? total - 1 : step === undefined ? null : (active + step + total) % total
    if (to === null) return
    e.preventDefault()
    goTo(to)
    dots.current[to]?.focus()
  }

  // Dragging the photo sideways: toward the start brings the next one (mirrored in RTL), as in the lightbox.
  const onPointerUp = (e: PointerEvent) => {
    if (swipeX.current === null) return
    const dx = e.clientX - swipeX.current
    swipeX.current = null
    if (Math.abs(dx) < 50) return
    const rtl = root.current ? getComputedStyle(root.current).direction === 'rtl' : false
    goTo((active + ((dx < 0) !== rtl ? 1 : total - 1)) % total)
  }

  return (
    <div
      ref={root}
      role="group"
      aria-roledescription="carousel"
      aria-label={labels.group}
      className="absolute inset-0 touch-pan-y"
      onPointerDown={(e) => (swipeX.current = e.clientX)}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (swipeX.current = null)}
    >
      <div aria-live={running ? 'off' : 'polite'} className="absolute inset-0 overflow-hidden">
        {[children, ...slides].map((slide, i) => {
          const on = i === active
          const drift = (on || i === prev) && (i !== 0 || shown.has(0))
          return (
            <div
              key={i}
              ref={(el) => void (layers.current[i] = el)}
              aria-hidden={!on}
              data-slide={i}
              className={`absolute inset-0 transition-opacity ease-in-out ${FADE} ${on ? 'z-[2] opacity-100' : i === prev ? 'z-[1] opacity-100' : 'opacity-0'} ${drift ? 'motion-safe:animate-drift' : ''} ${on || i === prev ? 'will-change-[opacity,transform]' : ''}`}
            >
              {i === 0 || mounted.has(i) ? slide : null}
            </div>
          )
        })}
      </div>

      {/* Phones: just under the photo, on the Ink text ground (the Hero leaves room above the H1), so they cover none of
          the work. From md the text block sits on the photo's foot, so they float at its top corner on the container's
          end edge (Container: max-w-7xl, md:px-6), in a lightbox-style Ink pill. 44px targets. */}
      <div className="absolute start-1 top-full z-[3] mt-1 flex max-w-[calc(100%-0.5rem)] items-center text-white md:start-auto md:end-[max(1.5rem,calc((100%-80rem)/2+1.5rem))] md:top-6 md:mt-0 md:rounded-full md:bg-ink/75 md:shadow-[var(--shadow-float)]">
        <button type="button" onClick={toggle} aria-label={playing ? labels.pause : labels.play} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/15">
          {playing ? <Pause aria-hidden size={18} strokeWidth={1.75} /> : <Play aria-hidden size={18} strokeWidth={1.75} />}
        </button>
        {labels.slides.map((label, i) => (
          <button
            key={i}
            ref={(el) => void (dots.current[i] = el)}
            type="button"
            tabIndex={i === active ? 0 : -1}
            onClick={() => goTo(i)}
            onKeyDown={onDotKey}
            aria-label={label}
            aria-current={i === active ? 'true' : undefined}
            className={`group size-11 shrink-0 items-center justify-center rounded-full ${i === active ? 'inline-flex' : 'hidden min-[22.5rem]:inline-flex'}`}
          >
            {/* The current photo's bar is longer, and fills while it shows; the others stay short. Every bar holds ≥3:1 on
                the Ink 75% pill over a white patch, and on Ink. Under 360px only the current one shows (44px targets). */}
            <span aria-hidden className={`relative h-[3px] overflow-hidden rounded-full transition-colors ${i === active ? 'w-7 bg-white/50' : 'w-3 bg-white/75 group-hover:bg-white'}`}>
              {i === active && (
                <span
                  key={active}
                  className="absolute inset-0 origin-[left_center] rounded-full bg-white motion-safe:animate-progress rtl:origin-[right_center]"
                  style={{ animationDuration: `${STAY}ms`, animationPlayState: running ? 'running' : 'paused' }}
                />
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
