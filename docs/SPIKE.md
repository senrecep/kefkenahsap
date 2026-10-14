# F0 Spike raporu (2026-10-14)

Epic #1 · Issue'lar #10–#16 · Plan: `docs/PLAN.md` §12 F0

## Pinlenen sürümler

| Paket | Sürüm | Not |
|---|---|---|
| payload, @payloadcms/* | 3.90.2 | v4 beta'ya geçilmedi |
| next | 16.4.0 | Payload peer: `>=16.3.3 <17` |
| next-intl | 4.14.9 | |
| ai (Vercel AI SDK) | 7.0.139 | **v7: `generateObject` yok** → `generateText({ output: Output.object({ schema }) })` |
| @openrouter/ai-sdk-provider | 3.1.0 | `usage: { include: true }` ile maliyet yanıtta geliyor |
| tsentials | 1.0.0 | spike: 0.1.12; 1.0 yükseltmesi #134 |
| zod | 4.6.7 | |
| bun | 1.3.14 | kurulum; çalışma zamanı Node 24 (alpine) |
| Postgres | 17-alpine | |
| Lokal S3 | RustFS 1.0.1 | **MinIO artık Docker imajı yayınlamıyor** (Docker Hub: pull access denied) |

## Doğrulama sonuçları

| # | Madde | Sonuç | Kanıt |
|---|---|---|---|
| a / #10 | `orderable` join ile kategori → media sıralaması | **Geçti.** Yeni kayıtlar sona ekleniyor; bir kaydın kesirli sıra anahtarı (`_media_media_order`) öne alınınca join sırası değişiyor (sürükle-bırakın yazdığı alan). | `tests/int/spike.int.spec.ts` "orderable"; sürükle-bırak davranışı #26 (Galeri) e2e'sinde test edilecek |
| b / #11 | S3 adapter + doğrudan CDN URL + sharp boyutları | **Geçti.** `url` = `MEDIA_PUBLIC_URL/...`, `/api/media/file` yok; orijinal ve tüm boyutlar WebP; `withoutEnlargement` ile orijinalden büyük boyut yok; dosya HTTP 200. | `tests/int/spike.int.spec.ts` "S3" |
| c / #12 | Lexical + canlı önizleme + taslaklar (localization ile) | **Geçti.** Kategori düzenleme ekranında Lexical editör ve "Live Preview" butonu; önizleme iframe'i açılıyor. Payload config değişikliğinden sonra `generate:importmap` zorunlu (yoksa rich text alanı hiç çizilmiyor) → CI'da kontrol edilecek (#19). | `tests/e2e/admin-live-preview.e2e.spec.ts`, `docs/spike/admin-live-preview.png` |
| f / #12 | Lokalize slug'da dil başına benzersizlik | **Geçti, plan sadeleşti.** `unique: true` lokalize alanda `(slug, _locale)` üzerinden çalışıyor: aynı dokümanın TR ve EN'de aynı slug'ı kabul, aynı dilde kopya red, farklı dokümanların farklı dillerde aynı slug'ı kabul. **`beforeValidate` hook'una gerek yok.** | `tests/int/spike.int.spec.ts` "slug" |
| h / #13 | `proxy.ts` ile tek adımlı eski URL yönlendirmesi | **Geçti.** `skipTrailingSlashRedirect: true` + proxy içinde legacy lookup next-intl'den önce. Proxy matcher'ına noktalı yollar için `/wp-content/uploads/:path*` ayrıca eklenmeli. `/deck-ve-zeminler/` → 301 `/tr/deck-ve-zeminler`; `-400x400` varyantı → 301 CDN; encoded Türkçe ad → 410; `/tr/` → 308 `/tr`. Hepsi tek adım. | `tests/e2e/legacy-redirect.e2e.spec.ts`, `src/lib/legacy/normalize.test.ts` |
| d / #14 | bun + standalone Docker build | **Geçti.** Image 345 MB (node:24-alpine runner). Migration'lar açılışta `prodMigrations` ile koşuyor (CLI gerekmiyor). `/api/health` (DB'ye sorgu atar, erişilemezse 503) 200; `/tr` ilk istek 65 ms. Healthcheck `${PORT}`'u kullanıyor. | `docker build` + çalıştırma: `/api/health 200`, `/tr 200`, `/admin 200`, eski URL 301 |
| g / #14 | `jobs.autoRun` standalone'da | **Geçti.** Spike sırasında cron'lu bir `heartbeat` görevi standalone container'da çalıştı (`INFO: jobs heartbeat`); review sonrası görev kaldırıldı, `autoRun` gerçek görevler için duruyor. | container log |
| d' / #14 | Dokploy development deploy | **Ertelendi → #18/#19/#20.** Gerçek deploy compose + domain + basic auth ile F1a'da yapılacak; image tarafında engel yok. | — |
| i / #15 | AI SDK + OpenRouter yapılandırılmış vision çıktısı | **Geçti.** `google/gemini-3.8-flash`, Zod şeması (TR/EN başlık + alt, SEO dosya adı, 4 eksen etiket): 3/3 geçerli JSON, görsel başına ~7,5 sn ve ~0,004 $ (568 görsel ≈ 2,3 $). Filigran metni çıktıya girmedi. | `scripts/spike/ai-tag.ts` |
| e / #15 | Arapça admin RTL | **Geçti.** `payload-lng=ar` ile admin Arapça, `<html dir="RTL">`, gezinme `direction: rtl`. | `tests/e2e/admin-rtl.e2e.spec.ts`, `docs/spike/admin-ar-rtl.png` |

## Plana yansıyan değişiklikler

1. **Lokal S3: MinIO → RustFS.** Prod Cloudflare R2 olarak kalıyor (bucket `kefkenahsap`, CDN `cdn.kefkenahsap.com`).
2. **AI SDK v7 API'si:** `generateObject` yerine `generateText` + `Output.object`. JSON repair, `experimental_repairText` yerine şema doğrulama hatasında zincirdeki sonraki modele geçişle yapılacak.
3. **Varsayılan modeller** (OpenRouter, 2026-10-14):
   - Vision: `google/gemini-3.8-flash` → yedek `anthropic/claude-haiku-5.5`
   - Metin ve çeviri: `anthropic/claude-sonnet-5.5` → yedek `google/gemini-3.8-flash`
4. **Slug benzersizliği** için hook yok; `unique: true` yeterli.
5. **Şema değişiklikleri yalnızca migration ile** (`push: false`). Dev push etkileşimli soru sorup CI'ı kilitliyor. Production'da migration'lar `prodMigrations` ile açılışta koşuyor. Integration testleri vitest `globalSetup`'ta `payload migrate` çalıştırıyor.
6. **E2E testleri seri koşuyor** (`workers: 1`): admin testleri aynı seed kullanıcıyı ve DB'yi paylaşıyor. Ayrı test DB'si #19'da.
7. **Lokal Docker notu:** Geliştirme makinesinde çalışan kernel güncellendi, reboot edilmediği için `veth` yüklenemiyor. Compose host ağıyla çalışıyor; `docker build --network host` kullanılıyor.
