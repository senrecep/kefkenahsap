// #140: the per-locale site-settings patch from a seed translation, filling only empty values (owner edits win).
import type { SiteSetting } from '@/payload-types'

import { fillEmpty, isEmpty } from './merge'
import type { SiteSettingsOverlay } from './schema'

// Read with fallbackLocale: false, so a required localized label can still be empty in that locale.
type Loose<T> = { [K in keyof T]?: T[K] | null }
type Current = {
  phones?: Loose<NonNullable<SiteSetting['phones']>[number]>[] | null
  areaServed?: Loose<NonNullable<SiteSetting['areaServed']>[number]>[] | null
  whatsappTemplates?: SiteSetting['whatsappTemplates']
  defaultDescription?: string | null
}

/**
 * Phone labels are matched on the number, area names on position. Rows go back whole (with their ids), since a
 * localized field inside an array is written through its row; label/name are required, so an array is only sent once
 * every row has one (a row the owner added without a translation leaves it to the owner). An empty patch means "skip".
 */
export function siteSettingsFill(current: Current, overlay: SiteSettingsOverlay): Current {
  const patch: Current = fillEmpty({ defaultDescription: current.defaultDescription }, { defaultDescription: overlay.defaultDescription })
  const templates = fillEmpty(current.whatsappTemplates ?? {}, overlay.whatsappTemplates ?? {})
  if (Object.keys(templates).length) patch.whatsappTemplates = { ...current.whatsappTemplates, ...templates }

  const phones = current.phones?.map((p) => {
    const label = overlay.phones?.find((o) => o.number === p.number)?.label
    return label && isEmpty(p.label) ? { ...p, label } : p
  })
  if (phones?.some((p, i) => p !== current.phones![i]) && phones.every((p) => !isEmpty(p.label))) patch.phones = phones

  const areas = current.areaServed?.map((a, i) => {
    const name = overlay.areaServed?.[i]?.name
    return name && isEmpty(a.name) ? { ...a, name } : a
  })
  if (areas?.some((a, i) => a !== current.areaServed![i]) && areas.every((a) => !isEmpty(a.name))) patch.areaServed = areas
  return patch
}
