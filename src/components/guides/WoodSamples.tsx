import { getTranslations } from 'next-intl/server'

import { shownSamples, type WoodKey } from '@/lib/wood/samples'

import { WoodSamplesLazy } from './WoodSamplesLazy'

/**
 * Server wrapper for the samples block, rendered only when a guide body holds it. The island behind WoodSamplesLazy
 * then ships only with those guides.
 */
export default async function WoodSamples() {
  const t = await getTranslations('WoodSamples')
  const names: Partial<Record<WoodKey, string>> = Object.fromEntries(
    shownSamples().map((s) => [s.key, t(`names.${s.key}`)]),
  )
  return (
    <WoodSamplesLazy
      labels={{
        title: t('title'),
        hint: t('hint'),
        note: t('note'),
        roledescription: t('roledescription'),
        names,
      }}
    />
  )
}
