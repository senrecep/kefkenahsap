import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { CONTAINER_SIZES, Container } from './Container'

// Tailwind 4 spacing is 0.25rem per step; max-w-7xl is 80rem. Rebuilding the string from the classes the Container
// actually renders catches a gutter or width change that forgets CONTAINER_SIZES.
describe('CONTAINER_SIZES', () => {
  it('matches the Container width and gutters', () => {
    const cls = renderToStaticMarkup(<Container>x</Container>).match(/class="([^"]+)"/)![1]!.split(' ')
    const step = (prefix: string) => Number(cls.find((c) => c.startsWith(prefix))!.slice(prefix.length)) * 0.25
    expect(cls).toContain('max-w-7xl')
    const max = 80 * 16
    const [mobile, md] = [step('px-'), step('md:px-')]
    expect(CONTAINER_SIZES).toBe(`(min-width: ${max}px) ${max - 2 * md * 16}px, (min-width: 768px) calc(100vw - ${2 * md}rem), calc(100vw - ${2 * mobile}rem)`)
  })
})
