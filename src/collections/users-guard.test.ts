import { describe, expect, it } from 'vitest'

import { canDemoteAdmin } from './Users'

describe('last-admin guard', () => {
  it('blocks demoting the only admin', () => expect(canDemoteAdmin(1)).toBe(false))
  it('allows demotion when another admin remains', () => expect(canDemoteAdmin(2)).toBe(true))
})
