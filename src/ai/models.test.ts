import { describe, expect, it } from 'vitest'

import { aiModel, DEFAULT_CHAINS, isFakeAi, resolveChain } from './models'

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

describe('aiModel (the one getter every task uses)', () => {
  it('answers from the fake under AI_FAKE_PROVIDER=1 (tests), keeping the requested model id', async () => {
    expect(process.env.AI_FAKE_PROVIDER).toBe('1')
    const m = (await aiModel('translate')('x/picked-in-admin')) as unknown as { provider: string; modelId: string }
    expect(m.provider).toBe('fake')
    expect(m.modelId).toBe('x/picked-in-admin')
  })
  it('has a default chain for every task, including draftProjectStory', () => {
    expect(resolveChain('draftProjectStory', {}, {})).toEqual(['anthropic/claude-sonnet-5.5', 'google/gemini-3.8-flash'])
  })
})

describe('isFakeAi: the fake never runs in a deployed image', () => {
  it('on only with AI_FAKE_PROVIDER=1 and no SITE_ENV', () => {
    expect(isFakeAi({ AI_FAKE_PROVIDER: '1' })).toBe(true)
    expect(isFakeAi({})).toBe(false)
    expect(isFakeAi({ AI_FAKE_PROVIDER: 'true' })).toBe(false)
  })
  it('SITE_ENV (development or production image) wins over AI_FAKE_PROVIDER', () => {
    expect(isFakeAi({ AI_FAKE_PROVIDER: '1', SITE_ENV: 'production' })).toBe(false)
    expect(isFakeAi({ AI_FAKE_PROVIDER: '1', SITE_ENV: 'development' })).toBe(false)
  })
})
