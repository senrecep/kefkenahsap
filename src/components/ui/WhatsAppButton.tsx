import { MessageCircle } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import type { Locale } from '@/i18n/routing'
import { waLink, type WaContext } from '@/lib/contact'
import { getSiteSettings } from '@/lib/data/site'

import { buttonClass, type ButtonVariant } from './button'

/** WhatsApp CTA with a page-specific prefilled message; renders nothing when no mobile number is configured. */
export async function WhatsAppButton({
  locale,
  context,
  place,
  variant = 'whatsapp',
  label,
  className = '',
}: {
  locale: Locale
  context?: WaContext
  place: string
  variant?: ButtonVariant
  label?: string
  className?: string
}) {
  const [t, settings] = await Promise.all([getTranslations('Cta'), getSiteSettings(locale)])
  const href = waLink(settings, context)
  if (!href) return null
  return (
    <a href={href} target="_blank" rel="noopener" data-umami-event="whatsapp_click" data-umami-event-place={place} className={`${buttonClass[variant]} ${className}`}>
      <MessageCircle aria-hidden size={20} strokeWidth={1.75} />
      {label ?? t('whatsapp')}
    </a>
  )
}
