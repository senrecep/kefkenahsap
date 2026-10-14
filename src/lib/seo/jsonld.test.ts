import { describe, expect, it } from 'vitest'

import {
  articleJsonLd,
  breadcrumbJsonLd,
  businessJsonLd,
  creativeWorkJsonLd,
  faqJsonLd,
  imageObjectJsonLd,
  itemListJsonLd,
  safeJsonLd,
  serviceJsonLd,
  websiteJsonLd,
} from './jsonld'

const SITE = 'https://www.kefkenahsap.com'
const BIZ = `${SITE}/#business`

describe('safeJsonLd', () => {
  it('cannot close the <script> element or break JS line parsing', () => {
    const out = safeJsonLd({ name: '</script><script>alert(1)</script>', x: 'a\u2028b' })
    expect(out).not.toContain('</script')
    expect(out).not.toContain('\u2028')
    expect(JSON.parse(out)).toEqual({ name: '</script><script>alert(1)</script>', x: 'a\u2028b' })
  })
})

describe('businessJsonLd (HomeAndConstructionBusiness)', () => {
  const full = {
    companyName: 'Kefken Ahşap Dekorasyon',
    foundingYear: 2009,
    founder: { name: 'Murat Şen' },
    phones: [{ label: 'Cep', number: '0532 295 84 16' }, { number: '0212 322 43 59' }],
    email: 'info@example.com',
    address: { street: 'Mavigöl, Münteha Sk. No:31', district: 'Arnavutköy', city: 'İstanbul', postalCode: '34287', country: 'TR', lat: 41.2, lng: 28.7 },
    hours: [{ days: ['Mo', 'Sa'] as const, opens: '08:00', closes: '19:00' }],
    areaServed: [{ name: 'İstanbul', kind: 'city' as const }, { name: 'Türkiye', kind: 'country' as const }],
    social: { instagram: 'https://instagram.com/k', facebook: 'https://facebook.com/k', googleBusiness: 'https://g.page/k' },
  }

  it('maps every filled siteSettings field', () => {
    expect(businessJsonLd(full, { site: SITE, url: `${SITE}/tr`, logo: `${SITE}/brand/logo.png`, image: 'https://cdn/x.webp' })).toEqual({
      '@context': 'https://schema.org',
      '@type': 'HomeAndConstructionBusiness',
      '@id': BIZ,
      name: 'Kefken Ahşap Dekorasyon',
      url: `${SITE}/tr`,
      logo: `${SITE}/brand/logo.png`,
      image: 'https://cdn/x.webp',
      telephone: '0532 295 84 16',
      email: 'info@example.com',
      foundingDate: '2009',
      founder: { '@type': 'Person', name: 'Murat Şen' },
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Mavigöl, Münteha Sk. No:31',
        addressLocality: 'Arnavutköy',
        addressRegion: 'İstanbul',
        postalCode: '34287',
        addressCountry: 'TR',
      },
      geo: { '@type': 'GeoCoordinates', latitude: 41.2, longitude: 28.7 },
      openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Saturday'], opens: '08:00', closes: '19:00' }],
      sameAs: ['https://instagram.com/k', 'https://facebook.com/k', 'https://g.page/k'],
    })
  })

  it('no areaServed on the site-wide node (the footer does not show it; categories carry their visible areas line)', () => {
    expect(businessJsonLd(full, { site: SITE, url: `${SITE}/tr` })).not.toHaveProperty('areaServed')
  })

  it('geo and hasMap only with a visible street address', () => {
    const out = businessJsonLd({ companyName: 'K', address: { city: 'İstanbul', lat: 41.2, lng: 28.7, mapUrl: 'https://maps.app.goo.gl/x' } }, { site: SITE, url: `${SITE}/tr` })
    expect(out).not.toHaveProperty('geo')
    expect(out).not.toHaveProperty('hasMap')
  })

  it('hasMap is the Google Maps link next to geo', () => {
    const out = businessJsonLd({ companyName: 'K', address: { street: 'S', lat: 41.2043, lng: 28.7616, mapUrl: 'https://maps.app.goo.gl/GJ64LpWJjXS3Zvqc8' } }, { site: SITE, url: `${SITE}/tr` })
    expect(out).toMatchObject({ geo: { latitude: 41.2043, longitude: 28.7616 }, hasMap: 'https://maps.app.goo.gl/GJ64LpWJjXS3Zvqc8' })
  })

  it('empty fields are left out (no founder, no founding date, no geo, no sameAs)', () => {
    const out = businessJsonLd(
      { companyName: 'Kefken', foundingYear: null, founder: { name: '' }, address: { street: 'S', lat: null, lng: 28 }, social: { instagram: null } },
      { site: SITE, url: `${SITE}/tr` },
    )
    expect(out).toEqual({
      '@context': 'https://schema.org',
      '@type': 'HomeAndConstructionBusiness',
      '@id': BIZ,
      name: 'Kefken',
      url: `${SITE}/tr`,
      address: { '@type': 'PostalAddress', streetAddress: 'S' },
    })
  })
})

