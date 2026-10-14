// Confirmed business facts only (docs/legacy/decisions.md #12, #63, #64). Unconfirmed fields stay empty → render nothing.
import type { Payload } from 'payload'

/** Seeds only an empty global, so a re-run never overwrites what the owner edited in the admin. */
export async function seedSiteSettings(payload: Payload): Promise<string> {
  const current = await payload.findGlobal({ slug: 'siteSettings', locale: 'tr', depth: 0 })
  if (current.companyName) return 'site settings already set, left as is'
  await payload.updateGlobal({
    slug: 'siteSettings',
    locale: 'tr',
    data: {
      companyName: 'Kefken Ahşap Dekorasyon',
      foundingYear: 2009,
      founder: { name: 'Murat Şen', phone: '0532 295 84 16' },
      phones: [
        { label: 'Cep / WhatsApp', number: '0532 295 84 16', whatsapp: true },
        { label: 'Sabit hat', number: '0212 322 43 59', whatsapp: false },
      ],
      email: 'kefkenahsapdekorasyon@gmail.com',
      address: { street: 'Mavigöl, Münteha Sk. No:31', district: 'Arnavutköy', city: 'İstanbul', postalCode: '34287', country: 'TR' },
      areaServed: [
        { name: 'İstanbul', kind: 'city' },
        { name: 'Türkiye', kind: 'country' },
      ],
      whatsappNumber: '0532 295 84 16',
      whatsappTemplates: {
        default: 'Merhaba, ahşap işleriniz hakkında bilgi almak istiyorum.',
        category: 'Merhaba, {category} hakkında bilgi almak istiyorum. ({url})',
        project: 'Merhaba, {project} projenize benzer bir iş için bilgi almak istiyorum. ({url})',
        image: 'Merhaba, bu fotoğraftaki işe benzer bir uygulama için bilgi almak istiyorum: {url}',
        contact: 'Merhaba, teklif almak istiyorum.',
      },
      social: {
        instagram: 'https://www.instagram.com/kefken_ahsap_dek_gokturk/',
        facebook: 'https://www.facebook.com/kefkenahsapdekorasyon',
      },
      defaultDescription:
        "Kefken Ahşap Dekorasyon: İstanbul Arnavutköy'deki atölyemizde ahşap deck, pergola, kamelya, korkuluk, merdiven ve dış mekân ahşap işlerini imal edip monte ediyoruz. Bakım ve tamir de yapıyoruz.",
    },
  })
  const tr = await payload.findGlobal({ slug: 'siteSettings', locale: 'tr', depth: 0 })
  await payload.updateGlobal({
    slug: 'siteSettings',
    locale: 'en',
    data: {
      phones: (tr.phones ?? []).map((p, i) => ({ ...p, label: i === 0 ? 'Mobile / WhatsApp' : 'Landline' })),
      areaServed: (tr.areaServed ?? []).map((a) => ({ ...a, name: a.name === 'Türkiye' ? 'Türkiye' : 'Istanbul' })),
      whatsappTemplates: {
        default: 'Hello, I would like information about your woodwork.',
        category: 'Hello, I would like information about {category}. ({url})',
        project: 'Hello, I would like information about a job similar to {project}. ({url})',
        image: 'Hello, I would like information about work like this photo: {url}',
        contact: 'Hello, I would like a quote.',
      },
      defaultDescription:
        'Kefken Wood Decoration builds and installs timber decking, pergolas, gazebos, railings, stairs and outdoor woodwork from its workshop in Arnavutköy, Istanbul — and maintains and repairs them too.',
    },
  })
  return 'site settings seeded'
}
