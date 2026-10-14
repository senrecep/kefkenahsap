import { describe, expect, it } from 'vitest'

import { summarizeUsage } from './usage'

describe('summarizeUsage (cost panel)', () => {
  const rows = [
    { task: 'tagImage', costUsd: 0.25 },
    { task: 'tagImage', costUsd: 0.5 },
    { task: 'translate', costUsd: 1 },
    { task: 'translate', costUsd: null }, // failed call: no cost reported
  ]

  it('sums cost and calls per task, most expensive first', () => {
    const s = summarizeUsage(rows, 10)
    expect(s.tasks).toEqual([
      { task: 'translate', costUsd: 1, calls: 2 },
      { task: 'tagImage', costUsd: 0.75, calls: 2 },
    ])
    expect(s.totalUsd).toBe(1.75)
  })

  it('reports the share of the monthly limit used, capped at 100', () => {
    expect(summarizeUsage(rows, 10).usedPct).toBe(17.5)
    expect(summarizeUsage(rows, 1).usedPct).toBe(100)
    expect(summarizeUsage(rows, 10).remainingUsd).toBe(8.25)
    expect(summarizeUsage(rows, 1).remainingUsd).toBe(0)
  })

  it('no limit set: nothing to compare against', () => {
    const s = summarizeUsage(rows, null)
    expect(s.budgetUsd).toBeNull()
    expect(s.usedPct).toBeNull()
    expect(s.remainingUsd).toBeNull()
  })

  it('a zero limit is fully used', () => {
    expect(summarizeUsage([], 0).usedPct).toBe(100)
  })
})
