import { Err } from 'tsentials/errors'
import { Result, type VoidResult } from 'tsentials/result'
import type { DateTimeProvider } from 'tsentials/time'

export function monthStart(clock: DateTimeProvider): Date {
  const n = clock.utcNow()
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1))
}

/**
 * Monthly AI spend cap (aiSettings.monthlyBudgetUsd); empty = no cap.
 * shortcut: check-then-spend is not atomic — parallel jobs can overshoot by ~one call each; fine at this volume, add a DB lock if usage grows.
 */
export function checkBudget(spentUsd: number, budgetUsd: number | null | undefined): VoidResult {
  if (budgetUsd == null) return Result.ok()
  return spentUsd < budgetUsd
    ? Result.ok()
    : Result.failure(Err.forbidden('AI.BudgetExceeded', `Aylık AI bütçesi doldu (${spentUsd.toFixed(2)}/${budgetUsd} $)`))
}
