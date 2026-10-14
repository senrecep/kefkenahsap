import { getTranslations } from 'next-intl/server'

import { buttonClass } from '@/components/ui/button'
import { Container } from '@/components/ui/Container'
import { Picture } from '@/components/ui/Picture'
import { WhatsAppButton } from '@/components/ui/WhatsAppButton'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import type { MediaLike } from '@/lib/media/image'

/** First viewport: full-bleed real job photo, bottom-left H1 + one sentence + WhatsApp / Teklif al on a bottom scrim. */
export async function Hero({ locale, image, heading, subheading, priority = true }: { locale: Locale; image: MediaLike | null; heading?: string | null; subheading?: string | null; priority?: boolean }) {
  const t = await getTranslations('Home')
  const tCta = await getTranslations('Cta')
  return (
    <section className="relative isolate flex h-[calc(100svh-4.5rem)] min-h-[30rem] items-end overflow-hidden bg-ink text-white md:h-[78vh] md:max-h-[56rem]">
      {image && (
        <div className="absolute inset-0 -z-10">
          <Picture media={image} sizes="100vw" priority={priority} className="h-full !aspect-auto motion-safe:animate-settle" />
        </div>
      )}
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-3/4 motion-safe:animate-scrim bg-[linear-gradient(to_top,rgb(20_21_19/0.82),rgb(20_21_19/0.45)_45%,transparent)]" />
      <Container className="pb-24 lg:pb-16">
        <h1 className="max-w-[22ch] text-[clamp(2.1rem,5vw,3.6rem)] leading-[1.08] text-white">{heading || t('heroTitle')}</h1>
        <p className="mt-4 max-w-[52ch] text-[1.0625rem] text-white/90 md:text-lg">{subheading || t('heroText')}</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <WhatsAppButton locale={locale} place="hero" />
          <Link href="/iletisim" className={buttonClass.onPhoto}>
            {tCta('quote')}
          </Link>
        </div>
      </Container>
    </section>
  )
}
