// #140: the site-settings seed must fill an empty global (companyName has a default, so it can't be the "already set"
// signal), never overwrite owner edits, and fill the overlay locales only where empty. Each test starts from emptyGlobal().
import path from 'node:path'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, expect, it } from 'vitest'

import config from '@/payload.config'
import type { Config, SiteSetting } from '@/payload-types'

import { seedSiteSettings } from '../../scripts/seed/site-settings'

type Locale = Config['locale']
const SEED = path.resolve(process.cwd(), 'seed')
let payload: Payload
let locales: Locale[]
const snapshot = new Map<Locale, SiteSetting>()
const blank = { default: null, category: null, project: null, image: null, contact: null }

const read = (locale: Locale) => payload.findGlobal({ slug: 'siteSettings', locale, fallbackLocale: false, depth: 0 })
const strip = ({ id: _id, createdAt: _c, updatedAt: _u, globalType: _g, ...data }: SiteSetting & { globalType?: unknown }) => data

/** An "empty database": no rows, contact fields, templates or description in any locale; companyName keeps its default. */
async function emptyGlobal() {
  const nulls = (o: object) => Object.fromEntries(Object.keys(o).map((k) => [k, null]))
  await payload.updateGlobal({
    slug: 'siteSettings',
    locale: 'tr',
    data: {
      phones: [],
      areaServed: [],
      whatsappNumber: null,
      email: null,
      foundingYear: null,
      address: nulls({ street: 0, district: 0, city: 0, postalCode: 0 }),
      founder: nulls({ name: 0, phone: 0 }),
      social: nulls({ instagram: 0, facebook: 0 }),
    },
  })
  for (const l of locales) await payload.updateGlobal({ slug: 'siteSettings', locale: l, data: { whatsappTemplates: blank, defaultDescription: null } })
}

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  locales = (payload.config.localization ? payload.config.localization.localeCodes : []) as Locale[]
  for (const l of locales) snapshot.set(l, await read(l))
})

afterAll(async () => {
  if (!snapshot.has('tr')) return
  // TR first: it brings the original rows back, and with them every locale's row labels are gone. A label is required,
  // so a locale that had none gets the seeded one (same number / kind) back on that row instead of an empty value.
  const seeded = new Map<Locale, SiteSetting>()
  for (const l of locales) seeded.set(l, await read(l))
  await payload.updateGlobal({ slug: 'siteSettings', locale: 'tr', data: strip(snapshot.get('tr')!) })
  for (const l of locales.filter((x) => x !== 'tr')) {
    const { phones, areaServed, whatsappTemplates, defaultDescription, officeHoursNote, founder } = snapshot.get(l)!
    const now = seeded.get(l)!
    await payload.updateGlobal({
      slug: 'siteSettings',
      locale: l,
      data: {
        phones: phones?.map((p) => ({ ...p, label: p.label || now.phones?.find((n) => n.number === p.number)?.label || '?' })),
        areaServed: areaServed?.map((a) => ({ ...a, name: a.name || now.areaServed?.find((n) => n.kind === a.kind)?.name || '?' })),
        // An empty value reads back as a missing key, which an update would leave as is: write it as null.
        whatsappTemplates: Object.fromEntries(Object.keys(blank).map((k) => [k, whatsappTemplates?.[k as keyof typeof blank] ?? null])),
        defaultDescription: defaultDescription ?? null,
        officeHoursNote: officeHoursNote ?? null,
        founder: { bio: founder?.bio ?? null },
      },
    })
  }
})

it('seeds phones, WhatsApp and address into an empty global although companyName has its default', async () => {
  await emptyGlobal()
  expect((await read('tr')).companyName).toBe('Kefken Ahşap Dekorasyon')
  await seedSiteSettings(payload, { seedDir: SEED })
  const tr = await read('tr')
  expect(tr.phones?.map((p) => [p.label, p.number])).toEqual([
    ['Cep / WhatsApp', '0532 295 84 16'],
    ['Sabit hat', '0212 322 43 59'],
  ])
  expect(tr.whatsappNumber).toBe('0532 295 84 16')
  expect(tr.address?.district).toBe('Arnavutköy')
  const en = await read('en')
  expect(en.phones?.[1]?.label).toBe('Landline')
  expect(en.whatsappTemplates?.contact).toBe('Hello, I would like a quote.')
})

it('keeps owner-typed email and address on a global without phones, and fills the rest', async () => {
  await emptyGlobal()
  await payload.updateGlobal({ slug: 'siteSettings', locale: 'tr', data: { email: 'usta@example.com', address: { street: 'Usta Sk. 1' } } })
  await seedSiteSettings(payload, { seedDir: SEED })
  const tr = await read('tr')
  expect([tr.email, tr.address?.street, tr.address?.district]).toEqual(['usta@example.com', 'Usta Sk. 1', 'Arnavutköy'])
  expect(tr.phones).toHaveLength(2)
})

it('fills ru/de/ar from the overlays with the TR placeholders', async () => {
  await emptyGlobal()
  await seedSiteSettings(payload, { seedDir: SEED })
  const ru = await read('ru')
  expect(ru.phones?.map((p) => p.label)).toEqual(['Мобильный / WhatsApp', 'Городской телефон'])
  expect(ru.areaServed?.map((a) => a.name)).toEqual(['Стамбул', 'Турция'])
  expect(ru.whatsappTemplates?.category).toContain('{category}')
  expect((await read('de')).defaultDescription).toContain('Arnavutköy')
  expect((await read('ar')).whatsappTemplates?.image).toContain('{url}')
})

it('a re-run leaves owner edits in every locale as they are', async () => {
  await emptyGlobal()
  await seedSiteSettings(payload, { seedDir: SEED })
  const tr = await read('tr')
  await payload.updateGlobal({ slug: 'siteSettings', locale: 'tr', data: { phones: tr.phones!.map((p, i) => (i ? p : { ...p, label: 'Usta' })) } })
  await payload.updateGlobal({ slug: 'siteSettings', locale: 'ru', data: { defaultDescription: 'Своё описание' } })
  await seedSiteSettings(payload, { seedDir: SEED })
  expect((await read('tr')).phones?.[0]?.label).toBe('Usta')
  expect((await read('ru')).defaultDescription).toBe('Своё описание')
  expect((await read('ru')).phones?.[0]?.label).toBe('Мобильный / WhatsApp')
})
