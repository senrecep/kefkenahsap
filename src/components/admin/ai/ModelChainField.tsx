import type { TextFieldServerComponent } from 'payload'

import { modelCatalog } from '@/ai/catalog'
import { ModelChainInput } from './ModelChainInput'

/** aiSettings chain field: ordered model ids, suggested from OpenRouter's list (1 h cache); free text when the list is unavailable. */
export const ModelChainField: TextFieldServerComponent = async ({ path, field }) => {
  const list = await modelCatalog.list()
  return (
    <ModelChainInput
      path={path ?? field.name}
      label={typeof field.label === 'string' ? field.label : field.name}
      models={list.ok ? list.value.map((m) => m.id) : []}
      listFailed={!list.ok}
    />
  )
}
