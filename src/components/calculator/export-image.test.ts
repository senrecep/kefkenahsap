import { describe, expect, it } from 'vitest'

import { fileName } from './export-image'

describe('fileName', () => {
  it('stamps the PNG with Istanbul time (UTC+3), whatever the device zone', () => {
    expect(fileName(new Date('2026-10-19T11:33:00Z'))).toBe('kefken-hesap-2026-10-19-1433.png')
    expect(fileName(new Date('2026-12-31T22:05:00Z'))).toBe('kefken-hesap-2027-01-01-0105.png')
  })
})
