import type { Payload, PayloadRequest } from 'payload'
import type { DateTimeProvider } from 'tsentials/time'

import { monthStart } from './budget'

type Row = { task: string; costUsd?: number | null }

export type UsageSummary = {
  tasks: { task: string; costUsd: number; calls: number }[]
  totalUsd: number
  budgetUsd: number | null
  usedPct: number | null
  remainingUsd: number | null
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6

/** This month's AI spend per task against the monthly limit (aiSettings cost panel). */
export function summarizeUsage(rows: readonly Row[], budgetUsd: number | null | undefined): UsageSummary {
  const by = new Map<string, { task: string; costUsd: number; calls: number }>()
  for (const r of rows) {
    const t = by.get(r.task) ?? { task: r.task, costUsd: 0, calls: 0 }
    t.costUsd = round6(t.costUsd + (r.costUsd ?? 0))
    t.calls++
    by.set(r.task, t)
  }
  const tasks = [...by.values()].sort((a, b) => b.costUsd - a.costUsd)
  const totalUsd = round6(tasks.reduce((s, t) => s + t.costUsd, 0))
  if (budgetUsd == null) return { tasks, totalUsd, budgetUsd: null, usedPct: null, remainingUsd: null }
  return {
    tasks,
    totalUsd,
    budgetUsd,
    usedPct: budgetUsd <= 0 ? 100 : Math.min(100, round6((totalUsd / budgetUsd) * 100)),
    remainingUsd: Math.max(0, round6(budgetUsd - totalUsd)),
  }
}

/** ai-usage rows since the 1st of this month (UTC): the budget stop and the cost panel read the same rows. */
export async function monthUsage(payload: Payload, req: PayloadRequest | undefined, clock: DateTimeProvider) {
  const res = await payload.find({
    collection: 'ai-usage',
    where: { createdAt: { greater_than_equal: monthStart(clock).toISOString() } },
    pagination: false,
    depth: 0,
    ...(req ? { req } : {}),
  })
  return res.docs
}
