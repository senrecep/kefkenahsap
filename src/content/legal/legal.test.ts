import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { routing } from '@/i18n/routing'
import { KVKK_TEXT_DATE } from '@/lib/leads/validate'

import { cookiesSections } from './cookies'
import { kvkkSections, type Section, type Uses } from './kvkk'

const none: Uses = { ga: false, umami: false, map: false }
const all: Uses = { ga: true, umami: true, map: true }
const contact = { address: 'Arnavutköy, İstanbul', email: 'a@b.co' }
const keysOf = (sections: Section[]) =>
  sections.flatMap((s) => [
    `${s.id}.title`,
    ...[...(s.p ?? []), ...(s.list ?? []), ...(s.after ?? [])].map((k) => `${s.id}.${k}`),
  ])
const get = (o: unknown, path: string) =>
  path.split('.').reduce<unknown>((v, k) => (v as Record<string, unknown> | undefined)?.[k], o)

describe('kvkkSections (#195)', () => {
  it('names GA, Umami and the map only when the site uses them', () => {
    const off = keysOf(kvkkSections(none))
    for (const k of [
      'data.ga',
      'data.umami',
      'purposes.ga',
      'recipients.ga',
      'recipients.map',
      'retention.ga',
    ])
      expect(off).not.toContain(k)
    expect(keysOf(kvkkSections({ ...none, ga: true }))).toEqual(
      expect.arrayContaining(['data.ga', 'purposes.ga', 'recipients.ga', 'retention.ga']),
    )
    expect(keysOf(kvkkSections({ ...none, umami: true }))).toEqual(expect.arrayContaining(['data.umami', 'purposes.umami', 'retention.umami']))
    expect(keysOf(kvkkSections({ ...none, map: true }))).toContain('recipients.map')
  })

  it('always covers the KVKK md. 10 basics: controller, purposes, recipients, abroad, retention, rights, how to apply', () => {
    expect(kvkkSections(none).map((s) => s.id)).toEqual(
      expect.arrayContaining([
        'controller',
        'data',
        'method',
        'purposes',
        'recipients',
        'abroad',
        'retention',
        'rights',
        'apply',
      ]),
    )
    expect(kvkkSections(none).find((s) => s.id === 'rights')?.list).toHaveLength(8)
    expect(keysOf(kvkkSections(none))).toContain('recipients.whatsapp')
  })

  it('offers only the application channels the controller really has', () => {
    const channels = (c: { address?: string; email?: string | null }) => kvkkSections(none, c).find((s) => s.id === 'apply')?.list
    expect(channels(contact)).toEqual(['post', 'esign', 'email'])
    expect(channels({ address: contact.address })).toEqual(['post'])
    expect(channels({ email: contact.email })).toEqual(['esign', 'email'])
  })
})

describe('cookiesSections (#195)', () => {
  it('without GA: no consent cookie, no measurement section, no footer preferences line', () => {
    const k = keysOf(cookiesSections(none))
    expect(k).not.toContain('necessary.consent')
    expect(k).not.toContain('analytics.ga')
    expect(k).not.toContain('choice.footer')
    expect(k).toContain('noAnalytics.text')
  })

  it('with GA: the consent cookie, the GA cookies and how to withdraw', () => {
    const k = keysOf(cookiesSections({ ...none, ga: true }))
    expect(k).toEqual(
      expect.arrayContaining([
        'necessary.consent',
        'analytics.ga',
        'analytics.optIn',
        'analytics.withdraw',
        'choice.footer',
      ]),
    )
    expect(k).not.toContain('noAnalytics.text')
  })

  it('Umami and the map get their own section only when used', () => {
    expect(cookiesSections(none).map((s) => s.id)).not.toContain('umami')
    expect(cookiesSections(none).map((s) => s.id)).not.toContain('map')
    expect(cookiesSections({ ...none, umami: true, map: true }).map((s) => s.id)).toEqual(
      expect.arrayContaining(['umami', 'map']),
    )
  })
})

// A missing key would throw at render time, so every locale must hold every key any flag combination can ask for.
describe.each(routing.locales)('legal texts in %s', (locale) => {
  it('has every key the sections reference', async () => {
    const m = (await import(`../../../messages/${locale}/legal.json`)).default
    const missing = [
      ...['intro', 'controller.who', ...keysOf([...kvkkSections(all, contact), ...kvkkSections(none)])].map(
        (k) => `KvkkText.${k}`,
      ),
      ...['intro', ...keysOf([...cookiesSections(all), ...cookiesSections(none)])].map(
        (k) => `CookiesText.${k}`,
      ),
    ].filter((k) => typeof get(m, k) !== 'string')
    expect(missing).toEqual([])
  })
})

// The pages show KVKK_TEXT_DATE as "Son güncelleme" and every lead stores it as the version it acknowledged. When a
// legal.json changes, set KVKK_TEXT_DATE to the day of the change and paste the new hash here.
const TEXT_STAMP = { date: '2026-10-18', sha256: '454cdf79be6717bc295b9eee738f35880dc520650bd3897842b5c121f5db14e2' }

it('KVKK_TEXT_DATE moves with the legal texts', () => {
  const hash = createHash('sha256')
  for (const l of routing.locales) hash.update(readFileSync(`messages/${l}/legal.json`))
  expect({ date: KVKK_TEXT_DATE, sha256: hash.digest('hex') }).toEqual(TEXT_STAMP)
})
