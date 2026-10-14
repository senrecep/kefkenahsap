import { getTranslations } from 'next-intl/server'

import { buttonClass } from '@/components/ui/button'
import { Container } from '@/components/ui/Container'
import { WhatsAppButton } from '@/components/ui/WhatsAppButton'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { areaLine } from '@/lib/company'
import type { WaContext } from '@/lib/contact'
import { getSiteSettings } from '@/lib/data/site'

/** Closing WhatsApp + Teklif al band. Rendered last in <main>; the footer then drops its top margin (data-end-band). */
export async function CtaBand({ locale, title, wa, place }: { locale: Locale; title?: string; wa?: WaContext; place: string }) {
  const [t, tCta, settings] = await Promise.all([getTranslations('Category'), getTranslations('Cta'), getSiteSettings(locale)])
  const areas = areaLine(settings.areaServed, locale, (country) => t('nationwide', { country }))
  return (
    <section data-end-band aria-labelledby="cta-h" className="mt-16 border-t border-line bg-mist md:mt-20">
      <Container className="flex flex-col gap-6 py-12 md:flex-row md:items-center md:justify-between md:py-14">
        <div>
          <h2 id="cta-h" className="text-[1.5rem] md:text-[1.85rem]">
            {title ?? t('ctaTitleGeneric')}
          </h2>
          <p className="mt-2 max-w-[56ch] text-ink-soft">{t('ctaText')}</p>
          {areas && <p className="mt-3 max-w-[56ch] text-[0.95rem] text-ink-soft">{t('areas', { areas })}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          <WhatsAppButton locale={locale} context={wa} place={place} />
          <Link href="/iletisim" className={buttonClass.outline}>
            {tCta('quote')}
          </Link>
        </div>
      </Container>
    </section>
  )
}
