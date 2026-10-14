import { describe, expect, it } from 'vitest'

import { DEFAULT_CHAINS, resolveChain } from './models'

describe('resolveChain (env > admin settings > defaults)', () => {
  it('uses the defaults from docs/SPIKE.md', () => {
    expect(DEFAULT_CHAINS.tagImage).toEqual(['google/gemini-3.8-flash', 'anthropic/claude-haiku-5.5'])
    expect(DEFAULT_CHAINS.translate).toEqual(['anthropic/claude-sonnet-5.5', 'google/gemini-3.8-flash'])
    expect(resolveChain('tagImage', {}, {})).toEqual(DEFAULT_CHAINS.tagImage)
  })
  it('admin settings override defaults (blank entries ignored)', () => {
    expect(resolveChain('tagImage', { tagImage: ['x/a', ' ', 'x/b'] }, {})).toEqual(['x/a', 'x/b'])
  })
  it('env overrides everything (comma separated)', () => {
    expect(resolveChain('tagImage', { tagImage: ['x/a'] }, { AI_TAGIMAGE_MODELS: 'e/1, e/2' })).toEqual(['e/1', 'e/2'])
  })
})
