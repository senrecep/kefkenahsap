import { type APIRequestContext, expect, request } from '@playwright/test'
import sharp from 'sharp'

import { seedTestUser, testUser } from './seedUser'

/**
 * Admin REST client for e2e fixtures. Writes go through the running Next server, so Payload hooks
 * revalidate its cached loaders (local-API writes from the test process would not).
 */
export async function adminApi(): Promise<APIRequestContext> {
  await seedTestUser()
  const baseURL = `http://localhost:${process.env.E2E_PORT ?? 3000}`
  const login = await (await request.newContext({ baseURL })).post('/api/users/login', { data: { email: testUser.email, password: testUser.password } })
  expect(login.ok(), await login.text()).toBe(true)
  return request.newContext({ baseURL, extraHTTPHeaders: { Authorization: `JWT ${(await login.json()).token}` } })
}

export async function createDoc<T = { id: number }>(api: APIRequestContext, collection: string, data: Record<string, unknown>, locale = 'tr'): Promise<T> {
  const res = await api.post(`/api/${collection}?locale=${locale}`, { data })
  expect(res.ok(), await res.text()).toBe(true)
  return (await res.json()).doc as T
}

/** Uploads a small generated, approved photo (status approved needs a Turkish alt). */
export async function uploadPhoto(api: APIRequestContext, data: { seoFilename: string; category?: number; alt?: string; status?: 'pending' | 'approved' | 'hidden' }, shade = 0) {
  const buffer = await sharp({ create: { width: 1600, height: 900, channels: 3, background: { r: 90 + (shade % 7) * 20, g: 80, b: 60 } } }).webp().toBuffer()
  const res = await api.post('/api/media?locale=tr', {
    multipart: {
      file: { name: `${data.seoFilename}.webp`, mimeType: 'image/webp', buffer },
      _payload: JSON.stringify({ status: 'approved', alt: data.alt ?? `E2E fotoğraf ${data.seoFilename}`, ...data }),
    },
  })
  expect(res.ok(), await res.text()).toBe(true)
  return (await res.json()).doc as { id: number; seoFilename: string }
}

export const deleteDocs = async (api: APIRequestContext, collection: string, ids: number[]) => {
  for (const id of ids) await api.delete(`/api/${collection}/${id}`)
}

/**
 * WhatsApp CTAs render only with a configured number. On an empty DB, set a test number and page templates;
 * returns a restore function that puts the previous values back.
 */
export async function ensureWhatsApp(api: APIRequestContext): Promise<() => Promise<void>> {
  const current = await (await api.get('/api/globals/siteSettings?locale=tr&depth=0')).json()
  if (current.whatsappNumber) return async () => {}
  const prev = { whatsappNumber: current.whatsappNumber ?? null, whatsappTemplates: current.whatsappTemplates ?? {} }
  const res = await api.post('/api/globals/siteSettings?locale=tr', {
    data: { whatsappNumber: '0532 000 00 00', whatsappTemplates: { category: 'Merhaba, {category} ({url})', project: 'Merhaba, {project} ({url})' } },
  })
  expect(res.ok(), await res.text()).toBe(true)
  return async () => {
    await api.post('/api/globals/siteSettings?locale=tr', { data: prev })
  }
}

/**
 * #187: a published homepage whose first hero shows at least three photos. A DB that already has them (the local seed)
 * is left as is; otherwise (CI's empty DB) the hero gets approved landscape photos. Returns a restore function that puts
 * the previous layout back.
 */
export async function ensureHeroSlides(api: APIRequestContext): Promise<() => Promise<void>> {
  const current = await (await api.get('/api/globals/homepage?locale=tr&depth=0')).json()
  const layout = (current.layout ?? []) as { blockType: string; image?: number | null; slides?: number[] | null }[]
  const hero = layout.find((b) => b.blockType === 'hero')
  if (hero?.image && (hero.slides?.length ?? 0) >= 2) return async () => {}
  const photos = await (await api.get('/api/media?depth=0&limit=4&sort=id&where[status][equals]=approved&where[width][greater_than_equal]=1280')).json()
  const ids = (photos.docs as { id: number; width: number; height: number }[]).filter((d) => d.width > d.height).map((d) => d.id)
  expect(ids.length, 'needs three approved landscape photos').toBeGreaterThanOrEqual(3)
  const sections = ['hero', 'featuredGallery', 'services', 'featuredProjects', 'process', 'references', 'woodTypes', 'faq', 'contact']
  const next = hero ? layout.map((b) => (b === hero ? { ...b, image: b.image ?? ids[0], slides: ids.filter((id) => id !== (b.image ?? ids[0])).slice(0, 2) } : b)) : sections.map((blockType) => (blockType === 'hero' ? { blockType, image: ids[0], slides: ids.slice(1, 3) } : { blockType }))
  const res = await api.post('/api/globals/homepage?locale=tr', { data: { layout: next, _status: 'published' } })
  expect(res.ok(), await res.text()).toBe(true)
  return async () => {
    await api.post('/api/globals/homepage?locale=tr', { data: { layout, _status: current._status ?? 'published' } })
  }
}
