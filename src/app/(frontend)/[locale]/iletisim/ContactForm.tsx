'use client'

import { CheckCircle2, MessageCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from 'react'

import { Link } from '@/i18n/navigation'
import { buttonClass } from '@/components/ui/button'
import { MAX_PHOTOS } from '@/lib/leads/validate'

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

const toBlob = (canvas: HTMLCanvasElement, type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85))

/** Downscale to ≤2560px and re-encode (drops EXIF/GPS) — same approach as the admin Galeri upload. */
async function prepare(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  // Safari can't encode WebP and silently returns PNG; JPEG keeps the upload small there.
  let blob = await toBlob(canvas, 'image/webp')
  if (blob?.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg')
  if (!blob) throw new Error('encode failed')
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'foto'}.${ext}`, { type: blob.type })
}

const field =
  'block w-full rounded-[var(--radius-control)] border border-ink/25 bg-white px-3.5 py-3 text-base text-ink placeholder:text-ink-soft/80 focus:border-action focus:outline-2 focus:outline-offset-1 focus:outline-action aria-[invalid=true]:border-error'
const labelCls = 'mb-1.5 block font-[family-name:var(--font-display)] text-sm font-semibold text-ink'

export function ContactForm({
  locale,
  siteKey,
  services,
  whatsappHref,
  sourcePage,
  utm,
}: {
  locale: string
  siteKey?: string
  services: string[]
  whatsappHref: string | null
  sourcePage: string
  utm?: Record<string, string>
}) {
  const t = useTranslations('Contact')
  const [state, dispatch, pending] = useActionState<LeadFormState, FormData>(submitLead, { status: 'idle' })
  const [photoState, setPhotoState] = useState<{ count: number; preparing: boolean; error?: string }>({ count: 0, preparing: false })
  const formRef = useRef<HTMLFormElement>(null)
  const widgetRef = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)

  // Turnstile loads only on this page, when the visitor starts the form or nears the check (PLAN §9).
  useEffect(() => {
    const el = widgetRef.current
    const form = formRef.current
    if (!siteKey || !el || !form) return
    const render = () => {
      if (window.turnstile && !widgetId.current) widgetId.current = window.turnstile.render(el, { sitekey: siteKey, language: locale, theme: 'light' })
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
    const io = new IntersectionObserver(([entry]) => entry?.isIntersecting && load(), { rootMargin: '200px' })
    io.observe(el)
    form.addEventListener('focusin', load)
    return () => {
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
    if (state.form && widgetId.current) window.turnstile?.reset(widgetId.current)
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
      {Object.entries(utm ?? {}).map(([k, v]) => (
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
          <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required aria-invalid={!!err('phone')} aria-describedby={describe('phone', true)} className={field} />
          <p id="phone-hint" className="mt-1.5 text-[0.95rem] text-ink-soft">{t('phoneHint')}</p>
          {errorText('phone', err('phone'))}
        </div>
        <div>
          {label('email', t('emailLabel'))}
          <input id="email" name="email" type="email" autoComplete="email" aria-invalid={!!err('email')} aria-describedby={describe('email')} className={field} />
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
          accept="image/*"
          multiple
          onChange={(e) => onPhotos(e.currentTarget)}
          aria-invalid={!!photoErr}
          aria-describedby={describe('photos', true)}
          className="block w-full text-base text-ink-soft file:me-3 file:min-h-12 file:cursor-pointer file:rounded-[var(--radius-control)] file:border file:border-ink/20 file:bg-paper file:px-4 file:font-[family-name:var(--font-display)] file:text-sm file:font-semibold file:text-ink hover:file:bg-mist"
        />
        <p id="photos-hint" className="mt-1.5 text-[0.95rem] text-ink-soft" aria-live="polite">
          {photoState.preparing ? t('photosPreparing') : photoState.count ? t('photosSelected', { count: photoState.count }) : t('photosHint')}
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
            {t.rich('consent', {
              link: (chunks) => (
                <Link href="/kvkk" target="_blank" className="font-semibold text-action underline underline-offset-2 hover:text-action-deep">
                  {chunks}
                </Link>
              ),
            })}
          </label>
        </div>
        {errorText('consent', err('consent'))}
      </div>
      {siteKey && <div ref={widgetRef} className="min-h-[65px]" />}

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
