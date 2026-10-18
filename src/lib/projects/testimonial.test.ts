import { describe, expect, it } from 'vitest'
import { Maybe } from 'tsentials/maybe'

import { publicTestimonial } from './testimonial'

describe('project testimonial is public only with recorded consent', () => {
  it('returns the quote when consent is given', () => {
    expect(publicTestimonial({ quote: 'Çok memnun kaldık.', author: 'A. Yılmaz', consentGiven: true })).toEqual(
      Maybe.some({ quote: 'Çok memnun kaldık.', author: 'A. Yılmaz' }),
    )
  })
  it('hides it without consent, without a quote, or with a blank quote', () => {
    expect(Maybe.isNone(publicTestimonial({ quote: 'x', consentGiven: false }))).toBe(true)
    expect(Maybe.isNone(publicTestimonial({ consentGiven: true }))).toBe(true)
    expect(Maybe.isNone(publicTestimonial({ quote: '   ', consentGiven: true }))).toBe(true)
    expect(Maybe.isNone(publicTestimonial(null))).toBe(true)
  })
})
