import { describe, expect, it } from 'vitest'

import { latinRun } from './bidi'

const t = (text: string, format = 0) => ({ type: 'text', text, format })
const ITALIC = 2

describe('latinRun', () => {
  // AR cell "الإيروكو (*Milicia excelsa*)": the italic binomial must be isolated, or bidi scrambles it.
  it('isolates an italic Latin-script run', () => {
    const kids = [t('الإيروكو ('), t('Milicia excelsa', ITALIC), t(')')]
    expect(latinRun(kids, 1)).toEqual({ isolate: true, tail: '' })
    expect(latinRun(kids, 2)).toEqual({ isolate: false, skip: 0 })
  })

  it('pulls a following " spp." into the isolate, and the next node drops it', () => {
    const kids = [t('البلوط ('), t('Quercus', ITALIC), t(' spp.)')]
    expect(latinRun(kids, 1)).toEqual({ isolate: true, tail: ' spp.' })
    expect(latinRun(kids, 2)).toEqual({ isolate: false, skip: 5 })
  })

  it('leaves italic non-Latin text and plain text alone', () => {
    expect(latinRun([t('خشب', ITALIC)], 0)).toEqual({ isolate: false, skip: 0 })
    expect(latinRun([t('Iroko')], 0)).toEqual({ isolate: false, skip: 0 })
  })
})
