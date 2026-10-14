import type { UIFieldServerComponent } from 'payload'
import { SystemDateTimeProvider } from 'tsentials/time'

import { monthUsage, summarizeUsage } from '@/ai/usage'
import './ai.css'

const TASK_LABELS: Record<string, string> = {
  tagImage: 'Görsel etiketleme',
  translate: 'Çeviri',
  draftGuide: 'Rehber taslağı',
  draftProjectStory: 'Proje hikayesi taslağı',
}
const usd = (n: number) => `${n.toFixed(2)} $`

/** This month's AI cost per task against the monthly limit (reads the same ai-usage rows as the budget stop). */
export const AiCostPanel: UIFieldServerComponent = async ({ payload, req, data }) => {
  const s = summarizeUsage(await monthUsage(payload, req, SystemDateTimeProvider), (data?.monthlyBudgetUsd as number | null | undefined) ?? null)
  return (
    <section className="ai-cost" aria-labelledby="ai-cost-title">
      <h2 id="ai-cost-title" className="ai-cost__title">Bu ayın AI maliyeti</h2>
      <p className="ai-cost__total">
        <strong>{usd(s.totalUsd)}</strong>
        {s.budgetUsd != null ? ` / ${usd(s.budgetUsd)} limit` : ' (aylık limit yok)'}
      </p>
      {s.usedPct != null && (
        <>
          <meter className="ai-cost__meter" min={0} max={100} low={70} high={90} optimum={0} value={s.usedPct} aria-label="Aylık limitin kullanılan kısmı" />
          <p className="ai-cost__note">
            %{Math.round(s.usedPct)} kullanıldı, kalan {usd(s.remainingUsd ?? 0)}.
            {s.usedPct >= 100 && ' Limit doldu: AI işleri ay sonuna kadar durur.'}
          </p>
        </>
      )}
      {s.tasks.length > 0 ? (
        <table className="ai-cost__table">
          <thead>
            <tr>
              <th scope="col">Görev</th>
              <th scope="col">Çağrı</th>
              <th scope="col">Maliyet</th>
            </tr>
          </thead>
          <tbody>
            {s.tasks.map((t) => (
              <tr key={t.task}>
                <td>{TASK_LABELS[t.task] ?? t.task}</td>
                <td>{t.calls}</td>
                <td>{usd(t.costUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="ai-cost__note">Bu ay henüz AI çağrısı yapılmadı.</p>
      )}
    </section>
  )
}
