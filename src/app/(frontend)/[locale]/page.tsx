import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { ReactNode } from 'react'

import { Hero } from '@/components/home/Hero'
import { Contact, Faq, FeaturedGallery, FeaturedProjects, Process, References, Services, WoodTypes } from '@/components/home/Sections'
import type { Locale } from '@/i18n/routing'
import { getHeroFallback, getHomepage } from '@/lib/data/home'
import { getSiteSettings } from '@/lib/data/site'
import { homeSections } from '@/lib/home/sections'
import { pageMetadata, staticPaths } from '@/lib/seo/page-metadata'
import type { Homepage } from '@/payload-types'

type Props = { params: Promise<{ locale: Locale }> }
type Block = NonNullable<Homepage['layout']>[number]
// Fields of a block the admin saved; empty for a default-order section.
type Fields<T extends Block['blockType']> = Partial<Extract<Block, { blockType: T }>>

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const [t, settings] = await Promise.all([getTranslations({ locale, namespace: 'Home' }), getSiteSettings(locale)])
  return pageMetadata({
    locale,
    title: { absolute: t('metaTitle') },
    description: settings.defaultDescription || t('heroText'),
    paths: await staticPaths('/'),
  })
}

/** A section whose loader fails renders nothing instead of taking the whole page down. */
async function Isolated({ name, render }: { name: string; render: () => Promise<ReactNode> }) {
  try {
    return await render()
  } catch (err) {
    console.error(`homepage section "${name}" failed`, err)
    return null
  }
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const homepage = await getHomepage(locale).catch((err) => {
    console.error('homepage global failed; using default sections', err)
    return null
  })
  // A never-published (draft-only) homepage keeps the default sections.
  const sections = homeSections(homepage?._status === 'published' ? homepage.layout : undefined)
  const needsFallback = sections.some((s) => s.blockType === 'hero' && !(s as Fields<'hero'>).image)
  // Without any photo the hero still renders its text and buttons.
  const fallback = needsFallback ? await getHeroFallback(locale).catch(() => null) : null
  const firstHero = sections.findIndex((s) => s.blockType === 'hero')

  const render = (s: (typeof sections)[number], i: number): (() => Promise<ReactNode>) | null => {
    switch (s.blockType) {
      case 'hero': {
        const b = s as Fields<'hero'>
        const image = b.image && typeof b.image === 'object' ? b.image : (fallback?.media ?? null)
        // Read with overrideAccess: false, so an unapproved phone photo arrives as a bare id and is skipped.
        const mobileImage = b.mobileImage && typeof b.mobileImage === 'object' ? b.mobileImage : null
        return () => Hero({ locale, image, mobileImage, heading: b.heading, subheading: b.subheading, priority: i === firstHero })
      }
      case 'featuredGallery': {
        const b = s as Fields<'featuredGallery'>
        return () => FeaturedGallery({ locale, heading: b.heading, limit: b.limit })
      }
      case 'services':
        return () => Services({ locale, heading: (s as Fields<'services'>).heading })
      case 'featuredProjects':
        return () => FeaturedProjects({ locale, heading: (s as Fields<'featuredProjects'>).heading })
      case 'process': {
        const b = s as Fields<'process'>
        return () => Process({ heading: b.heading, steps: b.steps })
      }
      case 'references':
        return () => References({ locale, heading: (s as Fields<'references'>).heading })
      case 'woodTypes':
        return () => WoodTypes({ heading: (s as Fields<'woodTypes'>).heading })
      case 'faq': {
        const b = s as Fields<'faq'>
        return () => Faq({ heading: b.heading, items: b.items })
      }
      case 'contact':
        return () => Contact({ locale, heading: (s as Fields<'contact'>).heading })
      default:
        return null
    }
  }

  return sections.map((s, i) => {
    const fn = render(s, i)
    return fn ? <Isolated key={('id' in s && s.id) || `${s.blockType}-${i}`} name={s.blockType} render={fn} /> : null
  })
}
