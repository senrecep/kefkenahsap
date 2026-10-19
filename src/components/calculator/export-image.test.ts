import { describe, expect, it } from 'vitest'

import { canvasScale, fileName, wrapText } from './export-image'

describe('fileName', () => {
  it('stamps the PNG with Istanbul time (UTC+3), whatever the device zone', () => {
    expect(fileName(new Date('2026-10-19T11:33:00Z'))).toBe('kefken-hesap-2026-10-19-1433.png')
    expect(fileName(new Date('2026-12-31T22:05:00Z'))).toBe('kefken-hesap-2027-01-01-0105.png')
  })
})

describe('wrapText (#236 review)', () => {
  const width = (s: string) => s.length // one unit per character
  it('wraps on spaces and keeps line breaks', () => {
    expect(wrapText('aa bb cc\ndd', 5, width)).toEqual(['aa bb', 'cc', 'dd'])
  })
  it('breaks a word longer than the line instead of letting it run off the image', () => {
    expect(wrapText('x abcdefghijkl', 5, width)).toEqual(['x', 'abcde', 'fghij', 'kl'])
  })
})

describe('canvasScale', () => {
  it('keeps 1:1 up to the browsers\' canvas limits, then scales the whole image down', () => {
    expect(canvasScale(1080, 3000)).toBe(1)
    // 1080 × 30 000 = 32,4 M px > 16 M px (iOS Safari): sqrt(16e6 / 32.4e6) ≈ 0.7027; height cap 15 000 / 30 000 = 0.5
    expect(canvasScale(1080, 30_000)).toBe(0.5)
    expect(canvasScale(1080, 14_900)).toBeCloseTo(Math.sqrt(16e6 / (1080 * 14_900)), 6) // area limit first: ≈ 0.9971
  })
})
