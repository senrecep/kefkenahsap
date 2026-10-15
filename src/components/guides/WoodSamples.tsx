import { getTranslations } from 'next-intl/server'

import { getPathname } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'
import { getApprovedPhotoSlugs } from '@/lib/data/guides'
import { shownSamples } from '@/lib/wood/samples'

import { WoodSamplesLazy } from './WoodSamplesLazy'

/**
 * Server wrapper for the samples block, rendered only when a guide body holds it. The island behind WoodSamplesLazy
 * then ships only with those guides. Each sample carries one fact line (from the guide's comparison table) and a link to
 * the job photo its texture was cut from, while that photo is approved (else no link, never a 404).
 */
export default async function WoodSamples({ locale }: { locale: Locale }) {
  const t = await getTranslations('WoodSamples')
  const samples = shownSamples()
  const approved = new Set(await getApprovedPhotoSlugs(samples.map((s) => s.photo)))
  return (
    <WoodSamplesLazy
      labels={{ title: t('title'), hint: t('hint'), note: t('note'), roledescription: t('roledescription') }}
      samples={samples.map((s) => ({
        key: s.key,
        texture: s.texture,
        name: t(`names.${s.key}`),
        fact: t(`facts.${s.key}`),
        source: approved.has(s.photo) ? { label: t('source'), href: getPathname({ locale, href: { pathname: '/galeri/[slug]', params: { slug: s.photo } } }) } : undefined,
      }))}
    />
  )
}
