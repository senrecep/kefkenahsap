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

**Yerel geliştirme, testler ve CI** `AI_FAKE_PROVIDER=1` ile çalışır: her görev `src/ai/fake.ts`'teki deterministik sahte modelden cevap alır, OpenRouter'a (model listesi dahil) hiç istek gitmez. Canlı ortamda bu değişken tanımlanmaz; yanlışlıkla tanımlansa bile `SITE_ENV` olan (deploy edilmiş) imajda sahte model hiç çalışmaz ve açılışta uyarı yazılır. Playwright kurulumu, sunucu sahte modda değilse (`/api/health` → `ai: "fake"`) testi başlatmaz.

**Maliyet:** her deneme (şemaya uymayan cevaplar ve hata veren çağrılar dahil) bütçeye yazılır. Sağlayıcı maliyet bildirmezse token sayısından tahmin edilir (girdi 3 $/M, çıktı 15 $/M; token yoksa ~4 karakter = 1 token). Başarısız çağrının maliyeti de `ai-usage` satırına (`ok: false`) yazılır.

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

## Çeviri (`prompts/translate.ts`, `translate@1`)
Admin'de kategori, proje, sayfa ve yazı düzenleme ekranının yan panelindeki **AI ile çevir** düğmesi (`POST /api/ai/translate`):
- Başlığı (kategoride adı) boş olan diller hedeftir; kaynak, başlığı dolu ilk dildir. Tüm hedef diller tek çağrıda istenir.
- Modele yalnızca düz metin alanları ve Lexical metin düğümleri gider (`src/ai/translate/segments.ts`); zengin metin JSON'u düğüm düğüm aynı kurulur, yalnızca `text` değerleri değişir. Hedef dilde dolu olan alan gönderilmez ve üzerine yazılmaz. Müşteri yorumu çevrilmez.
- Terim sözlüğü sistem prompt'una eklenir; adres (slug) çevrilen başlıktan slug kancasıyla üretilir.
- Sonuç her dil için **taslak sürüm** olarak kaydedilir; yayındaki sürüm değişmez, yayın bir insanın "Yayınla"sıyla olur.
- **Dikkat:** Payload'da yayın durumu dil başına değil, kayıt başınadır. Bir sonraki **Yayınla** bu dilleri de yayınlar; önce kontrol edin. Düğme bunu başarı mesajında da söyler. (Payload 3.90'daki deneysel `localizeStatus` dil başına yayını sağlar ama şema göçü ve herkese açık okuma kurallarında (`_status`) değişiklik ister; deneysel olduğu için şimdilik açılmadı.)
- Uç nokta yalnızca giriş yapmış yönetim kullanıcısına ve `application/json` isteğe açıktır, kullanıcı başına 10 dakikada 10 istekle sınırlıdır ve aylık bütçe kontrolünden geçer (`src/ai/guard.ts`). Bir basışta en çok ~20.000 karakter kaynak metin gönderilir (`Translate.TooLong`); tahmini maliyet kalan bütçeyi aşarsa model çağrılmaz (`AI.BudgetInsufficient`). Hata mesajları her kod için sabit Türkçe metindir; ayrıntılar yalnızca sunucu günlüğüne yazılır.

## Taslak (`prompts/draft.ts`, `draft@1`)
Yazı ve proje düzenleme ekranlarındaki **AI ile taslak** (`POST /api/ai/draft`): başlık + editörün madde notları + isteğe bağlı seçilen fotoğrafların açıklamaları → boş yazı gövdesi ve kısa cevap (yazılar, `draftGuide`) ya da boş proje hikayesi (`draftProjectStory`).
- Model yalnızca notları, fotoğraf açıklamalarını ve Site Bilgileri'nin **dolu** alanlarını olgu olarak kullanabilir; başka yıl, sayı, fiyat, garanti, iddia yazamaz.
- Sonuç **her zaman taslak sürümdür**: güncellemeyi yalnızca `draftUpdateArgs` kurar (`draft: true`, `_status` silinir); uç nokta istekten yalnızca `collection, id, notes, mediaIds` okur. Dolu gövde/hikaye üzerine yazılmaz.
- Aynı güvenlik kapısı: giriş yapmış yönetim kullanıcısı, kullanıcı başına sınır, aylık bütçe.
