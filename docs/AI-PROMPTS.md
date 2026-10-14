# AI prompt kuralları

Kod: `src/ai/` (zincir: `models.ts`, çalıştırıcı: `run.ts`, prompt'lar: `prompts/*.ts`, her prompt bir sürüm sabiti taşır).

## Modeller (OpenRouter)
| Görev | Varsayılan zincir | Override |
|---|---|---|
| tagImage (vision) | `google/gemini-3.8-flash` → `anthropic/claude-haiku-5.5` | `AI_TAGIMAGE_MODELS` env > Admin › AI Ayarları |
| translate | `anthropic/claude-sonnet-5.5` → `google/gemini-3.8-flash` | `AI_TRANSLATE_MODELS` |
| draftGuide | `anthropic/claude-sonnet-5.5` → `google/gemini-3.8-flash` | `AI_DRAFTGUIDE_MODELS` |

Şemaya uymayan veya hata veren model atlanır; 402 (kredi bitti) zinciri durdurur. Her çağrı `ai-usage` koleksiyonuna maliyetiyle yazılır; aylık bütçe (`aiSettings.monthlyBudgetUsd`) dolunca işler durur.

## Hiçbir şey otomatik yayınlanmaz
AI çıktısı yalnızca **boş** alanları doldurur ve görsel `pending` (Onay bekliyor) kalır. Yayın bir insanın "Onayla"sıyla olur. İnsanın yazdığı metin asla üzerine yazılmaz.

## Türkçe yazım kuralları (`prompts/turkish.ts`)
- Türkçe karakterler zorunlu (ç, ğ, ı, İ, ö, ş, ü).
- Özel isimlere gelen ekler kesme işaretiyle: İstanbul'da, Riva'daki, Kefken Ahşap'ın.
- Çeviri kokan kalıplar yok ("…'e sahip olmak", "…sağlamaktadır" yığınları).
- Yasak klişeler: "eşsiz", "hayallerinizdeki", "kaliteden ödün vermeden", "en iyi hizmet", "mükemmel", "benzersiz".
- Esnaf sıcaklığında, sade, somut. Ahşap türü, yer, ölçü yalnızca görülen/verilen bilgiyle.
- Bilinmeyen alan boş kalır; rakam, yıl, fiyat, müşteri yorumu uydurulmaz.

## Görsel etiketleme (`prompts/tagImage.ts`, `tagImage@1`)
Çıktı: TR/EN başlık (≤80), alt metin (≤125, "fotoğraf" diye başlamaz), açıklama (≤240), ASCII SEO dosya adı, etiketler (ahşap/mekan/finish/aşama), `categoryAgrees`, `confidence`. Filigran yazısı hiçbir metne girmez.
