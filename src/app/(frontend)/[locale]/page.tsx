import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Hero } from '@/components/home/Hero'
import { Contact, Faq, FeaturedGallery, FeaturedProjects, Process, References, Services, WoodTypes } from '@/components/home/Sections'
import { getPathname } from '@/i18n/navigation'
import { routing, type Locale } from '@/i18n/routing'
import { getHeroFallback, getHomepage } from '@/lib/data/home'
import { getSiteSettings } from '@/lib/data/site'
import { homeSections } from '@/lib/home/sections'
import { buildAlternates, siteUrl } from '@/lib/seo/alternates'
import type { Homepage } from '@/payload-types'

type Props = { params: Promise<{ locale: Locale }> }
type Block = NonNullable<Homepage['layout']>[number]
// Fields of a block the admin saved; empty for a default-order section.
type Fields<T extends Block['blockType']> = Partial<Extract<Block, { blockType: T }>>

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const [t, settings] = await Promise.all([getTranslations({ locale, namespace: 'Home' }), getSiteSettings(locale)])
  const paths = Object.fromEntries(routing.locales.map((l) => [l, getPathname({ locale: l, href: '/' })]))
  return {
    title: { absolute: t('metaTitle') },
    description: settings.defaultDescription || t('heroText'),
    alternates: buildAlternates({ current: locale, paths, site: siteUrl() }),
  }
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const homepage = await getHomepage(locale)
  // A never-published (draft-only) homepage keeps the default sections.
  const sections = homeSections(homepage._status === 'published' ? homepage.layout : undefined)
  const needsFallback = sections.some((s) => s.blockType === 'hero' && !(s as Fields<'hero'>).image)
  const fallback = needsFallback ? await getHeroFallback(locale) : null

  return sections.map((s, i) => {
    const key = ('id' in s && s.id) || `${s.blockType}-${i}`
    switch (s.blockType) {
      case 'hero': {
        const b = s as Fields<'hero'>
        const image = b.image && typeof b.image === 'object' ? b.image : (fallback?.media ?? null)
        return <Hero key={key} locale={locale} image={image} heading={b.heading} subheading={b.subheading} />
      }
      case 'featuredGallery': {
        const b = s as Fields<'featuredGallery'>
        return <FeaturedGallery key={key} locale={locale} heading={b.heading} limit={'id' in b ? b.limit : 12} />
      }
      case 'services':
        return <Services key={key} locale={locale} heading={(s as Fields<'services'>).heading} />
      case 'featuredProjects':
        return <FeaturedProjects key={key} locale={locale} heading={(s as Fields<'featuredProjects'>).heading} />
      case 'process': {
        const b = s as Fields<'process'>
        return <Process key={key} heading={b.heading} steps={b.steps} />
      }
      case 'references':
        return <References key={key} locale={locale} heading={(s as Fields<'references'>).heading} />
      case 'woodTypes':
        return <WoodTypes key={key} heading={(s as Fields<'woodTypes'>).heading} />
      case 'faq': {
        const b = s as Fields<'faq'>
        return <Faq key={key} heading={b.heading} items={b.items} />
      }
      case 'contact':
        return <Contact key={key} locale={locale} heading={(s as Fields<'contact'>).heading} />
      default:
        return null
    }
  })
}
