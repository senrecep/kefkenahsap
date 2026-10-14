// Confirmed business facts only (docs/legacy/decisions.md #12, #63, #64). Unconfirmed fields stay empty → render nothing.
import path from 'node:path'
import type { Payload } from 'payload'

import { parseSiteSettingsOverlay, type SiteSettingsOverlay } from '@/lib/content/schema'
import { siteSettingsFill } from '@/lib/content/site-settings'

import { loadOverlay, payloadOverlayLocales } from './i18n'

export const TR_WHATSAPP_TEMPLATES = {
  default: 'Merhaba, ahşap işleriniz hakkında bilgi almak istiyorum.',
  category: 'Merhaba, {category} hakkında bilgi almak istiyorum. ({url})',
  project: 'Merhaba, {project} projenize benzer bir iş için bilgi almak istiyorum. ({url})',
  image: 'Merhaba, bu fotoğraftaki işe benzer bir uygulama için bilgi almak istiyorum: {url}',
  contact: 'Merhaba, teklif almak istiyorum.',
}

const EN: SiteSettingsOverlay = {
  phones: [
    { number: '0532 295 84 16', label: 'Mobile / WhatsApp' },
    { number: '0212 322 43 59', label: 'Landline' },
  ],
  areaServed: [{ name: 'Istanbul' }, { name: 'Türkiye' }],
  whatsappTemplates: {
    default: 'Hello, I would like information about your woodwork.',
    category: 'Hello, I would like information about {category}. ({url})',
    project: 'Hello, I would like information about a job similar to {project}. ({url})',
    image: 'Hello, I would like information about work like this photo: {url}',
    contact: 'Hello, I would like a quote.',
  },
  defaultDescription:
    'Kefken Ahşap Dekorasyon builds and installs timber decking, pergolas, gazebos, railings, stairs and outdoor woodwork from its workshop in Arnavutköy, Istanbul — and maintains and repairs them too.',
}

/**
 * TR: written only while the global has no phones. companyName can't be the signal, it has a default (#140).
 * EN and the overlay locales (seed/i18n/<locale>/site-settings.json): only empty values are filled, so a re-run never
 * overwrites what the owner edited in the admin.
 */
export async function seedSiteSettings(payload: Payload, { seedDir = path.resolve(process.cwd(), 'seed'), dryRun = false } = {}): Promise<string> {
  const current = await payload.findGlobal({ slug: 'siteSettings', locale: 'tr', depth: 0 })
  const seedTr = !current.phones?.length
  if (seedTr && !dryRun) await payload.updateGlobal({
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
      whatsappTemplates: TR_WHATSAPP_TEMPLATES,
      social: {
        instagram: 'https://www.instagram.com/kefken_ahsap_dek_gokturk/',
        facebook: 'https://www.facebook.com/kefkenahsapdekorasyon',
      },
      defaultDescription:
        "Kefken Ahşap Dekorasyon: İstanbul Arnavutköy'deki atölyemizde ahşap deck, pergola, kamelya, korkuluk, merdiven ve dış mekân ahşap işlerini imal edip monte ediyoruz. Bakım ve tamir de yapıyoruz.",
    },
  })

  let writes = 0
  for (const locale of ['en' as const, ...payloadOverlayLocales(payload)]) {
    const overlay = locale === 'en' ? EN : loadOverlay(seedDir, locale, 'site-settings.json', parseSiteSettingsOverlay)
    if (!overlay) continue
    const stored = await payload.findGlobal({ slug: 'siteSettings', locale, fallbackLocale: false, depth: 0 })
    const patch = siteSettingsFill(stored, overlay)
    if (!Object.keys(patch).length) continue
    if (!dryRun) await payload.updateGlobal({ slug: 'siteSettings', locale, data: patch as never })
    writes++
    console.log(`${dryRun ? '[dry run] ' : ''}site settings [${locale}]: ${Object.keys(patch).join(', ')}`)
  }
  const tr = seedTr ? (dryRun ? 'TR would be seeded' : 'TR seeded') : 'TR already set, left as is'
  return `${dryRun ? '[dry run] ' : ''}site settings: ${tr}; ${writes} locale write(s)`
}
