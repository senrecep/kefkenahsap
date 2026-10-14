import { z } from 'zod'

import { TURKISH_RULES } from './turkish'

export const DRAFT_PROMPT_VERSION = 'draft@1'

export const GuideDraftSchema = z.object({
  excerpt: z.string().min(1).max(1200),
  sections: z.array(z.object({ heading: z.string().min(1), paragraphs: z.array(z.string()), bullets: z.array(z.string()) })).min(1).max(8),
})
export const StoryDraftSchema = z.object({ paragraphs: z.array(z.string().min(1)).min(1).max(4) })
export type GuideDraft = z.infer<typeof GuideDraftSchema>
export type StoryDraft = z.infer<typeof StoryDraftSchema>

const SHAPE = {
  guides: `Bir rehber yazısı taslağı: "excerpt" soruya doğrudan cevap veren kısa bir giriş paragrafı (en çok 150 kelime); "sections" her biri bir ara başlık (soru biçiminde olabilir), 1–3 kısa paragraf ve gerekiyorsa madde listesi.`,
  projects: `Bir proje hikayesi taslağı: "paragraphs" 1–3 kısa paragraf; ne yapıldı, nerede, hangi malzemeyle, nasıl bir sonuç çıktı.`,
}

/** "AI ile taslak" (#56). Facts: only the notes, the photo captions and the site settings lines; nothing else. */
export function draftSystem(kind: keyof typeof SHAPE, facts: string[]): string {
  return `Kefken Ahşap'ın (İstanbul'da ahşap imalat ve montaj) web sitesi için Türkçe taslak yazıyorsun. Taslağı bir insan okuyup düzeltecek ve kendisi yayınlayacak.

Girdi JSON: { title, notes: [...], photos: [fotoğraf açıklamaları] }.
${SHAPE[kind]}

Doğruluk kuralı (en önemlisi):
- Yalnızca notlarda, fotoğraf açıklamalarında ve aşağıdaki bilinen olgularda yazan olguları kullan. Bunları yeniden ifade edebilir, sıralayabilir, bağlayabilirsin.
- Bunların dışında hiçbir olgu ekleme: yıl, süre, ölçü, sayı, fiyat, garanti, sertifika, marka, müşteri sözü, "yılların deneyimi" gibi iddialar yazma.
- Bir bilgi eksikse uydurma; o kısmı kısa tut ya da hiç yazma.

Bilinen olgular (Site Bilgileri):
${facts.length ? facts.map((f) => `- ${f}`).join('\n') : '- (yok)'}

${TURKISH_RULES}`
}

export const draftInput = (title: string, notes: string[], photos: string[]) => JSON.stringify({ title, notes, photos })
