import { describe, expect, it } from 'vitest'

import { contentTypeFor, needsUpdate } from './backfillCacheControl'

const IMMUTABLE = 'public, max-age=31536000, immutable'

describe('needsUpdate', () => {
  it('is true without a Cache-Control', () => expect(needsUpdate({})).toBe(true))
  it('is true for any other value', () => expect(needsUpdate({ CacheControl: 'max-age=60' })).toBe(true))
  it('is false once the immutable header is there', () => expect(needsUpdate({ CacheControl: IMMUTABLE })).toBe(false))
})

describe('contentTypeFor', () => {
  it('keeps the stored type, even when the extension says otherwise', () => expect(contentTypeFor('image/webp', 'a.jpg')).toBe('image/webp'))
  it.each([
    ['dev/foo-480x320.webp', 'image/webp'],
    ['dev/foo.JPG', 'image/jpeg'],
    ['dev/foo.png', 'image/png'],
    ['dev/foo.pdf', 'application/pdf'],
  ])('infers %s -> %s when none is stored', (key, type) => expect(contentTypeFor(undefined, key)).toBe(type))
  it('treats a stored generic binary type as missing', () => expect(contentTypeFor('binary/octet-stream', 'a.webp')).toBe('image/webp'))
  it('falls back to a generic binary type', () => expect(contentTypeFor(undefined, 'dev/no-extension')).toBe('application/octet-stream'))
})
