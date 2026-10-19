// Loaded on the first "Görsel olarak paylaş" click only (dynamic import in Calculator.tsx).
import { ISTANBUL } from '@/lib/calc/format'
import type { Quote, QuoteInput } from '@/lib/calc/quote'

import { buildSheet, type SheetLine } from './sheet'
import type { CalcUi } from './ui'

const W = 1080
const PAD = 72
const INK = '#1d1f1c'
const SOFT = '#5c5f58'
const LINE = '#e4e1da'
const PAPER = '#fbfaf7'
const VALUE_W = 300 // room kept at the inline end for amounts

type Args = { state: QuoteInput; quote: Quote; ui: CalcUi; locale: string; date: Date; logoSrc: string; rtl: boolean }

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })

/**
 * The quote as a branded PNG (Canvas 2D, no dependency): logo, faint watermark, Istanbul time, the lines and totals,
 * the "estimate" line and the site address. The browser shapes the text, so Turkish and Arabic (RTL) render natively;
 * the page's own fonts are loaded for exactly the characters drawn before drawing.
 */
export async function renderQuoteImage(a: Args): Promise<Blob> {
  const s = buildSheet(a.state, a.quote, a.ui, a.locale, a.date)
  const css = getComputedStyle(document.documentElement)
  const display = css.getPropertyValue('--font-display').trim() || 'sans-serif'
  const body = css.getPropertyValue('--font-body').trim() || 'sans-serif'
  const lines = [...s.timber, ...s.extras, ...s.totals, s.grand]
  const text = [s.title, s.customer, s.note, s.stamp, a.ui.timber, a.ui.extras, ...lines.flatMap((l) => [l.text, l.sub, l.value]), ...s.footer].filter(Boolean).join(' ')
  // Each face on its own and failures ignored: a metric-fallback face (local Arial) missing on the device rejects the
  // whole load, and the text then still draws with the faces that did load.
  const faces = (list: string, weight: number) =>
    list.split(',').map((f) => f.trim()).filter((f) => f && !/^(ui-sans-serif|system-ui|sans-serif)$/.test(f)).map((f) => document.fonts.load(`${weight} 32px ${f}`, text))
  // Never wait on fonts for more than 3 s: a stalled face must not block the export (it then draws with a fallback).
  const fonts = Promise.race([Promise.allSettled([...faces(display, 600), ...faces(body, 400)]), new Promise((r) => setTimeout(r, 3000))])
  const [logo] = await Promise.all([loadImage(a.logoSrc), fonts])

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = draw(canvas.getContext('2d')!, true) // measure, then draw at the real height
  draw(canvas.getContext('2d')!, false)
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'))

  function draw(ctx: CanvasRenderingContext2D, dry: boolean): number {
    const xs = a.rtl ? W - PAD : PAD // inline start
    const xe = a.rtl ? PAD : W - PAD // inline end
    ctx.direction = a.rtl ? 'rtl' : 'ltr'
    ctx.textBaseline = 'alphabetic'
    let y = PAD
    const font = (weight: number, size: number, face = body) => (ctx.font = `${weight} ${size}px ${face}`)
    const say = (t: string, x: number, align: CanvasTextAlign, color: string) => {
      if (dry) return
      ctx.fillStyle = color
      ctx.textAlign = align
      ctx.fillText(t, x, y)
    }
    const wrap = (t: string, max: number) => {
      const out: string[] = []
      for (const para of t.split('\n')) {
        let cur = ''
        for (const word of para.split(' ')) {
          const next = cur ? `${cur} ${word}` : word
          if (cur && ctx.measureText(next).width > max) {
            out.push(cur)
            cur = word
          } else cur = next
        }
        out.push(cur)
      }
      return out
    }
    const para = (t: string, color: string, lh: number) => {
      for (const l of wrap(t, W - 2 * PAD)) {
        y += lh
        say(l, xs, 'start', color)
      }
    }
    const rule = (color: string, h = 2) => {
      if (!dry) {
        ctx.fillStyle = color
        ctx.fillRect(PAD, y, W - 2 * PAD, h)
      }
    }

    if (!dry) {
      ctx.fillStyle = PAPER
      ctx.fillRect(0, 0, W, ctx.canvas.height)
      // Watermark: the logo, centred and faint.
      const ww = W * 0.7
      const wh = (ww * logo.naturalHeight) / logo.naturalWidth
      ctx.globalAlpha = 0.06
      ctx.drawImage(logo, (W - ww) / 2, (ctx.canvas.height - wh) / 2, ww, wh)
      ctx.globalAlpha = 1
    }

    // Header: logo at the inline-start corner, date and time at the other.
    const lh = 64
    const lw = (lh * logo.naturalWidth) / logo.naturalHeight
    if (!dry) ctx.drawImage(logo, a.rtl ? W - PAD - lw : PAD, y, lw, lh)
    if (s.stamp) {
      font(400, 24)
      y += 40
      say(s.stamp, xe, 'end', SOFT)
      y -= 40
    }
    y += lh + 28
    rule(INK, 3)
    y += 24

    font(600, 46, display)
    para(s.title, INK, 56)
    if (s.customer) {
      font(400, 28)
      para(s.customer, INK, 40)
    }
    if (s.note) {
      font(400, 24)
      para(s.note, SOFT, 34)
    }

    const block = (title: string, ls: SheetLine[]) => {
      if (!ls.length) return
      y += 36
      font(600, 30, display)
      y += 34
      say(title, xs, 'start', INK)
      y += 14
      rule(LINE)
      for (const l of ls) {
        y += 10
        font(400, 26)
        const first = y
        for (const t of wrap(l.text, W - 2 * PAD - VALUE_W)) {
          y += 36
          say(t, xs, 'start', INK)
        }
        if (l.sub) {
          font(400, 22)
          y += 30
          say(l.sub, xs, 'start', SOFT)
        }
        const end = y
        y = first + 36
        font(600, 26)
        say(l.value, xe, 'end', INK)
        y = end + 14
        rule(LINE)
      }
    }
    block(a.ui.timber, s.timber)
    block(a.ui.extras, s.extras)

    // Totals
    y += 28
    for (const l of s.totals) {
      y += 38
      font(l.strong ? 600 : 400, 26, l.strong ? display : body)
      say(l.text, xs, 'start', l.strong ? INK : SOFT)
      font(l.strong ? 600 : 400, 26, l.strong ? display : body)
      say(l.value, xe, 'end', INK)
      y += 14
      rule(LINE)
    }
    y += 16
    rule(INK, 3)
    y += 56
    font(600, 30, display)
    say(s.grand.text, xs, 'start', INK)
    font(600, 44, display)
    say(s.grand.value, xe, 'end', INK)

    // Footer
    y += 40
    rule(LINE)
    y += 8
    font(400, 22)
    s.footer.forEach((f, i) => para(f, i === s.footer.length - 1 ? '#0b7a3e' : SOFT, 32))
    return Math.ceil(y + PAD)
  }
}

/** File name in Istanbul time: kefken-hesap-2026-10-19-1433.png */
export function fileName(date: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: ISTANBUL, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  )
  return `kefken-hesap-${p.year}-${p.month}-${p.day}-${p.hour}${p.minute}.png`
}

/** Phones: the share sheet with the file (WhatsApp…); elsewhere, or when sharing files is unsupported, a download. */
export async function shareOrDownload(blob: Blob, date: Date, title: string) {
  const file = new File([blob], fileName(date), { type: 'image/png' })
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title })
      return
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return // the user closed the sheet
    }
  }
  const url = URL.createObjectURL(blob)
  const link = Object.assign(document.createElement('a'), { href: url, download: file.name })
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
