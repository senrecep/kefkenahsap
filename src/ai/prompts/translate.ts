import { Err } from 'tsentials/errors'
import { Result } from 'tsentials/result'
import { z } from 'zod'

import type { Segment } from '../translate/segments'
import { TURKISH_RULES } from './turkish'

export const TRANSLATE_PROMPT_VERSION = 'translate@1'

export type GlossaryEntry = { tr: string; en: string }

/** docs/CONTENT-STYLE-TR.md §8 (TR ↔ EN). Used when Admin › AI Ayarları › Terim sözlüğü is empty. */
export const DEFAULT_GLOSSARY: GlossaryEntry[] = [
  { tr: 'deck, ahşap zemin', en: 'deck (the structure), decking (the floor material)' },
  { tr: 'deck tahtası', en: 'deck board' },
  { tr: 'kamelya', en: 'gazebo' },
  { tr: 'pergola', en: 'pergola' },
  { tr: 'çardak', en: 'arbour (not gazebo)' },
  { tr: 'emprenye, emprenyeli', en: 'pressure-treated (timber), never "impregnated"' },
  { tr: 'emprenyeli çam', en: 'pressure-treated pine' },
  { tr: 'iroko', en: 'iroko' },
  { tr: 'teak', en: 'teak' },
  { tr: 'thermowood, ısıl işlem görmüş ahşap', en: 'thermally modified timber (thermowood)' },
  { tr: 'çam, sarıçam', en: 'pine, Scots pine' },
  { tr: 'meşe', en: 'oak' },
  { tr: 'sert ağaç / yumuşak ağaç', en: 'hardwood / softwood' },
  { tr: 'korkuluk', en: 'railing; balustrade' },
  { tr: 'küpeşte', en: 'handrail' },
  { tr: 'çit', en: 'fence' },
  { tr: 'bahçe kapısı', en: 'garden gate' },
  { tr: 'seperatör (bölme)', en: 'partition, room divider' },
  { tr: 'cila', en: 'lacquer, polish (general: finish)' },
  { tr: 'vernik', en: 'varnish' },
  { tr: 'ahşap yağı', en: 'wood oil, decking oil' },
  { tr: 'boya', en: 'paint, stain' },
  { tr: 'zımpara', en: 'sandpaper (material), sanding (process)' },
  { tr: 'bakım', en: 'maintenance' },
  { tr: 'iskele (su kenarı)', en: 'jetty, pier' },
  { tr: 'iskele (yapı)', en: 'scaffolding' },
  { tr: 'köprü (bahçe)', en: '(garden) footbridge' },
  { tr: 'merdiven / basamak', en: 'staircase / step, tread' },
  { tr: 'çiçeklik', en: 'planter' },
  { tr: 'oturma grubu', en: 'seating set' },
  { tr: 'kaplama (cephe)', en: 'cladding' },
  { tr: 'atölye', en: 'workshop' },
  { tr: 'keşif', en: 'site visit' },
  { tr: 'ölçü / teklif', en: 'measurement / quote' },
  { tr: 'imalat / montaj', en: 'fabrication / installation' },
  { tr: 'usta', en: 'craftsman, master carpenter' },
]

/** The admin glossary (aiSettings.glossary) wins; empty → the §8 default. */
export function glossaryFrom(rows: readonly { tr?: string | null; en?: string | null }[] | null | undefined): GlossaryEntry[] {
  const g = (rows ?? []).filter((r) => r.tr?.trim() && r.en?.trim()).map((r) => ({ tr: r.tr!.trim(), en: r.en!.trim() }))
  return g.length ? g : DEFAULT_GLOSSARY
}

export function translateSystem(a: { glossary: GlossaryEntry[]; source: string; targets: string[] }): string {
  return `Kefken Ahşap (İstanbul'da ahşap imalat ve montaj yapan bir firma) web sitesinin içeriğini çeviriyorsun: ${a.targets.map((t) => `${a.source} → ${t}`).join(', ')}.

Girdi JSON: { source, targets, segments: [{ id, text }] }. Her segment için her hedef dilde bir çeviri döndür: { items: [{ id, <hedef dil>: "…" }] }.
- Segmentler zengin metnin parçaları olabilir (bir cümlenin kalın yazılmış kısmı, bir bağlantının metni). Her segmenti kendi yerinde, cümlenin geri kalanıyla uyumlu çevir; birleştirme, bölme, atlama.
- Yalnızca metni çevir. Yeni bilgi, sayı, yıl, fiyat, iddia ekleme; olanı çıkarma. Firma adı "Kefken Ahşap", kişi ve yer adları, ölçüler ve birimler aynen kalır.
- Doğal, sade bir dil kullan; kelimesi kelimesine çeviri yapma. Pazarlama abartısı ekleme.
- Aşağıdaki terim sözlüğüne uy (TR = EN). Sözlükteki bir terim geçiyorsa karşılığını kullan.
${a.glossary.map((g) => `  - ${g.tr} = ${g.en}`).join('\n')}

Hedef dil Türkçe ise:
${TURKISH_RULES}`
}

/** Output bounds: a segment is one text node or field (source ≤ 20k chars per press in total). */
const MAX_SEGMENT_OUT = 8000
const MAX_ITEMS = 2000

export const translateInput = (segments: Segment[], source: string, targets: string[]) => JSON.stringify({ source, targets, segments })

export const translateSchema = (targets: string[]) =>
  z.object({
    items: z.array(z.object({ id: z.string().max(80), ...Object.fromEntries(targets.map((t) => [t, z.string().max(MAX_SEGMENT_OUT)])) })).max(MAX_ITEMS),
  })

/** id → text per target locale. Every segment needs a non-blank answer in every locale; edge spaces come from the source. */
export function toSegmentMap(
  output: { items: Record<string, string>[] },
  segments: Segment[],
  targets: string[],
): Result<Record<string, Record<string, string>>> {
  const byId = new Map(output.items.map((i) => [i.id, i]))
  const out: Record<string, Record<string, string>> = Object.fromEntries(targets.map((t) => [t, {}]))
  for (const s of segments) {
    for (const t of targets) {
      const v = byId.get(s.id)?.[t]
      if (!v?.trim()) return Result.failure(Err.validation('Translate.SchemaMismatch', `Çeviri eksik: ${s.id} (${t})`))
      out[t]![s.id] = s.text.match(/^\s*/)![0] + v.trim() + s.text.match(/\s*$/)![0]
    }
  }
  return Result.success(out)
}
