import { FileText, MessageCircle, Phone } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { telLink, waLink, type WaContext } from '@/lib/contact'
import { getSiteSettings } from '@/lib/data/site'

import { PageWhatsAppLink } from './PageWhatsAppLink'

/** Small screens: WhatsApp · Ara · Teklif always one tap away (PLAN §6); WhatsApp follows the page's own message. */
export async function MobileActionBar({ locale, wa }: { locale: Locale; wa?: WaContext }) {
  const [t, settings] = await Promise.all([getTranslations('Cta'), getSiteSettings(locale)])
  const whatsapp = waLink(settings, wa)
  const tel = telLink(settings)
  const cell = 'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 font-[family-name:var(--font-display)] text-xs font-semibold'
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_20px_-12px_rgb(29_31_28/0.35)] lg:hidden">
      <div className="mx-auto flex max-w-xl">
        {whatsapp && (
          <PageWhatsAppLink href={whatsapp} className={`${cell} bg-action text-white hover:bg-action-deep`}>
            <MessageCircle aria-hidden size={22} strokeWidth={1.75} />
            {t('whatsappShort')}
          </PageWhatsAppLink>
        )}
        {tel && (
          <a href={tel.href} data-umami-event="phone_click" data-umami-event-place="mobile-bar" className={`${cell} text-ink`}>
            <Phone aria-hidden size={22} strokeWidth={1.75} />
            {t('call')}
          </a>
        )}
        <Link href="/iletisim" className={`${cell} text-ink`}>
          <FileText aria-hidden size={22} strokeWidth={1.75} />
          {t('quote')}
        </Link>
      </div>
    </div>
  )
}
