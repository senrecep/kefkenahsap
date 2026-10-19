import { Maybe } from 'tsentials/maybe'

import { sinceYear } from '@/lib/company'

/**
 * schema.org builders (PLAN §7 Structured data). Callers pass the exact strings the page renders, so the
 * markup never says more than the visible text. Empty values are dropped (no claim without data).
 */

type Text = string | null | undefined
type Json = Record<string, unknown>

const CONTEXT = 'https://schema.org'
const businessId = (site: string) => `${site.replace(/\/$/, '')}/#business`
const websiteId = (site: string) => `${site.replace(/\/$/, '')}/#website`

/** Drops null/undefined/blank strings/empty arrays, and objects left with nothing but their @type (an @id reference stays). */
function compact<T>(v: T): T | undefined {
  if (v === null || v === undefined) return undefined
  if (typeof v === 'string') return (v.trim() ? v : undefined) as T | undefined
  if (Array.isArray(v)) {
    const a = v.map(compact).filter((x) => x !== undefined)
    return (a.length ? a : undefined) as T | undefined
  }
  if (typeof v === 'object') {
    const entries = Object.entries(v).map(([k, x]) => [k, compact(x)] as const).filter(([, x]) => x !== undefined)
    if (!entries.some(([k]) => k === '@id' || !k.startsWith('@'))) return undefined
    return Object.fromEntries(entries) as T
  }
  return v
}
const node = (o: Json) => compact({ '@context': CONTEXT, ...o }) as Json

/** JSON for a <script type="application/ld+json">: `<` and line separators escaped so it cannot end the script. */
export const safeJsonLd = (data: unknown) =>
  JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')

const DAYS = { Mo: 'Monday', Tu: 'Tuesday', We: 'Wednesday', Th: 'Thursday', Fr: 'Friday', Sa: 'Saturday', Su: 'Sunday' } as const

export type BusinessInput = {
  companyName: string
  foundingYear?: number | null
  founder?: { name?: Text } | null
  phones?: { number: string; label?: Text }[] | null
  email?: Text
  address?: { street?: Text; district?: Text; city?: Text; postalCode?: Text; country?: Text; lat?: number | null; lng?: number | null; mapUrl?: Text } | null
  hours?: { days?: readonly (keyof typeof DAYS)[] | null; opens: string; closes: string }[] | null
  social?: { instagram?: Text; facebook?: Text; googleBusiness?: Text } | null
}

/**
 * Site-wide HomeAndConstructionBusiness: only the siteSettings facts the footer shows on every page, plus hasMap (the
 * contact page's Google Maps link). areaServed is not shown there, so it is left out here; each category's Service
 * carries its visible areas line instead.
 */
export function businessJsonLd(s: BusinessInput, o: { site: string; url: string; logo?: string; image?: Text }) {
  const a = s.address
  const founded = sinceYear({ foundingYear: s.foundingYear })
  return node({
    '@type': 'HomeAndConstructionBusiness',
    '@id': businessId(o.site),
    name: s.companyName,
    url: o.url,
    logo: o.logo,
    image: o.image,
    telephone: s.phones?.[0]?.number,
    email: s.email,
    foundingDate: Maybe.isSome(founded) ? String(founded.value) : undefined,
    founder: { '@type': 'Person', name: s.founder?.name },
    address: a && {
      '@type': 'PostalAddress',
      streetAddress: a.street,
      addressLocality: a.district,
      addressRegion: a.city,
      postalCode: a.postalCode,
      addressCountry: a.country,
    },
    // The footer prints the address on every page only when a street is set; the pin belongs to that visible address.
    geo: a?.street?.trim() && typeof a.lat === 'number' && typeof a.lng === 'number' ? { '@type': 'GeoCoordinates', latitude: a.lat, longitude: a.lng } : undefined,
    hasMap: a?.street?.trim() && a.mapUrl ? a.mapUrl : undefined,
    openingHoursSpecification: s.hours?.map((h) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: (h.days ?? []).map((d) => DAYS[d]), opens: h.opens, closes: h.closes })),
    sameAs: [s.social?.instagram, s.social?.facebook, s.social?.googleBusiness],
  })
}

/** WebSite node (SearchAction retired in 2024: not added). */
export const websiteJsonLd = (o: { name: string; site: string; url: string; locale: string }) =>
  node({ '@type': 'WebSite', '@id': websiteId(o.site), name: o.name, url: o.url, inLanguage: o.locale, publisher: { '@id': businessId(o.site) } })

