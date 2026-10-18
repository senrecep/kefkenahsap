import { z } from 'zod'

import type { Locale } from '@/i18n/routing'
import { SYNC_FIELDS, type SyncField } from '@/lib/media/i18nSync'

import { ALT, CAPTION, LANGUAGE_GUIDANCE, TERMS, TITLE } from './tagImage'
import type { GlossaryEntry } from './translate'

// #203: a photo's TR title/alt/caption into the other site locales after the owner edits the TR text.
export const TRANSLATE_MEDIA_PROMPT_VERSION = 'translateMedia@1'

const LIMITS: Record<SyncField, z.ZodString> = { title: TITLE, alt: ALT, caption: CAPTION }

/**
 * Input is the translate segments format (`translateInput`), one segment per changed field, id = the field name.
 * The JSON schema caps every answer at 240 characters; the per-field limits run after parsing, so an over-long title
 * fails the model and the chain moves on.
 */
export const translateMediaSchema = (targets: string[]) =>
  z
    .object({
      items: z.array(z.object({ id: z.enum(SYNC_FIELDS), ...Object.fromEntries(targets.map((t) => [t, z.string().max(240)])) })).max(SYNC_FIELDS.length),
    })
    .superRefine((v, ctx) =>
      v.items.forEach((item, i) => {
        for (const t of targets)
          if (!LIMITS[item.id].safeParse((item as Record<string, unknown>)[t]).success)
            ctx.addIssue({ code: 'custom', path: ['items', i, t], message: `${item.id} (${t}) is outside its length limit` })
      }),
    )

export const translateMediaSystem = (a: { glossary: GlossaryEntry[]; targets: Locale[] }) =>
  `Kefken Ahşap Dekorasyon'un (İstanbul'da ahşap imalat ve montaj) gerçek iş fotoğraflarının metinlerini çeviriyorsun: tr → ${a.targets.join(', ')}.

Girdi JSON: { source, targets, segments: [{ id, text }] }. id "title" başlıktır (≤80 karakter), "alt" görme engelliler için alt metindir (≤125 karakter), "caption" kısa açıklamadır (≤240 karakter). Her segment için her hedef dilde bir metin döndür: { items: [{ id, <hedef dil>: "…" }] }.
- Türkçe metinle aynı bilgiyi ver, ne fazla ne eksik. Yeni bilgi, ahşap türü, ölçü ya da iddia ekleme.
- Her dili o dilin yerlisi yazmış gibi doğal yaz, kelimesi kelimesine çevirme.
${a.targets.map((l) => `- ${l}: ${LANGUAGE_GUIDANCE[l]}`).join('\n')}
- Alt metin görüntüyü tarif etsin; "fotoğraf", "resim" diye başlama.
- Firma adı "Kefken Ahşap", kişi ve yer adları aynen kalır.
${TERMS}
Terim sözlüğü (TR = EN); sözlükteki bir terim geçiyorsa karşılığını kullan:
${a.glossary.map((g) => `  - ${g.tr} = ${g.en}`).join('\n')}`
