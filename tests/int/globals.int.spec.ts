// #24 globals: public read, staff-only update, homepage blocks keep order.
import { getPayload, type Payload, type TypeWithVersion } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import type { Homepage } from '@/payload-types'

let payload: Payload
beforeAll(async () => {
  payload = await getPayload({ config: await config })
})

describe('siteSettings', () => {
  it('is readable anonymously and not writable anonymously', async () => {
    const s = await payload.findGlobal({ slug: 'siteSettings', overrideAccess: false })
    expect(s.companyName).toBe('Kefken Ahşap Dekorasyon')
    await expect(
      payload.updateGlobal({ slug: 'siteSettings', overrideAccess: false, data: { companyName: 'x' } }),
    ).rejects.toThrow()
  })

  it('stores founder facts and localized WhatsApp templates', async () => {
    await payload.updateGlobal({
      slug: 'siteSettings',
      locale: 'tr',
      data: {
        foundingYear: 2009,
        founder: { name: 'Murat Şen' },
        whatsappTemplates: { category: 'Merhaba, {category} hakkında bilgi almak istiyorum.' },
      },
    })
    const tr = await payload.findGlobal({ slug: 'siteSettings', locale: 'tr' })
    expect(tr.foundingYear).toBe(2009)
    expect(tr.founder?.name).toBe('Murat Şen')
    expect(tr.whatsappTemplates?.category).toContain('{category}')
    expect(tr.founder?.craftStartYear ?? null).toBeNull() // unconfirmed → empty
  })
})

describe('homepage', () => {
  // Shared dev DB: the test writes a draft only, so the published homepage (main document) is never touched. Afterwards the
  // latest version from before is stored again, every locale exactly (db-level write, read with locale 'all'), so the
  // admin's latest draft is what it was.
  let before: TypeWithVersion<Homepage> | undefined
  beforeAll(async () => {
    before = (await payload.findGlobalVersions({ slug: 'homepage', where: { latest: { equals: true } }, limit: 1, depth: 0, locale: 'all' })).docs[0]
  })
  afterAll(async () => {
    if (before) await payload.db.createGlobalVersion({ globalSlug: 'homepage', versionData: before.version, autosave: false, createdAt: before.createdAt, updatedAt: new Date().toISOString() })
  })

  it('keeps block order as saved', async () => {
    await payload.updateGlobal({
      slug: 'homepage',
      draft: true,
      data: { layout: [{ blockType: 'services', enabled: true }, { blockType: 'faq', enabled: false }, { blockType: 'contact' }] },
    })
    const h = await payload.findGlobal({ slug: 'homepage', draft: true })
    expect(h.layout?.map((b) => b.blockType)).toEqual(['services', 'faq', 'contact'])
    expect(h.layout?.[1]?.enabled).toBe(false)
  })
})
