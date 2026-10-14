// #140: site-settings seed patches, filling only empty values (owner edits win).
import type { SiteSetting } from '@/payload-types'

import { fillEmpty, isEmpty } from './merge'
import type { SiteSettingsOverlay } from './schema'

export const TR_WHATSAPP_TEMPLATES = {
  default: 'Merhaba, ahşap işleriniz hakkında bilgi almak istiyorum.',
  category: 'Merhaba, {category} hakkında bilgi almak istiyorum. ({url})',
  project: 'Merhaba, {project} projenize benzer bir iş için bilgi almak istiyorum. ({url})',
  image: 'Merhaba, bu fotoğraftaki işe benzer bir uygulama için bilgi almak istiyorum: {url}',
  contact: 'Merhaba, teklif almak istiyorum.',
}

export const EN_WHATSAPP_TEMPLATES: typeof TR_WHATSAPP_TEMPLATES = {
  default: 'Hello, I would like information about your woodwork.',
  category: 'Hello, I would like information about {category}. ({url})',
  project: 'Hello, I would like information about a job similar to {project}. ({url})',
  image: 'Hello, I would like information about work like this photo: {url}',
  contact: 'Hello, I would like a quote.',
}

/**
 * fillEmpty one level down: a group (address, founder, …) is filled per sub-field and sent back whole; an array only
 * when it has no rows yet (resending existing rows would drop their labels in the other locales).
 */
export function fillEmptyGroups(current: Record<string, unknown>, incoming: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(incoming)) {
    const cur = current[key]
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const sub = fillEmpty((cur ?? {}) as Record<string, unknown>, value as Record<string, unknown>)
      if (Object.keys(sub).length) patch[key] = { ...(cur as object), ...sub }
    } else if (!isEmpty(value) && isEmpty(cur)) patch[key] = value
  }
  return patch
}

// Read with fallbackLocale: false, so a required localized label can still be empty in that locale.
type Loose<T> = { [K in keyof T]?: T[K] | null }
type Current = {
  phones?: Loose<NonNullable<SiteSetting['phones']>[number]>[] | null
  areaServed?: Loose<NonNullable<SiteSetting['areaServed']>[number]>[] | null
  whatsappTemplates?: SiteSetting['whatsappTemplates']
  defaultDescription?: string | null
}

/**
 * Phone labels are matched on the number, area names on the kind. Rows go back whole (with their ids), since a
 * localized field inside an array is written through its row; label/name are required, so an array is only sent once
 * every row has one (a row the owner added without a translation leaves it to the owner). An empty patch means "skip".
 */
export function siteSettingsFill(current: Current, overlay: SiteSettingsOverlay): Current {
  const patch: Current = fillEmptyGroups(current, { defaultDescription: overlay.defaultDescription, whatsappTemplates: overlay.whatsappTemplates }) as Current

  const phones = current.phones?.map((p) => {
    const label = overlay.phones?.find((o) => o.number === p.number)?.label
    return label && isEmpty(p.label) ? { ...p, label } : p
  })
  if (phones?.some((p, i) => p !== current.phones![i]) && phones.every((p) => !isEmpty(p.label))) patch.phones = phones

  const areas = current.areaServed?.map((a) => {
    const name = overlay.areaServed?.find((o) => o.kind === a.kind)?.name
    return name && isEmpty(a.name) ? { ...a, name } : a
  })
  if (areas?.some((a, i) => a !== current.areaServed![i]) && areas.every((a) => !isEmpty(a.name))) patch.areaServed = areas
  return patch
}
