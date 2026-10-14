# AI prompt kuralları

Kod: `src/ai/` (zincir: `models.ts`, çalıştırıcı: `run.ts`, prompt'lar: `prompts/*.ts`, her prompt bir sürüm sabiti taşır).

## Modeller (OpenRouter)
| Görev | Varsayılan zincir | Override |
|---|---|---|
| tagImage (vision) | `google/gemini-3.8-flash` → `anthropic/claude-haiku-5.5` | `AI_TAGIMAGE_MODELS` env > Admin › AI Ayarları |
| translate | `anthropic/claude-sonnet-5.5` → `google/gemini-3.8-flash` | `AI_TRANSLATE_MODELS` |
| draftGuide | `anthropic/claude-sonnet-5.5` → `google/gemini-3.8-flash` | `AI_DRAFTGUIDE_MODELS` |
| draftProjectStory | `anthropic/claude-sonnet-5.5` → `google/gemini-3.8-flash` | `AI_DRAFTPROJECTSTORY_MODELS` |

Admin › AI Ayarları: her görevin zinciri sıralı model listesidir; öneriler OpenRouter `/models` listesinden gelir (1 saat önbellek), liste alınamazsa model kimliği elle yazılır. Aynı ekrandaki maliyet paneli bu ayın `ai-usage` kayıtlarını görev başına toplar ve aylık limitin ne kadarının kullanıldığını gösterir.

**Yerel geliştirme, testler ve CI** `AI_FAKE_PROVIDER=1` ile çalışır: her görev `src/ai/fake.ts`'teki deterministik sahte modelden cevap alır, OpenRouter'a (model listesi dahil) hiç istek gitmez. Canlı ortamda bu değişken tanımlanmaz.

Şemaya uymayan veya hata veren model atlanır; 402 (kredi bitti) zinciri durdurur. Her çağrı `ai-usage` koleksiyonuna maliyetiyle yazılır; aylık bütçe (`aiSettings.monthlyBudgetUsd`) dolunca işler durur.

## Hiçbir şey otomatik yayınlanmaz
AI çıktısı yalnızca **boş** alanları doldurur ve görsel `pending` (Onay bekliyor) kalır. Yayın bir insanın "Onayla"sıyla olur. İnsanın yazdığı metin asla üzerine yazılmaz.

## Türkçe yazım kuralları (`prompts/turkish.ts`)
Kuralların tek kaynağı **[CONTENT-STYLE-TR.md](CONTENT-STYLE-TR.md)**: ton, ekler ve kesme işareti, çeviri kokan yapılar, yasak ifadeler, doğruluk kuralları ve TR↔EN terim sözlüğü.
`TURKISH_RULES` bu belgenin prompt'a sığan özetidir ve her prompt'a eklenir. Belgede bir kural değişince:
1. `TURKISH_RULES` güncellenir.
2. Onu kullanan her prompt'un sürüm sabiti artırılır (ör. `tagImage@2`), böylece `aiSuggestion.promptVersion` hangi kuralla üretildiğini gösterir.
3. Yasak listesi değiştiyse seed içerik testindeki `BANNED` dizisi de güncellenir (`src/lib/content/content.test.ts`).

Çeviri görevi (`translate`) terim sözlüğünü `aiSettings.glossary`'den alır; boşsa CONTENT-STYLE-TR §8 tablosu esas alınır.

## Görsel etiketleme (`prompts/tagImage.ts`, `tagImage@2`)
Çıktı: TR/EN başlık (≤80), alt metin (≤125, "fotoğraf" diye başlamaz), açıklama (≤240), ASCII SEO dosya adı, etiketler (ahşap/mekan/finish/aşama), `categoryAgrees`, `confidence`. Filigran yazısı hiçbir metne girmez.
