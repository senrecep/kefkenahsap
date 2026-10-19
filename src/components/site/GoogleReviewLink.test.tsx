import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { GoogleReviewLink } from './GoogleReviewLink'

describe('GoogleReviewLink', () => {
  it.each([undefined, null, ''])('renders nothing when the link is empty (%o)', (href) => {
    expect(renderToStaticMarkup(<GoogleReviewLink href={href} place="footer">Yorum</GoogleReviewLink>)).toBe('')
  })

  it('opens the review link in a new tab without leaking the opener or referrer', () => {
    const html = renderToStaticMarkup(<GoogleReviewLink href="https://g.page/r/X/review" place="footer">Yorum</GoogleReviewLink>)
    expect(html).toContain('href="https://g.page/r/X/review"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('data-umami-event="google_review_click"')
    expect(html).toContain('data-umami-event-place="footer"')
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/)
    expect(html).toContain('Yorum</a>')
  })
})
