// Confirmed business facts only (docs/legacy/decisions.md #12, #63, #64). Unconfirmed fields stay empty → render nothing.
import path from 'node:path'
import type { Payload } from 'payload'

import { parseSiteSettingsOverlay, type SiteSettingsOverlay } from '@/lib/content/schema'
import { EN_WHATSAPP_TEMPLATES, fillEmptyGroups, siteSettingsFill, TR_WHATSAPP_TEMPLATES } from '@/lib/content/site-settings'

import { loadOverlay, payloadOverlayLocales } from './i18n'

const EN: SiteSettingsOverlay = {
  phones: [
    { number: '0532 295 84 16', label: 'Mobile / WhatsApp' },
    { number: '0212 322 43 59', label: 'Landline' },
  ],
  areaServed: [
    { kind: 'city', name: 'Istanbul' },
    { kind: 'country', name: 'Türkiye' },
  ],
  whatsappTemplates: EN_WHATSAPP_TEMPLATES,
  defaultDescription:
    'Kefken Ahşap Dekorasyon builds and installs timber decking, pergolas, gazebos, railings, stairs and outdoor woodwork from its workshop in Arnavutköy, Istanbul — and maintains and repairs them too.',
}

const TR = {
  companyName: 'Kefken Ahşap Dekorasyon',
  foundingYear: 2009,
  founder: { name: 'Murat Şen', phone: '0532 295 84 16' },
  phones: [
    { label: 'Cep / WhatsApp', number: '0532 295 84 16', whatsapp: true },
    { label: 'Sabit hat', number: '0212 322 43 59', whatsapp: false },
  ],
  email: 'kefkenahsapdekorasyon@gmail.com',
  address: {
    street: 'Mavigöl, Münteha Sk. No:31',
    district: 'Arnavutköy',
    city: 'İstanbul',
    postalCode: '34287',
    country: 'TR',
    // #143: the owner's Google / Apple Maps pins.
    lat: 41.2043,
    lng: 28.7616,
    mapUrl: 'https://maps.app.goo.gl/GJ64LpWJjXS3Zvqc8',
    mapEmbedUrl:
      'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3001.8025799595057!2d28.759035577552922!3d41.2042774713238!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x14cab2ea32631179%3A0x8087e41ff058a31d!2sKefken%20Ah%C5%9Fap%20Dekorasyon!5e0!3m2!1str!2str!4v1792015446274!5m2!1str!2str',
    appleMapsUrl: 'https://maps.apple.com/place?place-id=IC3F39D941423A558',
  },
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
}

/**
 * Every locale gets only its empty values, so a re-run never overwrites what the owner edited in the admin. TR is filled
 * per field (companyName can't be the "seeded" signal, it has a default: #140); EN and the overlay locales
 * (seed/i18n/<locale>/site-settings.json) are filled on the rows TR created. A dry run on an empty global therefore
 * under-reports those: there are no rows to match yet.
 */
export async function seedSiteSettings(payload: Payload, { seedDir = path.resolve(process.cwd(), 'seed'), dryRun = false } = {}): Promise<string> {
  const current = await payload.findGlobal({ slug: 'siteSettings', locale: 'tr', fallbackLocale: false, depth: 0 })
  const trPatch = fillEmptyGroups(current as unknown as Record<string, unknown>, TR)
  if (Object.keys(trPatch).length && !dryRun) await payload.updateGlobal({ slug: 'siteSettings', locale: 'tr', data: trPatch as never })
  if (Object.keys(trPatch).length) console.log(`${dryRun ? '[dry run] ' : ''}site settings [tr]: ${Object.keys(trPatch).join(', ')}`)

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
  const tr = Object.keys(trPatch).length ? `TR ${dryRun ? 'would fill' : 'filled'}: ${Object.keys(trPatch).length} field(s)` : 'TR complete, left as is'
  return `${dryRun ? '[dry run] ' : ''}site settings: ${tr}; ${writes} other locale write(s)${dryRun && !current.phones?.length ? ' (empty global: the other locales are counted only once TR has rows)' : ''}`
}
