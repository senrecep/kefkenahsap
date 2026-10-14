import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { tagImageSystem } from './tagImage'

// #50 acceptance: every prompt carries the Turkish rules and points at the style guide they summarise.
describe('Turkish rules', () => {
  it('reference docs/CONTENT-STYLE-TR.md, which exists', () => {
    expect(tagImageSystem('2026-10-14')).toContain('docs/CONTENT-STYLE-TR.md')
    expect(existsSync(path.resolve(__dirname, '../../../docs/CONTENT-STYLE-TR.md'))).toBe(true)
  })
})
