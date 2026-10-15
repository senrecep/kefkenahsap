import { getTranslations } from 'next-intl/server'

import { buttonClass } from '@/components/ui/button'
import { Container } from '@/components/ui/Container'
import { Picture } from '@/components/ui/Picture'
import { WhatsAppButton } from '@/components/ui/WhatsAppButton'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { focalPosition, portraitOf, type MediaLike } from '@/lib/media/image'

/** First viewport: full-bleed real job photo, bottom-left H1 + one sentence + WhatsApp / Teklif al on a bottom scrim. */
export async function Hero({ locale, image, mobileImage, heading, subheading, priority = true, first = true }: { locale: Locale; image: MediaLike | null; mobileImage?: MediaLike | null; heading?: string | null; subheading?: string | null; priority?: boolean; first?: boolean }) {
  const t = await getTranslations('Home')
  const tCta = await getTranslations('Cta')
  // One h1 per page: only the first hero's title; a second hero block is a section (h2) styled the same.
  const Title = first ? 'h1' : 'h2'
  return (
    // Phones stack the photo over the text on Ink: the H1 never covers the work (or the watermark) at the photo's foot.
    // From md the text sits on the photo, over the scrim.
    <section className="relative isolate flex min-h-[max(30rem,calc(100svh-4.5rem))] flex-col justify-end overflow-hidden bg-ink text-white md:h-[78vh] md:max-h-[56rem] md:min-h-[30rem]">
      {image && (
        <div
          className="relative min-h-56 flex-1 overflow-hidden md:absolute md:inset-0 md:-z-10"
          // Without an editor's focal point: low on desktop (full width, the worked surface sits low); a little higher in
          // the phone's near-square box, which shows ~60% of the height and would otherwise frame the lawn under the deck.
          style={{ ['--focal' as string]: focalPosition(image), ['--focal-sm' as string]: focalPosition(mobileImage ?? image, '50% 66%') }}
        >
          {/* A landscape photo covers the hero at more CSS px than sizes="100vw" says: never below w960 (w800 was
              visibly softer, #129). On phones a portrait (`mobileImage`, else the photo's own 9:16 crop, cut around the
              focal point at upload) fills the box instead, at a third of the bytes. Both frame on the focal point. */}
          <Picture
            media={image}
            mobile={mobileImage ?? portraitOf(image)}
            sizes="100vw"
            minWidth={960}
            priority={priority}
            className="absolute! inset-0 h-full !aspect-auto motion-safe:animate-settle"
            imgClassName="object-[var(--focal-sm)] md:object-[var(--focal)]"
          />
        </div>
      )}
      <div className="relative w-full">
        {/* md+: scrim anchored to the text block, not the section: 0.64 ink under the H1 and subline keeps white text ≥4.5:1 even over a white patch or the watermark, at any viewport height; it fades out over 6rem above the H1. */}
        <div aria-hidden className="absolute inset-x-0 -top-24 bottom-0 -z-10 hidden motion-safe:animate-scrim bg-[linear-gradient(to_top,rgb(29_31_28/0.64)_calc(100%-6rem),transparent)] md:block" />
        <Container className="pt-7 pb-24 md:pt-0 lg:pb-16">
          <Title className="max-w-[22ch] text-[clamp(2.1rem,5vw,3.6rem)] leading-[1.08] text-white">{heading || t('heroTitle')}</Title>
          <p className="mt-4 max-w-[52ch] text-[1.0625rem] text-white/85 md:text-lg md:text-white">{subheading || t('heroText')}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <WhatsAppButton locale={locale} place="hero" />
            <Link href="/iletisim" className={buttonClass.onPhoto}>
              {tCta('quote')}
            </Link>
          </div>
        </Container>
      </div>
    </section>
  )
}

/** The page title when no hero renders (none enabled, or it failed): the homepage still has its h1 and one-line pitch. */
export async function HomeTitle() {
  const t = await getTranslations('Home')
  return (
    <Container as="header" className="pt-10 md:pt-16">
      <h1 className="max-w-[22ch] text-[clamp(2rem,4vw,3rem)] leading-[1.15] tracking-[-0.025em]">{t('heroTitle')}</h1>
      <p className="mt-4 max-w-[52ch] text-[1.0625rem] text-ink-soft md:text-lg">{t('heroText')}</p>
    </Container>
  )
}
