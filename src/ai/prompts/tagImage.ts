import { z } from 'zod'

import { TURKISH_RULES } from './turkish'

export const TAG_IMAGE_PROMPT_VERSION = 'tagImage@2'

export const TagImageSchema = z.object({
  title: z.object({ tr: z.string().min(3).max(80), en: z.string().min(3).max(80) }),
  alt: z.object({ tr: z.string().min(5).max(125), en: z.string().min(5).max(125) }),
  caption: z.object({ tr: z.string().max(240), en: z.string().max(240) }),
  seoFilename: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(60),
  tags: z.object({
    wood: z.array(z.string()).max(3),
    setting: z.array(z.string()).max(4),
    finish: z.array(z.string()).max(3),
    stage: z.array(z.enum(['before', 'after', 'process', 'detail', 'finished'])).max(2),
  }),
  categoryAgrees: z.boolean(),
  confidence: z.number().min(0).max(1),
})
export type TagImageOutput = z.infer<typeof TagImageSchema>

export const tagImageSystem = (today: string) => `Sen bir ahşap dekorasyon firmasının (Kefken Ahşap Dekorasyon, İstanbul) gerçek iş fotoğraflarını tanımlayan bir editörsün.
Bugünün tarihi: ${today}.
Görev: Fotoğraf için Türkçe ve İngilizce başlık, alt metin (görme engelliler için, ≤125 karakter), kısa açıklama, SEO dosya adı (ASCII, tire ile, Türkçe kelimelerden) ve etiketler üret.
- Alt metin görüntüyü tarif etsin; "fotoğraf", "resim" diye başlama.
- Görsel üzerindeki filigran veya site adı yazısını hiçbir metne ekleme.
- Ahşap türünü (iroko, teak, çam, emprenyeli çam, thermowood…) yalnızca belirginse yaz; değilse wood dizisi boş kalsın.
- categoryAgrees: fotoğraf verilen kategoriye uyuyor mu.
${TURKISH_RULES}`
