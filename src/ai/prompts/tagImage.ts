import { z } from 'zod'

import { routing } from '@/i18n/routing'

import { TURKISH_RULES } from './turkish'

export const TAG_IMAGE_PROMPT_VERSION = 'tagImage@4'

const LOCALES = routing.locales
type Locale = (typeof LOCALES)[number]
/** One string per site locale. */
const perLocale = (s: z.ZodString) => z.object(Object.fromEntries(LOCALES.map((l) => [l, s])) as Record<Locale, z.ZodString>)
/** A stored suggestion's texts: TR and EN always (tagImage@2/@3 wrote only those), the other locales when present. */
const storedPerLocale = (s: z.ZodString) =>
  z.object(Object.fromEntries(LOCALES.map((l) => [l, l === 'tr' || l === 'en' ? s : s.optional()])) as Record<Locale, z.ZodOptional<z.ZodString>>)

// #192: one call returns the texts in every site locale (tagImage@4); before it only TR and EN.
export const TITLE = z.string().min(3).max(80)
export const ALT = z.string().min(5).max(125)
export const CAPTION = z.string().max(240)

export const TagImageSchema = z.object({
  title: perLocale(TITLE),
  alt: perLocale(ALT),
  caption: perLocale(CAPTION),
  seoFilename: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(60),
  tags: z.object({
    // #171: product types, names from the list in the user message (tagImageTypesLine); [] when unsure.
    type: z.array(z.string()).max(3),
    wood: z.array(z.string()).max(3),
    setting: z.array(z.string()).max(4),
    finish: z.array(z.string()).max(3),
    stage: z.array(z.enum(['before', 'after', 'process', 'detail', 'finished'])).max(2),
  }),
  categoryAgrees: z.boolean(),
  confidence: z.number().min(0).max(1),
})
export type TagImageOutput = z.infer<typeof TagImageSchema>
/**
 * Reads stored suggestions and seed metadata: one written before tagImage@3 has no `type`, which reads as none, and one
 * written before tagImage@4 has texts only in TR and EN.
 */
export const StoredTagImageSchema = TagImageSchema.extend({
  title: storedPerLocale(TITLE),
  alt: storedPerLocale(ALT),
  caption: storedPerLocale(CAPTION),
  tags: TagImageSchema.shape.tags.extend({ type: TagImageSchema.shape.tags.shape.type.default([]) }),
})

/** How each site locale is written; typed per locale, so a new locale in routing does not compile without its line. */
export const LANGUAGE_GUIDANCE: Record<Locale, string> = {
  tr: 'aşağıdaki Türkçe yazım kurallarına uy.',
  en: 'sade, uluslararası İngilizce.',
  ru: 'doğal Rusça, yerli bir editörün yazacağı gibi.',
  de: 'doğal Almanca, nesnel tarif (hitap yok).',
  ar: 'Modern Standart Arapça (MSA, fusha); cansız çoğullar dişil uyum alır.',
}

// House terms per language, from docs/CONTENT-STYLE-TR.md §8 and the native-editor review in PR #181.
export const TERMS = `Terimler (TR → EN / RU / DE / AR):
  - deck, ahşap zemin → decking / настил, дек (deck tahtası: террасная доска; "деккинг" değil) / Terrasse, Terrassenboden (deck tahtası: Terrassendielen; "Deckdielen" değil) / ديكينغ (asla ديك)
  - deck alt yapısı (kiriş) → joists, subframe / лаги / Unterkonstruktion / الهيكل السفلي
  - kamelya → gazebo / беседка / Pavillon / كشك (eril; asla كاميليا)
  - pergola → pergola / пергола / Pergola / برجولة
  - çardak → arbour / беседка / Laube / عريشة
  - emprenyeli çam → pressure-treated pine / сосна, пропитанная под давлением / kesseldruckimprägnierte Kiefer / خشب صنوبر معالج بالضغط
  - masif ahşap → solid wood / массив дерева / Massivholz / خشب طبيعي مصمت (sert ağaç değil)
  - korkuluk → railing / ограждение / Geländer / درابزين
  - kaplama (cephe) → cladding / обшивка / Verkleidung / تكسية`

export const tagImageSystem = (today: string) => `Sen bir ahşap dekorasyon firmasının (Kefken Ahşap Dekorasyon, İstanbul) gerçek iş fotoğraflarını tanımlayan bir editörsün.
Bugünün tarihi: ${today}.
Görev: Fotoğraf için başlık (≤80 karakter), alt metin (görme engelliler için, ≤125 karakter) ve kısa açıklama (≤240 karakter) üret; her birini şu dillerin her birinde ayrı yaz: ${LOCALES.map((l) => `"${l}"`).join(', ')}. Ayrıca SEO dosya adı (ASCII, tire ile, Türkçe kelimelerden) ve etiketler üret.
- Önce Türkçesini yaz; diğer diller aynı bilgiyi verir, ne fazla ne eksik. Her dili o dilin yerlisi yazmış gibi doğal yaz, kelimesi kelimesine çevirme.
${LOCALES.map((l) => `- ${l}: ${LANGUAGE_GUIDANCE[l]}`).join('\n')}
- Alt metin görüntüyü tarif etsin; "fotoğraf", "resim" diye başlama.
- Görsel üzerindeki filigran veya site adı yazısını hiçbir metne ekleme.
- Ahşap türünü (iroko, teak, çam, emprenyeli çam, thermowood…) yalnızca belirginse yaz; değilse wood dizisi boş kalsın.
- Ürün türü (type): yalnızca mesajdaki "Ürün türleri" listesinden, adı listede yazıldığı gibi seç (en çok 3); emin değilsen type dizisi boş kalsın.
- categoryAgrees: fotoğraf verilen kategoriye uyuyor mu.
${TERMS}
Türkçe metinler için:
${TURKISH_RULES}`

/** The user-message line offering the existing product-type tags (TR names) to choose from. */
export const tagImageTypesLine = (names: string[]) => `Ürün türleri: ${JSON.stringify(names)}`

/** The suggested types that are in the offered list, spelled as the list spells them, deduplicated, at most 3. */
export function knownTypes(suggested: string[], names: string[]): string[] {
  const norm = (s: string) => s.trim().toLocaleLowerCase('tr')
  const byNorm = new Map(names.map((n) => [norm(n), n]))
  return [...new Set(suggested.map((s) => byNorm.get(norm(s))).filter((n): n is string => n !== undefined))].slice(0, 3)
}