describe('websiteJsonLd', () => {
  it('names the site and its publisher — no SearchAction', () => {
    const out = websiteJsonLd({ name: 'Kefken', site: SITE, url: `${SITE}/tr`, locale: 'tr' })
    expect(out).toEqual({ '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${SITE}/#website`, name: 'Kefken', url: `${SITE}/tr`, inLanguage: 'tr', publisher: { '@id': BIZ } })
    expect(JSON.stringify(out)).not.toContain('SearchAction')
  })
})

describe('serviceJsonLd', () => {
  it('a service provided by the business', () => {
    expect(serviceJsonLd({ site: SITE, name: 'Deck ve Zeminler', url: `${SITE}/tr/deck-ve-zeminler`, description: 'Iroko deck.', image: 'https://cdn/d.webp', areaServed: ['İstanbul'] })).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: 'Deck ve Zeminler',
      serviceType: 'Deck ve Zeminler',
      url: `${SITE}/tr/deck-ve-zeminler`,
      description: 'Iroko deck.',
      image: 'https://cdn/d.webp',
      provider: { '@id': BIZ },
      areaServed: ['İstanbul'],
    })
  })
})

describe('faqJsonLd', () => {
  it('Question / acceptedAnswer pairs', () => {
    expect(faqJsonLd([{ q: 'Ne kadar sürer?', a: 'İki hafta.' }])).toEqual({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [{ '@type': 'Question', name: 'Ne kadar sürer?', acceptedAnswer: { '@type': 'Answer', text: 'İki hafta.' } }],
    })
  })
  it('no questions → no FAQPage', () => {
    expect(faqJsonLd([])).toBeNull()
    expect(faqJsonLd([{ q: ' ', a: 'x' }])).toBeNull()
  })
})

describe('breadcrumbJsonLd', () => {
  it('positions start at 1', () => {
    expect(breadcrumbJsonLd([{ name: 'Ana sayfa', url: `${SITE}/tr` }, { name: 'Galeri', url: `${SITE}/tr/galeri` }])).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Ana sayfa', item: `${SITE}/tr` },
        { '@type': 'ListItem', position: 2, name: 'Galeri', item: `${SITE}/tr/galeri` },
      ],
    })
  })
})

describe('creativeWorkJsonLd (project)', () => {
  it('location, year, materials and photos; creator is the business', () => {
    expect(
      creativeWorkJsonLd({
        site: SITE,
        name: 'Köşk terası',
        url: `${SITE}/tr/projeler/kosk`,
        description: 'Iroko teras.',
        year: 2021,
        place: ['Sarıyer', 'İstanbul'],
        materials: ['Iroko'],
        images: [{ url: 'https://cdn/1.webp', caption: 'Teras' }],
      }),
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      name: 'Köşk terası',
      url: `${SITE}/tr/projeler/kosk`,
      description: 'Iroko teras.',
      dateCreated: '2021',
      contentLocation: { '@type': 'Place', name: 'Sarıyer, İstanbul' },
      material: ['Iroko'],
      creator: { '@id': BIZ },
      image: [{ '@type': 'ImageObject', contentUrl: 'https://cdn/1.webp', caption: 'Teras' }],
    })
  })
  it('skips missing year, place, materials and photos', () => {
    expect(creativeWorkJsonLd({ site: SITE, name: 'X', url: `${SITE}/tr/projeler/x`, place: [], materials: [], images: [] })).toEqual({
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      name: 'X',
      url: `${SITE}/tr/projeler/x`,
      creator: { '@id': BIZ },
    })
  })
})

describe('imageObjectJsonLd (photo page)', () => {
  it('content URL, caption and the business as creator / copyright holder', () => {
    expect(
      imageObjectJsonLd({ site: SITE, contentUrl: 'https://cdn/a.webp', url: `${SITE}/tr/galeri/a`, name: 'Deck', caption: 'Bahçe decki', width: 1030, height: 579, copyrightNotice: '© Kefken' }),
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'ImageObject',
      contentUrl: 'https://cdn/a.webp',
      url: `${SITE}/tr/galeri/a`,
      name: 'Deck',
      caption: 'Bahçe decki',
      width: 1030,
      height: 579,
      creator: { '@id': BIZ },
      copyrightHolder: { '@id': BIZ },
      copyrightNotice: '© Kefken',
    })
  })
})

describe('articleJsonLd (guide)', () => {
  it('headline, author, dates, publisher', () => {
    expect(
      articleJsonLd({ site: SITE, headline: 'Deck bakımı', url: `${SITE}/tr/rehber/deck-bakimi`, author: 'Murat Şen', datePublished: '2026-10-01', dateModified: '2026-10-10' }),
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'Deck bakımı',
      url: `${SITE}/tr/rehber/deck-bakimi`,
      author: { '@type': 'Person', name: 'Murat Şen' },
      datePublished: '2026-10-01',
      dateModified: '2026-10-10',
      publisher: { '@id': BIZ },
    })
  })
})

describe('itemListJsonLd (references, project lists)', () => {
  it('ordered ListItems', () => {
    expect(itemListJsonLd([{ name: 'A', url: `${SITE}/tr/projeler/a` }, { name: 'B' }])).toEqual({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'A', url: `${SITE}/tr/projeler/a` },
        { '@type': 'ListItem', position: 2, name: 'B' },
      ],
    })
  })
  it('empty list → nothing', () => {
    expect(itemListJsonLd([])).toBeNull()
  })
})
