'use client'

import { CheckCircle2, ImagePlus, MessageCircle } from 'lucide-react'
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'

import { buttonClass } from '@/components/ui/button'
import { LEAD_PHOTO_TYPES, MAX_PHOTOS } from '@/lib/leads/validate'
import { fitWithin } from '@/lib/media/galeri'

import { submitLead, type LeadField, type LeadFormState } from './actions'

type Turnstile = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  reset: (id: string) => void
}
declare global {
  interface Window {
    turnstile?: Turnstile
    umami?: { track: (event: string, data?: Record<string, string>) => void }
  }
}

const MAX_EDGE = 2560

const toBlob = (canvas: HTMLCanvasElement, type: string, quality = 0.85) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))

/** Downscale to ≤2560px and re-encode (drops EXIF/GPS) — same approach as the admin Galeri upload. */
async function prepare(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_EDGE)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  // Safari can't encode WebP and silently returns PNG; JPEG keeps the upload small there.
  let blob = await toBlob(canvas, 'image/webp')
  if (blob?.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg')
  // Busy photos can stay large at q0.85; one more pass keeps 5 photos under the 16 MB request limit.
  if (blob && blob.size > 3 * 1024 * 1024) blob = (await toBlob(canvas, blob.type, 0.7)) ?? blob
  if (!blob) throw new Error('encode failed')
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'foto'}.${ext}`, { type: blob.type })
}

const field =
  'block w-full rounded-[var(--radius-control)] border border-ink/25 bg-white px-3.5 py-3 text-base text-ink placeholder:text-ink-soft/80 focus:border-action aria-[invalid=true]:border-error'
const labelCls = 'mb-1.5 block font-[family-name:var(--font-display)] text-sm font-semibold text-ink'

/** Form copy translated on the server, so the page ships no i18n runtime (JS budget, #52). */
export type ContactCopy = {
  /** Plain `Contact.*` messages by key, including `errors.<Code>`. */
  text: Record<string, string>
  /** `Contact.photosSelected` for 1…MAX_PHOTOS photos (index = count − 1). */
  photosSelected: string[]
  consent: ReactNode
}

export function ContactForm({
  copy,
  locale,
  siteKey,
  services,
  whatsappHref,
  sourcePage,
}: {
  copy: ContactCopy
  locale: string
  siteKey?: string
  services: string[]
  whatsappHref: string | null
  sourcePage: string
}) {
  const t = (key: string) => copy.text[key] ?? key
  const [state, dispatch, pending] = useActionState<LeadFormState, FormData>(submitLead, { status: 'idle' })
  const [photoState, setPhotoState] = useState<{ count: number; preparing: boolean; error?: string }>({ count: 0, preparing: false })
  const formRef = useRef<HTMLFormElement>(null)
  // Read on the client so the page itself stays cached (#211); the server action keeps only the known utm_* keys.
  const [utm, setUtm] = useState<[string, string][]>([])
  useEffect(() => setUtm([...new URLSearchParams(window.location.search)].filter(([k]) => k.startsWith('utm_'))), [])
  const widgetRef = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  // interaction-only: the check usually passes unseen. The widget box only gets its margin while Turnstile actually shows
  // something (a challenge, then its success or error state), measured rather than inferred from callbacks (#156).
  const [shown, setShown] = useState(false)

  // Turnstile loads only on this page, when the visitor starts the form or nears the check (PLAN §9).
  useEffect(() => {
    const el = widgetRef.current
    const form = formRef.current
    if (!siteKey || !el || !form) return
    const render = () => {
      if (window.turnstile && !widgetId.current) widgetId.current = window.turnstile.render(el, {
          sitekey: siteKey,
          language: locale,
          theme: 'light',
          appearance: 'interaction-only',
        })
    }
    const load = () => {
      io.disconnect()
      form.removeEventListener('focusin', load)
      if (window.turnstile) return render()
      const s = document.createElement('script')
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      s.async = true
      s.onload = render
      document.head.appendChild(s)
    }
    // The box has height only while Turnstile shows something; the margin follows it.
    const ro = new ResizeObserver(() => setShown(el.offsetHeight > 0))
    ro.observe(el)
    const io = new IntersectionObserver(([entry]) => entry?.isIntersecting && load(), { rootMargin: '200px' })
    // The widget box is hidden until a challenge, so watch the submit button for "nears the check".
    io.observe(form.querySelector('button[type="submit"]') ?? form)
    form.addEventListener('focusin', load)
    return () => {
      ro.disconnect()
      io.disconnect()
      form.removeEventListener('focusin', load)
    }
  }, [siteKey, locale])

  useEffect(() => {
    if (state.status === 'success') window.umami?.track('form_submit', { locale })
  }, [state, locale])

  // After a failed send: a used Turnstile token can't be reused, and focus moves to the first problem.
  useEffect(() => {
    if (state.status !== 'error') return
    if (state.form && widgetId.current) {
      window.turnstile?.reset(widgetId.current)
    }
    const first = (['name', 'phone', 'email', 'consent', 'message', 'photos'] as LeadField[]).find((f) => state.fields?.[f])
    if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus()
  }, [state])

  async function onPhotos(input: HTMLInputElement) {
    const picked = Array.from(input.files ?? [])
    const tooMany = picked.length > MAX_PHOTOS
    setPhotoState({ count: 0, preparing: true })
    try {
      const ready = await Promise.all(picked.slice(0, MAX_PHOTOS).map(prepare))
      const dt = new DataTransfer()
      ready.forEach((f) => dt.items.add(f))
      input.files = dt.files
      setPhotoState({ count: ready.length, preparing: false, ...(tooMany ? { error: 'TooManyPhotos' } : {}) })
    } catch {
      input.value = ''
      setPhotoState({ count: 0, preparing: false, error: 'PhotoUnreadable' })
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    // Submit manually so React doesn't reset the fields when the server returns validation errors.
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(() => dispatch(fd))
  }

  if (state.status === 'success') {
    return (
      <div role="status" className="rounded-[var(--radius-photo)] border border-line bg-white p-6 md:p-8">
        <CheckCircle2 aria-hidden size={32} strokeWidth={1.75} className="text-action" />
        <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-semibold text-balance">{t('successTitle')}</h2>
        <p className="mt-2 text-lg text-ink-soft">{t('successBody')}</p>
        {whatsappHref && (
          <a href={whatsappHref} target="_blank" rel="noopener" data-umami-event="whatsapp_click" data-umami-event-place="contact-success" className={`${buttonClass.whatsapp} mt-6`}>
            <MessageCircle aria-hidden size={20} strokeWidth={1.75} />
            {t('successWhatsapp')}
          </a>
        )}
      </div>
    )
  }

  const err = (f: LeadField) => state.fields?.[f]
  const photoErr = err('photos') ?? photoState.error
  const describe = (f: string, hint?: boolean) => [hint && `${f}-hint`, (f === 'photos' ? photoErr : err(f as LeadField)) && `${f}-error`].filter(Boolean).join(' ') || undefined
  const errorText = (f: string, code?: string) =>
    code ? (
      <p id={`${f}-error`} className="mt-1.5 text-[0.95rem] font-semibold text-error">
        {t(`errors.${code}`)}
      </p>
    ) : null
  const label = (htmlFor: string, text: string, required = false) => (
    <label htmlFor={htmlFor} className={labelCls}>
      {text} <span className="font-[family-name:var(--font-body)] font-normal text-ink-soft">({required ? t('required') : t('optional')})</span>
    </label>
  )

  return (
    <form ref={formRef} action={dispatch} onSubmit={onSubmit} noValidate className="grid gap-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="sourcePage" value={sourcePage} />
      {utm.map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {/* Honeypot: hidden from people and assistive tech, tempting for bots. */}
      <div aria-hidden className="absolute -start-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="website">{t('honeypot')}</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div>
        {label('name', t('name'), true)}
        <input id="name" name="name" type="text" autoComplete="name" required aria-invalid={!!err('name')} aria-describedby={describe('name')} className={field} />
        {errorText('name', err('name'))}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          {label('phone', t('phoneLabel'), true)}
          {/* Numbers and addresses are typed left-to-right even on an RTL page; aligned with the RTL labels. */}
          <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required aria-invalid={!!err('phone')} aria-describedby={describe('phone', true)} dir="ltr" className={`${field} rtl:text-end`} />
          <p id="phone-hint" className="mt-1.5 text-[0.95rem] text-ink-soft">{t('phoneHint')}</p>
          {errorText('phone', err('phone'))}
        </div>
        <div>
          {label('email', t('emailLabel'))}
          <input id="email" name="email" type="email" autoComplete="email" aria-invalid={!!err('email')} aria-describedby={describe('email')} dir="ltr" className={`${field} rtl:text-end`} />
          {errorText('email', err('email'))}
        </div>
      </div>
      <div>
        {label('service', t('service'))}
        <select id="service" name="service" defaultValue="" className={field}>
          <option value="">{t('servicePlaceholder')}</option>
          {services.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
          <option value={t('serviceOther')}>{t('serviceOther')}</option>
        </select>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          {label('city', t('city'))}
          <input id="city" name="city" type="text" autoComplete="address-level1" className={field} />
        </div>
        <div>
          {label('district', t('district'))}
          <input id="district" name="district" type="text" autoComplete="address-level2" className={field} />
        </div>
      </div>
      <div>
        {label('message', t('message'))}
        <textarea id="message" name="message" rows={5} maxLength={5000} aria-invalid={!!err('message')} aria-describedby={describe('message', true)} className={field} />
        <p id="message-hint" className="mt-1.5 text-[0.95rem] text-ink-soft">{t('messageHint')}</p>
        {errorText('message', err('message'))}
      </div>
      <div>
        {label('photos', t('photos'))}
        <input
          id="photos"
          name="photos"
          type="file"
          accept={LEAD_PHOTO_TYPES.join(',')}
          multiple
          onChange={(e) => onPhotos(e.currentTarget)}
          aria-invalid={!!photoErr}
          aria-describedby={describe('photos', true)}
          className="peer sr-only"
        />
        {/* The native input stays focusable (visually hidden); this label is its visible button. */}
        <label htmlFor="photos" className={`${buttonClass.outline} cursor-pointer peer-focus-visible:focus-ring`}>
          <ImagePlus aria-hidden size={20} strokeWidth={1.75} />
          {t('photosChoose')}
        </label>
        <p id="photos-hint" className="mt-1.5 text-[0.95rem] text-ink-soft" aria-live="polite">
          {photoState.preparing ? t('photosPreparing') : photoState.count ? copy.photosSelected[photoState.count - 1] : t('photosHint')}
        </p>
        {errorText('photos', photoErr)}
      </div>
      <div>
        <div className="flex gap-3">
          <input
            id="consent"
            name="consent"
            type="checkbox"
            required
            aria-invalid={!!err('consent')}
            aria-describedby={describe('consent')}
            className="mt-1 size-5 shrink-0 accent-[var(--color-action)]"
          />
          <label htmlFor="consent" className="text-[0.98rem] leading-relaxed text-ink">
            {copy.consent}
          </label>
        </div>
        {errorText('consent', err('consent'))}
        {/* Inside the consent block so the empty, zero-height widget adds no grid gap; never display:none, or Turnstile stalls.
            No reserved height: the widget's own iframe sizes the box; leading-0 drops the line box under the inline widget. */}
        {siteKey && <div ref={widgetRef} className={`leading-[0] ${shown ? 'mt-5' : ''}`} />}
      </div>

      <div role="status" aria-live="polite" className="empty:hidden">
        {state.status === 'error' && (
          <div className="rounded-[var(--radius-control)] border border-error/40 bg-error-soft p-4 text-ink">
            <p className="font-semibold">{state.form ? t(`errors.${state.form}`) : t('errorsSummary')}</p>
            {state.form && whatsappHref && (
              <a href={whatsappHref} target="_blank" rel="noopener" data-umami-event="whatsapp_click" data-umami-event-place="contact-error" className={`${buttonClass.whatsapp} mt-3`}>
                <MessageCircle aria-hidden size={20} strokeWidth={1.75} />
                {t('whatsappAlt')}
              </a>
            )}
          </div>
        )}
      </div>

      <button type="submit" disabled={pending || photoState.preparing} className={`${buttonClass.primary} w-full sm:w-auto sm:justify-self-start`}>
        {pending ? t('sending') : t('submit')}
      </button>
    </form>
  )
}
