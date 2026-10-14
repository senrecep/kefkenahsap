import { describe, expect, it } from 'vitest'

import { isAuthorized } from './basic-auth'

// "kefken:dev-pass" base64 = a2Vma2VuOmRldi1wYXNz (computed with `printf kefken:dev-pass | base64`)
describe('basic auth gate', () => {
  it('lets everything through when no credentials are configured', () => {
    expect(isAuthorized(null, undefined)).toBe(true)
    expect(isAuthorized(null, '')).toBe(true)
  })

  it('accepts the configured user:password', () => {
    expect(isAuthorized('Basic a2Vma2VuOmRldi1wYXNz', 'kefken:dev-pass')).toBe(true)
  })

  it('rejects a missing, malformed or wrong header', () => {
    expect(isAuthorized(null, 'kefken:dev-pass')).toBe(false)
    expect(isAuthorized('Bearer a2Vma2VuOmRldi1wYXNz', 'kefken:dev-pass')).toBe(false)
    expect(isAuthorized('Basic %%%', 'kefken:dev-pass')).toBe(false)
    expect(isAuthorized('Basic a2Vma2VuOndyb25n', 'kefken:dev-pass')).toBe(false) // kefken:wrong
  })
})

describe('basic auth gate: comparison', () => {
  it('handles UTF-8 passwords', () => {
    // printf 'kefken:şifre' | base64 → a2Vma2VuOsWfaWZyZQ==
    expect(isAuthorized('Basic a2Vma2VuOsWfaWZyZQ==', 'kefken:şifre')).toBe(true)
  })
  it('rejects a prefix of the expected credential', () => {
    expect(isAuthorized('Basic a2Vma2Vu', 'kefken:dev-pass')).toBe(false) // "kefken"
  })
})
