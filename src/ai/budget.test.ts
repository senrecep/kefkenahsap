import { describe, expect, it } from 'vitest'
import { Result } from 'tsentials/result'
import { createFakeDateTimeProvider } from 'tsentials/time'

import { checkBudget, monthStart } from './budget'

describe('AI budget', () => {
  it('month starts at 00:00 UTC on the 1st', () => {
    const clock = createFakeDateTimeProvider(new Date('2026-10-14T05:00:00Z'))
    expect(monthStart(clock).toISOString()).toBe('2026-10-01T00:00:00.000Z')
  })
  it('allows spending below the limit and blocks at/over it', () => {
    expect(Result.isSuccess(checkBudget(4.99, 5))).toBe(true)
    const r = checkBudget(5, 5)
    expect(Result.isFailure(r) && r.errors[0]?.code).toBe('AI.BudgetExceeded')
  })
  it('no limit configured means no cap', () => {
    expect(Result.isSuccess(checkBudget(1000, null))).toBe(true)
  })
})
