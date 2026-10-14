import { getTranslations } from 'next-intl/server'
import type { ComponentProps } from 'react'

import { GALLERY_LABELS, type GalleryLabels } from '@/lib/gallery/labels'

import { GalleryGridClient } from './GalleryGridClient'

/** Server wrapper: resolves the gallery's UI strings so the client grid needs no i18n runtime. */
export async function GalleryGrid(props: Omit<ComponentProps<typeof GalleryGridClient>, 'labels'>) {
  const t = await getTranslations('Gallery')
  const labels = Object.fromEntries(GALLERY_LABELS.map((k) => [k, t.raw(k) as string])) as GalleryLabels
  return <GalleryGridClient {...props} labels={labels} />
}
