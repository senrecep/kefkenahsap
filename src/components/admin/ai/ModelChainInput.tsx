'use client'

import { useField } from '@payloadcms/ui'
import { useId } from 'react'

import './ai.css'

type Props = { path: string; label: string; models: string[]; listFailed: boolean }

/** Ordered list of model ids: the first is tried first. Inputs suggest from the OpenRouter list but accept any id. */
export function ModelChainInput({ path, label, models, listFailed }: Props) {
  const { value, setValue } = useField<string[] | null>({ path })
  const chain = value ?? []
  const listId = useId()
  const set = (next: string[]) => setValue(next)
  const move = (i: number) => set(chain.map((m, j) => (j === i - 1 ? chain[i]! : j === i ? chain[i - 1]! : m)))

  return (
    <fieldset className="ai-chain">
      <legend className="ai-chain__label">{label}</legend>
      <p className="ai-chain__hint" id={`${listId}-hint`}>
        Sırayla denenir; ilk model hata verirse sonraki kullanılır. Boşsa varsayılan zincir geçerlidir.
        {listFailed && ' Model listesi şu an alınamadı; model kimliğini elle yazın (ör. anthropic/claude-sonnet-5.5).'}
      </p>
      {models.length > 0 && (
        <datalist id={listId}>
          {models.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      )}
      <ol className="ai-chain__list">
        {chain.map((model, i) => (
          <li key={i} className="ai-chain__row">
            <input
              className="ai-chain__input"
              list={models.length ? listId : undefined}
              value={model}
              aria-label={`${label}: ${i + 1}. model`}
              aria-describedby={`${listId}-hint`}
              placeholder="saglayici/model-adi"
              onChange={(e) => set(chain.map((m, j) => (j === i ? e.target.value : m)))}
            />
            <button type="button" className="ai-btn ai-btn--quiet" disabled={i === 0} onClick={() => move(i)} aria-label={`${i + 1}. modeli yukarı taşı`}>
              ↑
            </button>
            <button type="button" className="ai-btn ai-btn--quiet" onClick={() => set(chain.filter((_, j) => j !== i))} aria-label={`${i + 1}. modeli kaldır`}>
              Kaldır
            </button>
          </li>
        ))}
      </ol>
      <button type="button" className="ai-btn" onClick={() => set([...chain, ''])}>
        Model ekle
      </button>
    </fieldset>
  )
}
