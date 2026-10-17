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

## Görsel etiketleme (`prompts/tagImage.ts`, `tagImage@4`)
Çıktı: sitenin **her dilinde** (`routing.locales`: tr, en, ru, de, ar) başlık (≤80), alt metin (≤125, "fotoğraf" diye başlamaz) ve açıklama (≤240); ASCII SEO dosya adı, etiketler (ürün türü/ahşap/mekan/finish/aşama), `categoryAgrees`, `confidence`. Filigran yazısı hiçbir metne girmez.
Tüm diller tek model çağrısında gelir (#192). Dil kuralları: TR için `TURKISH_RULES` (CONTENT-STYLE-TR.md); diğer diller aynı bilgiyi verir, doğal yazılır (RU/DE yerli dil, AR Modern Standart Arapça). Prompt'taki çok dilli terim listesi CONTENT-STYLE-TR §8 ile PR #181 dil incelemesinin kararlarını taşır: AR deck = ديكينغ (ديك değil), kamelya = كشك (eril; كاميليا değil); RU deck = настил/дек, deck tahtası = террасная доска, kiriş = лаги; DE deck = Terrasse, deck tahtası = Terrassendielen (Deckdielen değil), alt yapı = Unterkonstruktion.
İş (`src/jobs/tagImage.ts`) tüm dilleri tek okumada (`locale: 'all'`) alır ve yalnızca **boş** alanları yazar; bir insanın herhangi bir dilde yazdığı metin korunur. `aiSuggestion` (işin "bitti" işareti) en son yazılır: yarıda kalan bir iş tekrar denenince boş kalan dilleri doldurur. Seed yükleyicileri de meta dosyasında hangi diller varsa (`routing.locales`) onları yazar (`mediaMetaTexts`). Silinmiş bir görselin işi `Media.NotFound` sonucuyla biter, hata sayılmaz.
Saklanan öneri: `StoredTagImageSchema` `tagImage@2/@3` önerilerini (yalnızca TR/EN metin, `@3` öncesi `type` yok) okumaya devam eder.
Galeri kartı (#192): onay bekleyen kartta `confidence` (yüzde) ve `categoryAgrees` görünür; güven 0,5'in altındaysa ya da kategori uymuyorsa kart "Kontrol edin" diye işaretlenir. "Onayla"nın ekleyeceği etiketler aynı kuralla (`approvalTags`, `aiReview` — `src/lib/media/galeri.ts`) önceden listelenir.
Ürün türü (#171): iş, mevcut `type` etiketlerinin TR adlarını kullanıcı mesajında listeler; model en çok 3 tanesini listedeki yazımıyla seçer, emin değilse boş bırakır. Listede olmayan ad öneriden atılır (`knownTypes`). Öneri `aiSuggestion`'da durur; görselin etiketlerine yükleme anında bağlanmaz.
**Onayla → önerilen etiketler eklenir** (#183, sahip kararı 2026-10-16): görsel `approved` durumuna geçtiği yazımda (Galeri "Onayla", toplu onay, düzenleme formu) öneri etiketlerinden mevcut bir Etiket'e eşleşenler (eksen + TR ad, büyük/küçük harf duyarsız, ya da slug; aşama before/after/process/detail → Öncesi/Sonrası/Uygulama aşaması/Detay, finished → yok) görsele eklenir. Yalnızca ekleme: editörün etiketleri kalır, yeni etiket açılmaz, ahşap/finish/aşama ekseninde zaten etiket varsa o eksen atlanır, yoksa yalnızca eşleşen ilk öneri eklenir. Onaylayan kayıtta önerilen bir etiket çıkarılırsa aynı kayıtta geri eklenir; istenmeyen etiket onaydan sonra çıkarılır (sonraki kayıtlar etiketlere dokunmaz). `promptVersion` `tagImage@2`'den eskiyse ya da öneri yoksa bir şey eklenmez. Kural: `approvalTags` (`src/lib/media/taxonomy.ts`), hook: `attachSuggestedTags` (`src/collections/Media.ts`).

## Fotoğraf metinleri TR değişince (`prompts/translateMedia.ts`, `translateMedia@1`, #203)
Sahip kararı 2026-10-18: bir fotoğrafın TR başlığı, alt metni ya da açıklaması değişince (Galeri "Kaydet" / "Kaydet ve onayla", düzenleme sayfası) diğer diller eski kalmaz.
- **Köken kaydı** (`media.i18nSync`, gizli JSON; mantık `src/lib/media/i18nSync.ts`): TR dışındaki her dil ve alan için metnin hangi TR metinden (`src`) AI ile yazıldığı ve AI'ın ne yazdığı (`ai`) özetlenir (sha1). `tagImage@4` doldurduğu her alan için yazar. Dildeki metin `ai` özetine uymuyorsa o metni bir insan düzenlemiştir.
- **Tetik** (`trackTranslations` / `queueTranslation`, `src/collections/Media.ts`): TR'de değişen alanlar `pending` olur ve `translateMedia` işi kendi kuyruğunda (`translateMedia`) sıraya girer. Kayıt asla beklemez ya da işin yüzünden başarısız olmaz. `skipAi` bağlamıyla gelen yazımlar (işin kendi yazımı, `tagImage`, seed/import betikleri) iş kuyruğa almaz; bu yüzden döngü olmaz. Dışarıdan gönderilen `i18nSync` yok sayılır. Aynı fotoğrafta `translateMedia` ile `tagImage` aynı anda çalışmaz (Payload concurrency, ortak anahtar `media:<id>`); fazladan sıraya giren iş köken kaydından iş bulamaz, model çağırmaz. AI kapalıysa ya da anahtar yoksa diller "çevrilemedi" diye işaretlenir.
- **İş** (`src/jobs/translateMedia.ts` → `syncMediaLocales`, `src/ai/translate/media.ts`): yalnızca değişen alanlar, yalnızca metni hâlâ AI'ın olan (ya da boş) dillerde yeniden yazılır. Elle düzenlenmiş dil korunur ve `stale: edited` işaretlenir. TR alanı boşaltıldıysa AI'ın yazdığı karşılıklar da silinir. Tüm diller ve alanlar tek çağrıda istenir: `translate` görevinin model zinciri (AI Ayarları), çeviri girdi biçimi (segment id = alan adı), `tagImage` ile aynı sınırlar (başlık ≤80, alt ≤125, açıklama ≤240; aşan cevap zincirde sonraki modele geçer), dil yönergeleri ve PR #181 terim listesi (`TERMS`), AI Ayarları terim sözlüğü. Aylık bütçe dolduysa model çağrılmaz; diller `stale: failed` olur.
- **Galeri kartı ve düzenleme sayfası**: "Diller: güncel" / "TR değişti, çeviriliyor…" / "Elle düzenlenmiş dil eski olabilir: DE" / "Çevrilemedi, eski olabilir: EN". **Diğer dillere yeniden çevir** (`POST /api/ai/translate-media`, aynı yetki, hız ve bütçe kapısı) onay sorusundan sonra tüm TR dışı dilleri TR metinden yeniden yazar, elle düzenlenmişleri de.
- **Etiketler değişmez**: etiket adları zaten dil başına yerelleştirilmiş ilişkilerdir; fotoğrafın etiket listesi dile bağlı değildir.
- **Seed fotoğrafları** (~568, #203 öncesi yüklendi): TR dışı metinleri seed AI hattında üretildi ve elle düzenlenmedi; `scripts/seed/media-provenance.ts` (`bun run payload run scripts/seed/media-provenance.ts -- --dry-run | --yes`) kaydı olmayan fotoğraflara mevcut metinleri AI metni olarak kaydeder (`backfillSync`). Metne dokunmaz, boş alanları çeviriye bırakır, `skipAi` ile yazar (iş kuyruğa girmez), kaydı olanı atlar. Bundan sonra TR düzenlemesi bu fotoğrafları da otomatik çevirir.
- **Durum yoklama**: "TR değişti, çeviriliyor…" görünürken kart ve düzenleme sayfası durumu 10 sn'de bir okur (en çok 3 dk, yalnızca sekme görünürken); iş bitince sayfa yenilenmeden "Diller: güncel" olur.

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
- Fotoğraf açıklamaları yalnızca bu kaydın kendi galerisinden/kapağından ve **onaylı** (yayında) görsellerden alınır.
- Aynı güvenlik kapısı: giriş yapmış yönetim kullanıcısı, yalnızca JSON istek, sıkı id kontrolü, kullanıcı başına sınır, aylık bütçe; hata mesajları kod başına sabit Türkçe metin.
