import { describe, expect, it } from 'vitest'

import { directionsUrl } from './contact'

describe('directionsUrl', () => {
  it('prefers the admin-set map link', () => {
    expect(directionsUrl({ mapUrl: 'https://maps.app.goo.gl/abc', street: 'X' })).toBe('https://maps.app.goo.gl/abc')
  })

  it('falls back to a Google Maps search of the address', () => {
    expect(directionsUrl({ street: 'Hadımköy Mah. 1. Sok. No:5', district: 'Arnavutköy', city: 'İstanbul' })).toBe(
      'https://www.google.com/maps/search/?api=1&query=Had%C4%B1mk%C3%B6y%20Mah.%201.%20Sok.%20No%3A5%2C%20Arnavutk%C3%B6y%2C%20%C4%B0stanbul',
    )
  })

  it('returns null without an address', () => {
    expect(directionsUrl(null)).toBeNull()
    expect(directionsUrl({})).toBeNull()
  })
})