/** A free in-browser tool (the material and quote calculator, #233); no rating or price: none is shown on the page. */
export const webApplicationJsonLd = (o: { site: string; name: string; url: string; description?: Text; locale: string }) =>
  node({
    '@type': 'WebApplication',
    name: o.name,
    url: o.url,
    description: o.description,
    inLanguage: o.locale,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript',
    isAccessibleForFree: true,
    publisher: { '@id': businessId(o.site) },
  })

export const serviceJsonLd = (o: { site: string; name: string; url: string; description?: Text; image?: Text; areaServed?: string[] }) =>
  node({
    '@type': 'Service',
    name: o.name,
    serviceType: o.name,
    url: o.url,
    description: o.description,
    image: o.image,
    provider: { '@id': businessId(o.site) },
    areaServed: o.areaServed,
  })

export function faqJsonLd(items: { q: Text; a: Text }[]) {
  const qs = items.filter((i) => i.q?.trim() && i.a?.trim())
  if (!qs.length) return null
  return node({ '@type': 'FAQPage', mainEntity: qs.map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })) })
}

export const breadcrumbJsonLd = (items: { name: string; url: string }[]) =>
  node({ '@type': 'BreadcrumbList', itemListElement: items.map((i, n) => ({ '@type': 'ListItem', position: n + 1, name: i.name, item: i.url })) })

export const creativeWorkJsonLd = (o: {
  site: string
  name: string
  url: string
  description?: Text
  year?: number | null
  about?: Text[]
  place?: Text[]
  materials?: string[]
  images?: { url: string; caption?: Text }[]
}) => {
  const place = (o.place ?? []).filter((p) => p?.trim()).join(', ')
  return node({
    '@type': 'CreativeWork',
    name: o.name,
    url: o.url,
    description: o.description,
    dateCreated: o.year ? String(o.year) : undefined,
    about: o.about?.map((name) => ({ '@type': 'Thing', name })),
    contentLocation: place ? { '@type': 'Place', name: place } : undefined,
    material: o.materials,
    creator: { '@id': businessId(o.site) },
    image: o.images?.map((i) => ({ '@type': 'ImageObject', url: i.url, contentUrl: i.url, caption: i.caption })),
  })
}

export const imageObjectJsonLd = (o: {
  site: string
  contentUrl: string
  url: string
  name: Text
  caption?: Text
  width?: number | null
  height?: number | null
  copyrightNotice?: Text
}) =>
  node({
    '@type': 'ImageObject',
    contentUrl: o.contentUrl,
    url: o.url,
    name: o.name,
    caption: o.caption,
    width: o.width || undefined,
    height: o.height || undefined,
    creator: { '@id': businessId(o.site) },
    copyrightHolder: { '@id': businessId(o.site) },
    copyrightNotice: o.copyrightNotice,
  })

const HEADLINE_MAX = 110
const clip = (t: string) => (Array.from(t).length > HEADLINE_MAX ? `${Array.from(t).slice(0, HEADLINE_MAX - 1).join('')}…` : t)

export const articleJsonLd = (o: {
  site: string
  headline: string
  url: string
  author?: Text
  authorUrl?: Text
  datePublished?: Text
  dateModified?: Text
  image?: Text
  description?: Text
}) =>
  node({
    '@type': 'Article',
    headline: clip(o.headline),
    url: o.url,
    description: o.description,
    image: o.image,
    author: { '@type': 'Person', name: o.author, url: o.author?.trim() ? o.authorUrl : undefined },
    datePublished: o.datePublished,
    dateModified: o.dateModified,
    publisher: { '@id': businessId(o.site) },
  })

/** The page's own type (contact, about, listings); the business is the main entity of contact and about. */
export const pageJsonLd = (type: 'ContactPage' | 'AboutPage' | 'CollectionPage', o: { site: string; name: string; path: string; description?: Text; locale: string }) =>
  node({
    '@type': type,
    name: o.name,
    url: `${o.site.replace(/\/$/, '')}${o.path}`,
    description: o.description,
    inLanguage: o.locale,
    isPartOf: { '@id': websiteId(o.site) },
    mainEntity: type === 'CollectionPage' ? undefined : { '@id': businessId(o.site) },
  })

export function itemListJsonLd(items: { name: string; url?: Text }[]) {
  if (!items.length) return null
  return node({ '@type': 'ItemList', itemListElement: items.map((i, n) => ({ '@type': 'ListItem', position: n + 1, name: i.name, url: i.url })) })
}
