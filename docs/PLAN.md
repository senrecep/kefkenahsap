# kefkenahsap.com — Yeniden Yapım Planı

> Durum: **Onaylandı (2026-10-14)** · Tarih: 2026-10-14 · Karar kaydı: `legacy/decisions.md` · Ürün kaydı: `../PRODUCT.md`
> Kaynak veriler (repo içinde): `legacy/wp-media.json` (1169 WP medya + boyut URL'leri), `legacy/wp-pages.json` (16 sayfa), `legacy/live-site-images-ordered.json` (11 kategorinin canlı sitedeki **görsel sırası**), `legacy/crawl-md/` (eski sayfa metinleri).
> Bu doküman implementasyon başlamadan önce tüm kararları tek yerde toplar. "AÇIK" işaretli maddeler implementasyon sırasında netleşecek ama mimariyi değiştirmez.

---

## 1. Amaç ve başarı ölçütü

2018 WordPress sitesinin yerine, az pazarlama bütçesiyle **Google (yerel/Maps dahil) ve AI arama motorlarında (ChatGPT, Claude, Perplexity, AI Overviews)** görünür olan, hızlı, çok dilli, gerçek iş fotoğraflarıyla konuşan bir portfolyo + talep toplama sitesi. Ziyaretçinin ana aksiyonu **WhatsApp**; ikincil aksiyon teklif formu.

Başarı (lansmandan 3 ay sonra ölçülür):
- GSC: eski 16 URL'nin tamamı yeni karşılığına indekslenmiş, 404 = 0, kapsam hatası yok.
- CWV yeşil (CrUX), Lighthouse mobil ≥95 (tüm şablonlar).
- Umami: WhatsApp + telefon + form dönüşümleri ölçülüyor; aylık trend raporu.
- GBP ↔ site NAP birebir tutarlı; LocalBusiness schema doğrulanmış.
- Editör (60 yaş) telefondan yardım almadan: fotoğraf ekleme, sıralama, kısa metin düzeltme.

## 2. Kapsam dışı (bilinçli olarak)

- Go backend / ayrı API servisi (Payload kendi REST/GraphQL/Local API'sini veriyor).
- WhatsApp Business API, chatbot.
- Otomatik (onaysız) AI içerik yayını, şablon "doorway" bölge sayfaları.
- Prometheus/Grafana/Loki (tek site için ağır).
- E-ticaret, online ödeme, fiyat hesaplayıcı.

---

## 3. Mimari

### 3.1 Stack
| Katman | Seçim | Not |
|---|---|---|
| Uygulama | **Next.js 16 (App Router, React 19) + Payload CMS 3.x** tek uygulama | Spike'ta test edilen 3.x sürümü pinlenir (v4 beta'ya geçilmez). bun. Tek replika (job runner için). |
| UI | Tailwind 4, shadcn/ui (yalnızca admin özel view ve form primitive'leri), lucide | |
| i18n | next-intl 4 (UI metinleri, localized pathnames) + Payload localization (içerik) | `tr` varsayılan; `en`; F3: `ar` (RTL), `ru`, `de` |
| DB | Postgres 17 (`@payloadcms/db-postgres`, Drizzle tabanlı) + `pg_trgm` | |
| Medya | `@payloadcms/storage-s3` → prod **Cloudflare R2** (`cdn.kefkenahsap.com`), lokal **RustFS** (MinIO imajları artık yayınlanmıyor; SPIKE.md) | sharp ile upload anında boyutlar |
| Arka plan işleri | **Payload Jobs Queue** (Postgres tabanlı, Redis yok) | AI etiketleme, çeviri, kümeleme |
| AI | Vercel AI SDK + `@openrouter/ai-sdk-provider`, AI SDK v7 `generateText` + `Output.object` + Zod | geolyt pattern'i |
| E-posta | Resend (SPF/DKIM) | |
| Animasyon | Motion (UI), GSAP ScrollTrigger (scroll), OGL (hero shader, 3D numune) | hepsi lazy |
| Galeri | Kendi masonry (sunucuda bilinen en-boy oranıyla, CLS=0) + PhotoSwipe 5 lightbox | |
| Hata | GlitchTip (`@sentry/nextjs` SDK) | |
| Analitik | Umami (çerezsiz) + GA4 (Consent Mode v2) + GSC | |
| CDN/Güvenlik | Cloudflare (DNS, proxy, Cache Rules, Turnstile, WAF — AI botları açık) | |

### 3.2 Servisler (tek `docker-compose.yml`, her yerde çalışır)
```
compose
├─ app         Next 16 + Payload (standalone, non-root, healthcheck /api/health)
├─ postgres    postgres:17-alpine  (DB'ler: kefken, umami, glitchtip)
├─ umami       ghcr.io/umami-software/umami (postgres)
├─ glitchtip   glitchtip web + worker (+ valkey)   [profile: observability]
└─ s3 (RustFS) [profile: local]  — prod'da R2 kullanılır
```
- `docker-compose.dokploy.yml`: `dokploy-network` external, Traefik yönlendirmesi Dokploy UI'dan (kullanıcının diğer projeleriyle aynı pattern).
- Yedek: compose `kefken-backup` servisi (profile `backup`) her gece `pg_dump` → özel R2 bucket `kefkenahsap-backups`'a kopyalanır (30 gün lifecycle); müşteri fotoğraflarının volume arşivi de aynı şekilde. Yerel dosya yalnızca R2 yüklemesi başarısız olursa kalır (son 14 döküm / son 3 arşiv; disk paylaşımlı). Dokploy'un Postgres backup'ı compose içindeki Postgres'e uymadığı için kullanılmadı. Medya R2'de (bucket versioning açık). Geri yükleme prosedürü `docs/RUNBOOK.md`.
- Sunucudaki hiçbir paylaşımlı servise bağımlılık yok.

### 3.3 Render stratejisi
- Herkese açık sayfalar: **SSG + ISR**, Payload `afterChange`/`afterDelete` hook'ları → `revalidateTag(tag, 'max')` (Next 16 imzası) + Cloudflare `purge_everything` (site küçük) — **debounce**: purge bir Jobs Queue görevi, en fazla 5 dk'da bir çalışır (editör art arda 20 foto onaylayınca 20 purge olmaz). `cdn.kefkenahsap.com` immutable dosya adları kullandığından purge'den etkilenmez (ayrı cache kuralı). İstisna (#185): silinen veya dosyası değiştirilen görselin eski URL'leri (ana dosya + tüm boyutlar) storage plugin nesneleri sildikten **sonra** (Media `afterOperation`) Cloudflare'den **URL bazında** purge edilir (`purge_cache {files}`, çağrı başına ≤30 URL; kaydetmeyi/silmeyi asla bloklamaz). Env: `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_PURGE_TOKEN` (yalnızca Zone → Cache Purge yetkili token; boşsa atlanır, docs/RUNBOOK.md).
- Galeri infinite scroll: ilk sayfa SSR (24 görsel), sonrası route handler `GET /[locale]/galeri/feed?cat=&tag=&cursor=` (`/api` dışında; Cloudflare'de 5 dk cache).
- Görsel servis: Payload'ın ürettiği boyutlar (yalnızca WebP: 320/640/960/1280/1920; kaynaklar zaten WebP, AVIF depolama/encode maliyetini ikiye katlar) → `next/image` **custom loader** var olan en büyük uygun boyutu seçer (WP orijinallerinin 660/1169'u <1000px; Payload orijinalden büyük boyut üretmez, `sizes` buna göre sınırlanır); Next runtime görsel optimizasyonu kapalı (sunucu yükü yok). LQIP: upload'da 16px blur dataURL + dominant renk. Filigran (karar #8, #169): admin yüklemesinde boyutlar üretilmeden önce (`beforeOperation`) "kefkenahsap.com" basılır, böylece orijinal ve tüm boyutlar aynı filigranı taşır; temiz orijinal saklanmaz (yazılıyordu ama hiçbir yerde okunmuyordu, #204). `media.watermark` = `applied` / `already` (seed ve mevcut görseller) / `none` ("Filigran ekleme" kutusu); yeniden kaydetmek tekrar basmaz. **SEO dosya adı (#209)**: admin yüklemesi önce yükleme adıyla saklanır. Görsel `approved` olduğunda (düzenleme formu, Galeri onay/toplu onay, endpoint'ler, doğrudan `approved` oluşturma, onay + yeni dosya) Media `afterChange` hook'u, kayıtla aynı işlemde bir `seoRename` işi kuyruğa alır (kayıt kaydedilemezse iş de yoktur); iş cron ile ≤1 dk içinde çalışır, o arada görsel yükleme adıyla yayında kalır. İş kaydı yeniden okur, uygun değilse bir şey yapmaz (idempotent), adı seçer (`seoFilename`; boşsa TR başlık slug'ı ≤60; o da boşsa `kefken-ahsap-<id>`; DB'deki dosya adlarına **ve** kovadaki her hedef anahtara bakılır, doluysa `-2`, `-3`; `seoFilename` boşsa doldurulur), ana dosya + tüm boyutları `<seoAdi>.<uzanti>` / `<seoAdi>-<W>x<H>.<uzanti>` olarak S3'te kopyalar (paralel; biri başarısızsa yapılan kopyalar silinir, kayıt değişmez), kaydı yeni adlara çevirir (yükleme hattı çalışmaz: yeniden kodlama ve ikinci filigran yok), **ancak ondan sonra** eski nesneleri siler ve eski URL'leri purge eder (silme/purge hatası yalnızca loglanır). Aynı eşzamanlılık anahtarı (`media:<id>`) tagImage/translateMedia ile paylaşılır (anahtar kuyruk bazlı değildir); iş kendi kuyruğunda (`media-files`) çalışır ki toplu onay varsayılan kuyruğun çalıştırma başına 10 iş sınırını doldurup çevirileri geciktirmesin; varsayılan kuyruğun sınırı da 50'ye çıkarıldı (autoRun). "Bir kez yeniden adlandırıldı" `media.seoRenamed` (gizli) ile tutulur; dosya değiştirilince sıfırlanır ve eski ad `seoRetiredStems`'e yazılır: CDN medyayı 1 yıl tuttuğu için yayında olmuş bir ad bir daha kullanılmaz, yeni dosya `-2`, `-3` alır. İş, hedef URL'leri de purge eder (iş çalışmadan önce önbelleğe giren 404 için) ve kaydı `filename = <kopyalanan>` koşuluyla günceller: iş sırasında dosya değiştiyse kopyalar silinir, yeni veri ezilmez. Seed kayıtları (`seedKey`), `seoRenamed` olanlar ve adı zaten `seoFilename` (ya da ≤3 haneli `-<n>`) olanlar işe alınmaz. Mevcut yüklemeler için `scripts/seed/seo-filenames.ts` aynı işleri kuyruğa alır (docs/RUNBOOK.md).
- Medya URL'leri doğrudan R2/CDN'den: `storage-s3` için `disablePayloadAccessControl: true` + `generateFileURL` → `https://cdn.kefkenahsap.com/...` (aksi halde dosyalar `/api/media/file/...` üzerinden app'e yüklenir ve robots'ta engelli kalır). Talep fotoğrafları **ayrı upload koleksiyonu (`lead-photos`) + sunucudaki private volume** (CDN bucket'ına hiç gitmez; dosyalar yalnızca oturum açmış yetkiliye Payload üzerinden servis edilir).
- Job runner: Payload `jobs.autoRun` (cron) + `schedule` (2 yıllık talep silme, bütçe kontrolü); tek app replikası.
- Admin: `/admin` (Payload), Cloudflare cache bypass.

### 3.4 Repo yapısı
```
kefkenahsap/
├─ src/app/(frontend)/[locale]/...   public sayfalar
├─ src/app/(payload)/admin/...       Payload admin
├─ src/collections/  src/globals/  src/blocks/  src/jobs/  src/ai/
├─ src/components/   src/lib/ (seo, jsonld, whatsapp, i18n)
├─ scripts/          seed-import.ts, build-redirect-map.ts, ai-backfill.ts
├─ messages/{tr,en}.json
├─ docs/  PLAN.md, RUNBOOK.md, CONTENT-STYLE-TR.md, AI-PROMPTS.md
├─ docker-compose.yml, docker-compose.dokploy.yml, Dockerfile
└─ PRODUCT.md, DESIGN.md (tasarım bittiğinde)
```

---

## 4. İçerik modeli (Payload)

Tüm metin alanları `localized: true`. Taslak/versiyon (`versions.drafts`) + Live Preview: categories, projects, guides, regions, pages, homepage.

### Koleksiyonlar
| Koleksiyon | Önemli alanlar |
|---|---|
| **users** | name, role (`admin` / `editor`), adminLanguage (tr) |
| **media** (upload) | alt*, title*, caption* (her dil; tagImage@4 hepsini doldurur, #192), seoFilename, category (rel), tags (rel many), project (rel), status (`pending` / `approved` / `hidden`), aiSuggestion (json: alt/title/tags/confidence/model), capturedAt (EXIF), width/height, lqip, dominantColor, focalPoint, watermark (`applied` / `already` / `none`, #169), **legacyUrls[]** (eski WP URL + boyut varyantları), legacyAttachmentUrl, featured (bool) |
| **categories** | name*, slug* (TR/EN ayrı), shortDesc*, body* (Lexical, 300–600 kelime), faq[] {q*, a*}, priceGuide {min, max, unit, currency, note*, updatedAt}, cover, `media` = **join** (category → media, `orderable: true` → sürükle-bırak sıralama), seo {title*, description*, ogImage}, order (orderable) |
| **tags** | name*, slug*, axis (`type` ürün türü, #171 / `wood` / `setting` / `finish` / `stage`), description* (≥N görselde indekslenir; galeri çipi ≥5 onaylı fotoğrafta görünür) |
| **projects** | title*, slug*, categories, tags, gallery (sıralı media), cover, story* (Lexical), city, district, mapPin (opsiyonel, yaklaşık), year, woodSpecies, area {value, unit}, duration, finish*, testimonial {quote*, author, role, consentGiven}, reference (rel), featured |
| **guides** (rehber/blog) | title*, slug*, excerpt* (cevap-önce), body* (Lexical), faq[], author (rel users → Person schema), publishedAt, updatedAt, relatedCategories, relatedProjects |
| **regions** | name*, slug*, districts[], body* (elle yazılır), projects (rel), **publishGate** (en az 3 proje + 250 kelime yoksa noindex) |
| **references** | name, location, projects (rel), logo (opsiyonel, izinliyse) |
| **pages** | Hakkımızda, KVKK, Çerez Politikası, Süreç; blocks |
| **leads** (Talepler) | name*, phone*, email, service, city/district, message, photos (≤5, private disk volume), consentKvkk*, locale, sourcePage, utm, status (`new` / `contacted` / `closed`), retentionUntil (+2 yıl, job ile silinir) |
| **redirects** | `@payloadcms/plugin-redirects` (from, to, type 301) |
| **aiUsage** | task, model, tokensIn/Out, costUsd (OpenRouter generation endpoint'inden), docRef, createdAt |

### Global'ler
- **siteSettings**: şirket adı, kuruluş yılı (boşsa hiçbir "X yıl" ifadesi render edilmez), kurucu/usta, ekip, proje sayısı, NAP (adres, geo, telefonlar, e-posta), çalışma saatleri, WhatsApp numarası + **mesaj şablonları** (sayfa türüne göre), sosyal profiller (Instagram, Facebook, GBP URL), hizmet bölgeleri (areaServed).
- **homepage**: blok listesi (aç/kapa + sıralama) — Hero (görsel + en fazla 6 sonraki slayt, sürükleyerek sıralanır; #187, sahibin 2026-10-17 isteği), Öne çıkan galeri, Hizmetler, Öne çıkan projeler, Süreç, Referanslar, Ahşap türleri, SSS, İletişim. Boş başlık/adım alanları sitede `messages` varsayılanına düşer (güvenlik ağı); `scripts/seed/homepage-defaults.ts` bunları admin alanlarına bir kez yazar (#213).
- **navigation**: header/footer linkleri.
- **aiSettings**: görev bazlı model zinciri (bkz. §8), aylık bütçe limiti, terim sözlüğü (TR↔EN↔…).

### Admin deneyimi (60 yaş testi)
- Editör rolü: sol menüde yalnızca **Galeri, Projeler, Talepler, Yazılar, Site Bilgileri**; geri kalanı gizli.
- **Özel "Galeri" view'u** (`/admin/galeri`, mobil öncelikli):
  1. Üstte büyük kategori/proje seçici.
  2. "Fotoğraf ekle" → kamera/galeri, çoklu seçim; tarayıcıda 2560px'e küçültme + EXIF GPS temizleme; ilerleme çubuğu.
  3. Yüklenen her görsel "AI düşünüyor…" → "Onay bekliyor" rozetiyle düşer; karta dokununca önerilen başlık/alt metin, **tek tuş "Onayla"**, "Düzenle", "Gizle".
  4. Büyük küçük resimlerle sürükle-bırak sıralama (dokunmatikte uzun-bas-sürükle; ayrıca ↑↓ butonları erişilebilirlik için).
- PWA manifest (admin), ana ekrana eklenebilir.
- Dokunma hedefleri ≥48px, admin yazı boyutu büyütülmüş, TR arayüz.
- Talepler: yeni talep e-postası + admin listesinde "Ara / WhatsApp'la yaz" butonları.

---

## 5. URL yapısı, i18n ve yönlendirmeler

### 5.1 Rotalar (TR / EN / RU / DE; AR = EN yolları)
| Sayfa | TR | EN | RU | DE |
|---|---|---|---|---|
| Ana sayfa | `/tr` | `/en` | `/ru` | `/de` |
| Kategori (11) | `/tr/deck-ve-zeminler` (eski slug korunur) | `/en/decking-and-flooring` | `/ru/<slug>` | `/de/<slug>` |
| Hizmetler dizini | `/tr/hizmetlerimiz` | `/en/services` | `/ru/uslugi` | `/de/leistungen` |
| Proje | `/tr/projeler/<slug>` | `/en/projects/<slug>` | `/ru/proekty/<slug>` | `/de/projekte/<slug>` |
| Görsel sayfası | `/tr/galeri/<slug>` | `/en/gallery/<slug>` | `/ru/galereya/<slug>` | `/de/galerie/<slug>` |
| Etiket | `/tr/etiket/<slug>` | `/en/tag/<slug>` | — | — |
| Rehber | `/tr/rehber/<slug>` | `/en/guides/<slug>` | `/ru/stati/<slug>` | `/de/ratgeber/<slug>` |
| Bölge | `/tr/bolgeler/<slug>` | `/en/areas/<slug>` | `/ru/regiony/<slug>` | `/de/regionen/<slug>` |
| Referanslar / Hakkımızda / İletişim | `/tr/referanslar`, `/tr/hakkimizda`, `/tr/iletisim` | `/en/references`, `/en/about`, `/en/contact` | `/ru/klienty`, `/ru/o-nas`, `/ru/kontakty` | `/de/referenzen`, `/de/ueber-uns`, `/de/kontakt` |
| Arama | `/tr/ara?q=` (noindex) | `/en/search?q=` | `/ru/poisk?q=` | `/de/suche?q=` |
| Yasal | `/tr/kvkk`, `/tr/cerez-politikasi` | `/en/privacy`, `/en/cookies` | `/ru/konfidentsialnost`, `/ru/cookies` | `/de/datenschutz`, `/de/cookies` |

- Kanonik host **www.kefkenahsap.com**; `kefkenahsap.com` → www (Cloudflare tek kural, host+path birlikte, 301).
- `/` → çerez (`NEXT_LOCALE`) + `Accept-Language` ile, **yalnızca içeriği olan dillerden** biri (sabit rotalarla aynı kural, `getContentLocales`; içeriği olmayan tercih edilen dil atlanır, hiçbiri yoksa `/tr`; #64 kararı, `rootLocale`) (**302**, `/` Cloudflare cache bypass; `x-default` = `/tr`).
- **Dil "yayında" sinyali**: bir dokümanın o dildeki `slug` ve `title` alanları doluysa o dil yayında sayılır (Payload draft'ları tüm dilleri birlikte yayınlar; per-locale status deneysel). Bu tek kural hreflang, sitemap ve noindex'i yönetir.
- Dil seçici: yalnızca içeriği olan dilleri (+ o anki dili) gösterir (#64 inceleme kararı: noindex kabuk sayfalara taranabilir link yok); aynı dokümanın diğer dildeki slug'ını çözer, yoksa o dilin ana sayfasına gider.
- Lokalize slug benzersizliği dil başına: lokalize alanda `unique: true` yeterli (`(slug, _locale)` index'i; F0 spike #12 doğruladı, hook yok).
- Her sayfada `hreflang` (tr, en, x-default) — yalnızca **çevirisi yayınlanmış** diller listelenir; çevirisi olmayan dil sayfası **yalnızca noindex** (çapraz-dil canonical yok, hreflang'de yer almaz).
- RU/DE sabit rota adları (#64): DE Almanca ASCII, RU Latin harfle transliterasyon (Kiril URL'de yüzde-kodlanır). Doküman slug'ları RU başlıktan otomatik Latin harfe çevrilir (`src/lib/slug.ts`).
- **Sabit rotalar için dil yayında kuralı** (#64): ana sayfa, hizmetler, galeri, projeler, referanslar, iletişim, rehber dizini ve yasal sayfalar bir dilde ancak o dilde en az bir kategori yayındaysa (slug + ad dolu) yayında sayılır; aksi hâlde noindex, hreflang ve sitemap dışı (`fixedRoutePaths`). Varsayılan dil (`tr`) her zaman yayındadır. Yani yeni bir dili açmak veriyle olur: kategorilerin o dildeki ad + slug'ı girilir.
- F3'te `ar` için `dir="rtl"`, Tailwind logical properties (ms-/me-) baştan kullanılır.
- **AR (#63):** sabit rotalar EN yollarını kullanır (`/ar/gallery`, `/ar/contact`…): Arapça harfli URL yüzde-kodlanır, adres çubuğunda yön karışır. Doküman slug'ları Latin harfle: boş bırakılırsa `slugify` Arapça başlığı sessiz harflerle Latin'e çevirir (#156; AI çevirisi yalnızca başlığı doldurur, slug'sız dil yayında sayılmaz), editör daha okunur bir slug'ı elle girebilir. `<html dir="rtl">` `localeDir`'den; admin'de Arapça alanlar RTL (Payload `localization.locales[].rtl`). Yazı tipi: Noto Sans Arabic (OFL, alt küme, yalnızca Arapça metin olan sayfada iner). Telefon ve saat aralıkları RTL metin içinde `<bdi dir="ltr">`. Galeri görüntüleyicide ok tuşları ve kaydırma aynalanır. `og:locale` `ar_AR`.

### 5.2 Eski URL göçü (veri: `legacy/wp-media.json`, `legacy/wp-pages.json`, `legacy/live-site-images-ordered.json`)
| Eski | Yeni | Tür |
|---|---|---|
| 16 sayfa (`/deck-ve-zeminler/` …) | `/tr/<aynı-slug>` | 301 |
| `/` | `/tr` | 301 |
| `/ireko-teak/` | `/tr/ireko-teak` (EN: `/en/iroko-and-teak`) | 301 |
| **14.468 medya URL'si** (1169 orijinal × WP boyut varyantları; `.jpg/.jpeg/.png/.gif` + birkaç `.mp3/.txt`; 85'i ham Türkçe karakterli) | eşleşen görsel → CDN'de en yakın boyut | 301 |
| attachment sayfaları (`/<sayfa>/<attachment-slug>/`) | `/tr/galeri/<yeni-slug>` | 301 |
| Webiste setinde eşleşmeyen ~600 medya (sahipsiz 285 dahil) | **410 Gone** (kullanıcı kararı) | 410 |
| `/feed/`, `/category/*`, `/?s=`, `/wp-json/*`, `/wp-admin` | `/tr/rehber/rss.xml`, `/tr`, `/tr/ara`, 410 | |

- **Önce mevcut pipeline'ı kullan**: `kefken-ahsap-image-pipeline` 39→40→41→43 aşamaları canlı site dosya adlarını yerel dosyalara zaten eşledi (`08_site_guncel`, `99_reports/` — Drive yedeğinde). Bu eşleme varsa aşağıdaki eşleştirme büyük ölçüde gereksiz; yoksa:
- Eşleme: dosya adı tabanı (WP `-WxH`, `-N`, `.jpg1_` sonekleri normalize, URI decode + NFC) → ~550 doğrudan eşleşme. 176 WP adı normalize sonrası çakışıyor, Webiste'de 79 yinelenen ad var → çakışmalar WP `post` (sayfa) ↔ Webiste kategori klasörü ile ayrıştırılır; hâlâ belirsizse sha256/phash (Webiste dosyası vs WP `full`, eşleme script'i WP canlıyken çalıştırılır).
- Uygulama: **tek bir `/wp-content/uploads/[...path]` handler'ı** (proxy.ts'te, next-intl'den önce) — URI decode + NFC + boyut sonekini at → ~1169 kayıtlık JSON haritasında ara → 301 / 410. 14k satır `redirects` koleksiyonuna seed edilmez; o koleksiyon yalnızca sayfa/attachment ve admin'den eklenen elle yönlendirmeler için.
- Tek hop: `skipTrailingSlashRedirect: true`; legacy lookup trailing-slash ve next-intl'den **önce** çalışır; www kanonik olduğu için eski URL'ler host değiştirmez.
- CI testi: 16 sayfa + attachment sayfaları + **14.468 medya URL'sinin tamamı** tek hop'ta 200 veya 410.

---

## 6. Sayfalar ve bileşenler (F1)

**Tasarım yönü: Kategori standardı, tam ustalıkla** (impeccable kararı; ayrıntı §11).

- **Header**: logo, Hizmetler (mega menü: 16 kategori, #172 ile 11'den 16'ya çıktı; uygulamada iki sütunlu metin listesi, kapak resmi yok), Projeler, Galeri, Rehber, Referanslar, İletişim, dil seçici, sağda telefon. Mobilde alt sabit çubuk: **WhatsApp · Ara · Teklif**.
- **Ana sayfa** (blok sırası admin'den): Hero (tam genişlik gerçek fotoğraf; admin slayt eklerse yavaş geçişli fotoğraf gösterisi, durdur/başlat düğmesiyle — #187; H1 değer önerisi, WhatsApp + Teklif butonları, OGL ahşap damarı efekti opsiyonel) → **Öne çıkan galeri** (filtre çipleri: kategori/ahşap/mekan, infinite masonry — "galeri odaklı") → Hizmetler gridi → Öne çıkan projeler → Süreç (keşif → teklif → imalat → montaj → bakım) → Referanslar → Ahşap türleri karşılaştırma (tablo) → SSS → İletişim/harita.
- **Kategori sayfası**: H1 + cevap-önce giriş paragrafı → masonry galeri (infinite) → açıklama (300–600 kelime, H2'ler soru) → fiyat rehberi (aralık + güncelleme tarihi) → SSS → ilgili projeler + rehberler → hizmet bölgeleri → CTA.
- **Proje sayfası**: kapak + künye (yer, yıl, ahşap, m², süre, finish) → hikaye → sıralı galeri → müşteri yorumu → benzer projeler.
- **Görsel sayfası**: büyük görsel, başlık/alt/açıklama, etiket çipleri, bağlı proje/kategori, ilgili görseller; lightbox açılınca URL `history.replaceState` ile bu sayfaya döner.
- **Galeri**: tüm görseller, kategori + etiket filtreleri (URL query, SSR), infinite scroll, skeleton.
- **İletişim**: form (ad*, telefon* + opsiyonel alanlar, ≤5 foto, KVKK onayı*), harita (tıklayınca yüklenen Google gömme haritası — tıklamadan Google'a istek yok, KVKK + performans; Google/Apple Haritalar linkleri; sahibinin isteği #143), NAP, çalışma saatleri.
- **WhatsApp**: `wa.me/905322958416?text=` + bağlama göre şablon ("Merhaba, *Deck ve Zeminler* hakkında bilgi almak istiyorum. — kefkenahsap.com/tr/deck-ve-zeminler"); masaüstünde QR popover; mesai dışında bilgi notu; Umami event `whatsapp_click {page, category}`.
- **Durumlar**: skeleton (galeri, arama), boş durum (etiket/arama sonucu yok), hata (form gönderilemedi → WhatsApp alternatifi), 404 (arama + popüler kategoriler).
- **Çerez banner'ı**: Consent Mode v2; reddedince GA4 yüklenmez; Umami her zaman.

F2: Rehber dizini + yazı şablonu (TOC, FAQ, "AI'ya kopyala" butonu, yazar kutusu), bölge sayfaları, ahşap türleri rehberinde **OGL 3D numune** (iroko/teak/çam/thermowood dokulu döndürülebilir tahta; WebGL yoksa statik görsel).

---

## 7. SEO + GEO (geolyt rubric + easyapp-website envanterinden)

**Teknik**
1. Tüm içerik SSR/SSG; istemci-only içerik yok.
2. Her sayfada benzersiz title, meta description (cevabın kendisi), self-canonical, `<html lang>`, viewport.
3. `generateMetadata` → `alternates.languages` (yayında olan diller) + `x-default`.
4. Hiçbir public sayfada `nosnippet`, `max-snippet:0`, kazara `noindex` yok (CI kontrolü).
5. HTTPS, güvenlik başlıkları, ETag/Last-Modified, gerçek 404 (soft-404 yok), tek hop redirect.
6. Tek kaynak `app/robots.ts`: Googlebot, Bingbot, OAI-SearchBot, ChatGPT-User, GPTBot, Claude-SearchBot, Claude-User, ClaudeBot, PerplexityBot, Perplexity-User, Applebot, DuckAssistBot, Google-Extended, CCBot — **hepsine izin** (karar #31). **Tek `User-agent: *` grubu** (bot bazlı gruplar `*` kurallarını ezer ve `/admin` disallow'u kaybettirir): `/admin`, `/api`, `/*/ara` disallow; bot adları yalnızca dokümantasyonda listelenir.
7. Cloudflare "Block AI bots" / "AI Labyrinth" kapalı; WAF botları engellemiyor (lansman checklist'i).
8. `app/sitemap.ts` (+ image sitemap): Payload `updatedAt` ile `lastmod`, dil alternatifleri; sadece indekslenebilir sayfalar.
9. `llms.txt` + `llms-full.txt` (Key Facts bloğu: NAP, hizmetler, bölgeler, kuruluş yılı — siteSettings'ten üretilir).

**Structured data** (`safeJsonLd` helper, görünür metinle birebir)
- Site geneli: `HomeAndConstructionBusiness` (LocalBusiness) — name, url, logo, image, PostalAddress, geo, telephone, email, openingHours, areaServed (İstanbul ilçeleri + Türkiye), sameAs (GBP, Instagram, Facebook), foundingDate (doluysa) + `WebSite` (SearchAction 2024'te emekli; eklenmez).
- Kategori: `Service` (provider, areaServed, offers.priceSpecification aralık varsa) + `FAQPage` + `BreadcrumbList` + `ImageGallery`.
- Proje: `CreativeWork` (contentLocation, dateCreated, material) + `ImageObject[]` + `Review` (yalnızca gerçek yorum).
- Görsel sayfası: `ImageObject` (contentUrl, caption, creator/copyrightHolder, copyrightNotice).
- Not: FAQPage rich result artık yalnızca resmi/sağlık sitelerinde gösteriliyor; GEO (AI alıntılanabilirlik) için yine eklenir, rich result beklenmez.
- Rehber: `Article` + `Person` author + `datePublished`/`dateModified` + FAQPage.
- Referanslar: `ItemList`.

**İçerik kuralları** (`docs/CONTENT-STYLE-TR.md`)
- İlk paragraf ≤150 kelimede cevap; H2'ler soru cümlesi; bağımsız okunabilir paragraflar.
- Somut veri: ahşap türü, ölçü, m², süre, yer, yıl, fiyat aralığı (tarihli).
- Karşılaştırmalar tablo ile (Iroko vs Teak vs Çam vs Thermowood).
- Marka adı title / H1 / ilk paragrafta tutarlı.
- Görünür "Güncellendi: tarih" (`<time datetime>`); `updatedAt` 12 ayı geçen içerik admin listesinde uyarı rozetiyle gösterilir.
- Doldurma yok: ilçe listesi yığmak, gizli metin, keyword stuffing yasak.
- Etiket sayfaları ≥8 görsel + açıklama yoksa noindex.

**Yerel SEO**
- GBP: kategori, hizmetler, fotoğraflar, site linki `/tr?utm_source=gbp` — NAP birebir. (AÇIK: GBP düzenlemesi kullanıcı tarafından, checklist verilecek.)
- Proje sayfalarında ilçe = gerçek konum sinyali.
- Instagram/Facebook bio linkleri güncellenir.

**Ölçüm**
- GSC (domain property, sitemap gönderimi, eski URL kapsam takibi 8 hafta).
- GA4: **tek property, tüm diller**; her `page_view`'da `page_locale` parametresi (custom dimension olarak kayıtlı), dil bazlı rapor/segment bununla. Umami'de de `locale` event verisi.
- GA4 (Consent Mode v2) + Umami events: `whatsapp_click`, `phone_click`, `form_submit`, `gallery_open`, `filter_use`, `lang_switch`.
- Lansman sonrası geolyt ile site skoru ölçülür (baz + 4 hafta sonra).

---

## 8. AI akışları

**Altyapı** (geolyt'ten): Vercel AI SDK + `@openrouter/ai-sdk-provider`, görev bazlı model zinciri (`aiSettings` global > env > varsayılan), OpenRouter `models` fallback dizisi, AI SDK v7 `generateText` + `Output.object` + Zod, JSON repair pass (easyapp-bot'tan), düşük temperature, bugünün tarihi prompt'a enjekte, `aiUsage` kaydı (OpenRouter usage accounting yanıtındaki maliyet), aylık bütçe aşılınca işler durur ve admin'e uyarı.

| Görev | Varsayılan zincir (admin'den değişir) | Tetik |
|---|---|---|
| `tagImage` (vision) | `google/gemini-3.8-flash` → `anthropic/claude-haiku-5.5` | upload sonrası job; toplu backfill script |
| `translate` | `anthropic/claude-sonnet-5.5` → `google/gemini-3.8-flash` | admin'de "AI ile çevir" butonu (eksik diller); fotoğrafın TR metni değişince `translateMedia` işi (#203) |
| `draftGuide` | `anthropic/claude-sonnet-5.5` | admin'de "AI ile taslak" (asla otomatik yayın) |
| `clusterProjects` | CLIP embedding (pipeline'daki) + EXIF tarih + LLM isimlendirme | tek seferlik seed |

- `tagImage` çıktısı (Zod): `{ title{tr,en}, alt{tr,en} (≤125 karakter), caption{tr,en}, seoFilename (tr, ascii, ≤60), tags{type[] (#171, mevcut ürün türü etiketlerinden), wood[], setting[], finish[], stage[]}, categoryCheck{agrees, suggested}, confidence }` — kategori bağlamı + WP sayfa bağlamı prompt'a verilir; görsel üzerindeki filigran metni alt metne yazılmaz.
- Çeviri: tek prompt'ta tüm hedef diller (aciktirio pattern'i) + **terim sözlüğü** (ör. deck → deck, kamelya → gazebo, emprenye → pressure-treated, korkuluk → railing) + Lexical JSON yapısı korunarak sadece metin düğümleri çevrilir.
- **Türkçe yazım kuralları** (kendi rehberimiz, `docs/CONTENT-STYLE-TR.md`; prompt özeti `src/ai/prompts/turkish.ts`): Türkçe karakterler zorunlu; özel isim + ek kesme işareti (İstanbul'da, Riva'daki); çeviri kokan yapılar yasak ("…'e sahip olmak", "…sağlamaktadır" yığını); yasaklı klişeler listesi ("eşsiz", "hayallerinizdeki", "kaliteden ödün vermeden", "en iyi hizmet"); esnaf sıcaklığında ama abartısız ton; uydurma rakam/iddia yasak — bilinmeyen alan boş bırakılır.
- **Onayla → önerilen etiketler eklenir** (#183, sahip kararı 2026-10-16): görsel onaylandığı yazımda `tagImage` önerisinin (≥`tagImage@2`) mevcut etiketlerle eşleşen etiketleri görsele eklenir; yalnızca ekleme, yeni etiket açılmaz, tek değerli eksenler (ahşap/finish/aşama) doluysa atlanır, boşsa yalnızca eşleşen ilk öneri eklenir. Ayrıntı: `docs/AI-PROMPTS.md`.
- **Fotoğraf metni TR değişince diğer diller** (#203, sahip kararı 2026-10-18): TR başlık/alt/açıklama değişince `translateMedia` işi yalnızca değişen alanları, yalnızca metni hâlâ AI'ın olan dillerde yeniden çevirir; elle düzenlenmiş dil korunur ve "eski olabilir" diye işaretlenir. Köken kaydı `media.i18nSync`'te; Galeri kartı ve düzenleme sayfasında durum satırı + "Diğer dillere yeniden çevir" (onaylı, hepsinin üzerine yazar). Etiketler değişmez (zaten yerelleştirilmiş ilişki). Ayrıntı: `docs/AI-PROMPTS.md`.
- Prompt'lar TS modülleri olarak `src/ai/prompts/` altında, sürüm sabiti ile; `aiSuggestion` içinde model + prompt sürümü saklanır.

---

## 9. Performans ve erişilebilirlik bütçesi

- Lighthouse mobil ≥95 (Ana sayfa, kategori, proje, görsel, rehber); LCP <2.0s, INP <200ms, CLS <0.05.
- İlk yükleme JS ≤150KB gz (tarayıcı Sentry/GlitchTip SDK'sı tracing/replay olmadan ve lazy yüklenir; Turnstile yalnızca form görünür olunca); Motion/GSAP/OGL/PhotoSwipe dinamik import, etkileşimde veya görünürlükte.
- Hero görseli: `fetchpriority=high`, WebP, preload; OGL efekti `requestIdleCallback` sonrası, `prefers-reduced-motion` / `saveData` / düşük `deviceMemory` / WebGL yoksa hiç yüklenmez.
- Fontlar: self-host (Montserrat + gerekirse bir başlık fontu), `font-display: swap`, subset (Latin Ext + TR).
- WCAG 2.2 AA: kontrast, odak görünürlüğü, klavye ile lightbox/galeri, form etiketleri, `alt` zorunlu (yayın için onaylı alt metin şart), dokunma hedefi ≥44px (admin 48px).
- CI: Lighthouse CI (bütçe aşımında fail) + axe (Playwright).

---

## 10. Altyapı, CI/CD, güvenlik

- **GitHub** repo; Actions: `lint` (Biome veya ESLint — AÇIK: kullanıcının diğer projeleriyle hizalanacak), `typecheck`, `vitest`, `playwright` (smoke + redirect haritası + i18n/hreflang + sitemap + JSON-LD + form + admin upload/sıralama), Lighthouse CI → Docker image → **GHCR** → Dokploy deploy webhook. `main` → prod, `development` → **`development.kefkenahsap.com`** (noindex + basic auth; staging'in yerine).
- **Cloudflare**: zone zaten Cloudflare'de (Free plan, SSL Full); lansmanda yalnızca apex/www A kayıtları güzelhosting'den (104.247.167.3) sunucuya çevrilir, cPanel kayıtları WP yedeği için kalır. **MX kaydı yok** → @kefkenahsap.com e-postası şu an çalışmıyor (info@ ayrı iş; sunucudaki Mailu ile açılabilir). proxy açık, SSL Full (strict), HTTP/3, Early Hints, Brotli; Cache Rules: `/_next/static/*` ve medya 1 yıl immutable, HTML edge 5 dk + Payload purge, `/admin` `/api` bypass; Turnstile (form); R2 custom domain `cdn.kefkenahsap.com`.
- **Güvenlik**: Payload auth (admin/editor, güçlü şifre, login rate limit, opsiyonel 2FA — AÇIK), form: Turnstile + honeypot + rate limit + dosya türü/boyut doğrulama (≤10MB, image/*), lead fotoğrafları private disk volume (yalnızca oturumlu Payload dosya rotası), CSP + güvenlik başlıkları, secrets yalnızca Dokploy env.
- **KVKK**: talep verisi yurt dışı servislerden geçer (Cloudflare, Resend, Gmail; foto/metin AI'ya **gönderilmez**) → aydınlatma metni ve rıza metninde yurt dışına aktarım açıkça belirtilir. Aydınlatma metni + çerez politikası (şablon; avukat kontrolü önerilir), form açık rıza kutusu, talepler 2 yıl sonra otomatik silinir (job), log'larda kişisel veri yok.

---

## 11. Tasarım brifi (impeccable — shape çıktısı)

- **Ziyaretçi ve iş**: Öncelik villa/müstakil ev sahibi, telefondan gelir; benzer işi görmek ve WhatsApp'tan yazmak ister. İkincil: site yönetimleri, mimarlar, otel/marina. Mod: Persuade (ana sayfa, kategori), Experience (galeri), Read (rehber), Operate (admin).
- **Seçilen yön**: **Kategori standardı, tam ustalıkla** — beyaz zemin, logo yeşili (#009444 / #39b54a) aksiyon rengi, tam genişlik gerçek fotoğraf, net hizmet gridi, alışıldık navigasyon. Fark yenilikten değil **uygulama kalitesinden** gelir: fotoğraf seçimi ve kırpımı, tipografik hiyerarşi, boşluk ritmi, hızlı ve akıcı galeri, kusursuz mobil.
- **İlk ekran**: tam genişlik hero (öne çıkan gerçek proje fotoğrafı, admin'den seçilir), H1 değer önerisi (doğrulanmamış "30 yıl" yok; kuruluş yılı girilince "19XX'ten beri" otomatik), alt satır hizmet özeti, **WhatsApp (birincil, yeşil)** + **Teklif al** (ikincil); altında hizmet kartları gridi. Mobilde alt sabit aksiyon çubuğu.
- **Sınırlar / anti-hedefler**: stok fotoğraf yok; lüks/korkutucu ton yok; yeşil boğmasın (aksiyon + küçük vurgular); Elementor/WordPress şablon hissi yok (ince detay: gerçek tipografi ölçeği, tutarlı spacing, tutarlı köşe dili, ikon tile'ları yerine fotoğraf).
- **Kalite çıtası (referanslar, URL'ler doğrulandı)**:
  1. **Millboard** (millboard.com/en-gb/gallery, /case-studies) — ince üst bar (dil, telefon) + mega menü; galeri üstünde **paylaşılabilir URL'li filtreler** (`?kategori=&ahsap=`), karışık oranlı grid, lightbox'ta "1/7" sayaç + önceki/sonraki + küçük resim şeridi + her görselde kısa açıklama; proje kartı = küçük resim + başlık + tek satır + etiket çipleri. *Kaçın*: galeri ve projelerde iki ayrı filtre sözlüğü → bizde tek etiket sistemi.
  2. **Archadeck** (archadeck.com/what-we-build/pergolas/) — yüklenici versiyonu; hero'da iki CTA + 4'lü hizmet gridi; **kategori sayfası akışı**: hero → kısa giriş → yerel CTA → malzeme/fayda → süre ("1–2 gün") → çapraz hizmet → CTA → 4 SSS → yorumlar → ilgili 8 proje → form. Her 2–3 bölümde CTA tekrar, ama itici değil. *Kaçın*: filtresiz, açıklamasız galeri.
  3. **Oakwrights** (oakwrights.co.uk/case-studies) — **proje sayfası yapısı**: H1 + giriş → "Proje Künyesi" kutusu (yer, yıl, tür, m²) → başlıklı ve fotoğraflı kısa bölümler → müşteri sözü → "Benzer projeler"; facet filtreler. *Kaçın*: premium/heritage tonu ve uzun editoryal metin → bizde künye + 8–15 foto + 2 kısa paragraf + CTA.
  - Türk rakipler (irokodeck.net, gardenstar.com.tr, ahsapdeck.com.tr): kırık hero'lar, placeholder görseller, filtresiz galeri, keyword yığını, görünür WhatsApp/telefon yok, EN yok. **Çıta düşük**; gerçek foto + filtre + proje sayfası + EN + sabit WhatsApp ile kolayca geçilir.
- **Sonraki adım (implementasyonda)**: impeccable new-work (code-led) → direction contract surface brief'e → build → finish review → DESIGN.md + design.json.

---

## 12. Fazlar ve teslim kriterleri

### F0 — Spike (1–2 gün)
- ✅ Tamamlandı → `docs/SPIKE.md`. Payload 3 + Next 16 + Postgres + S3 iskeleti; doğrula: (a) `orderable` join ile kategori→media sürükle-bırak, (b) S3 adapter + `disablePayloadAccessControl` + `generateFileURL` + sharp boyutları + custom loader, (c) Lexical live preview, (d) bun ile standalone Docker build Dokploy'da, (e) Arapça admin RTL (F3 için not), (f) lokalize slug'da dil başına benzersizlik, (g) `jobs.autoRun` standalone'da çalışıyor mu, (h) Next 16 `proxy.ts` + `skipTrailingSlashRedirect` + next-intl sırası ile tek hop legacy redirect, (i) AI SDK güncel sürümde `generateObject` (veya halefi) + OpenRouter provider.
- **Çıkış**: 5 doğrulamanın sonucu `docs/SPIKE.md`; olumsuz çıkan varsa plan güncellenir.

### F1 — Lansman
1. Altyapı: repo, compose (app/postgres/umami/glitchtip/s3-local), Dockerfile, CI, staging.
2. Koleksiyonlar + global'ler + roller + admin özel Galeri view + PWA.
3. Seed (**lokalde, Claude ile hazırlanır**; kullanıcı kararı): 568 görsel için başlık/alt/caption/SEO dosya adı/etiketler lokalde üretilir, kategori bazında pipeline'daki `27_contact_sheet.py` / `09_serve_review.py` (yerel inceleme sunucusu, işaretleri JSON'a yazar) uyarlanarak gözden geçirilir, düzeltilir → `seed/media.json` **approved** durumda içeri alınır. 11 kategori, sıra = `legacy/live-site-images-ordered.json` (canlı sayfadaki sıra; Webiste'deki 69 "Yeni" foto kategorinin sonuna), legacyUrls, medya redirect JSON haritası, CLIP kümeleme → "olası proje" önerileri (admin'de onay). Runtime `tagImage` yalnızca yeni yüklemeler için.
   - Önkoşul (DNS geçişinden önce): WP `full` orijinallerinin hash eşlemesi ve `wp-media.json` doğrulaması; WP güzelhosting'de yedek olarak kalır.
4. Frontend: header/footer, ana sayfa blokları, kategori, galeri, görsel sayfası, proje, referanslar, hakkımızda, iletişim + form, yasal sayfalar, 404, arama.
5. i18n TR+EN (UI mesajları + AI çeviri ilk geçiş + insan kontrolü).
6. SEO/GEO çekirdeği (§7 tamamı), llms.txt, sitemap'ler, robots; **3–4 temel rehber** (lokalde Claude ile taslak + insan onayı, seed olarak).
7. Analitik (Umami, GA4 consent), GlitchTip, Resend, Turnstile.
8. Lansman: Cloudflare DNS geçişi, GSC sitemap + adres, GBP link/NAP, 404 izleme 2 hafta.
- **Kabul**: §1 ölçütlerinin teknik olanları (Lighthouse, redirect testi %100, axe 0 kritik, form uçtan uca, editör kullanılabilirlik testi — asıl editörle 15 dk gözlem).

### F2 — İçerik ve AI araçları
- Kalan rehberler (AI taslak → insan onayı; lansmanda 3–4 temel rehber F1'de yayınlanır: Iroko mu Teak mi?, Deck bakımı, Ahşap türleri karşılaştırma, Pergola fiyatını ne belirler?). Liste: Iroko mu Teak mi?, Deck bakımı ne zaman?, Pergola fiyatını ne belirler?, Emprenyeli ahşap nedir?, Thermowood avantajları, Ahşap korkuluk mu metal mi?, Havuz kenarı deck rehberi, Ahşap türleri karşılaştırma tablosu (eski "ağaç cinsleri" içeriğinden).
- Admin "AI ile çevir" / "AI ile taslak" butonları, aiSettings model seçici (OpenRouter `/models` listesi), maliyet paneli.
- Bölge sayfaları (admin'den, publishGate'li), OGL 3D numune.
- Kategori metinleri + SSS'lerin tamamlanması; proje kayıtlarının zenginleştirilmesi.

### F3 — Genişleme
- AR (RTL), RU, DE; Kaliteli arşivinden seçme ekleme; geolyt skoruyla iyileştirme turu.

---

## 12.1 Mevcut altyapı (2026-10-14 kuruldu)
| Kaynak | Değer |
|---|---|
| GitHub | `senrecep/kefkenahsap` (private), default `main`; `development` dalı; eski Gemini planı `archive/gemini-plan` (ve dokunulmamış `master`) |
| Dokploy | proje `kefkenahsap` (`mvsnFfucr2AZAO1cyJISY`); ortamlar `production` (mevcut, wood-material-calculator içerir) + `development` (`QdLx3aVSsHEUs0FXGlSXK`, boş) |
| Sunucu | 45.196.28.107 (`ssh senrecep`, anahtar parola korumalı) |
| Cloudflare | zone `04160cf76d6ba4ad5d37d83145eaae57`; `development.kefkenahsap.com` A → 45.196.28.107 (proxied) |
| Sunucuda zaten olan | Uptime Kuma (tools), Umami/OpenObserve (monitoring), Seq (logging), Mailu (mail) — compose bunlara bağımlı değil; Uptime Kuma'ya site monitörü eklenir |

## 13. Açık noktalar (implementasyonu bloklamaz)
1. Referans sitelerin mobil görünümü implementasyon başında telefonda gözle kontrol edilecek (araştırma ekran görüntüsüz yapıldı).
2. Kuruluş yılı, kurucu/usta adı, ekip, proje sayısı — admin'den girilecek.
3. Fiyat aralıkları (kategori bazında) — kullanıcıdan.
4. GBP düzenlemesi ve GSC erişimi — kullanıcı tarafında; checklist verilecek.
5. Linter seçimi (Biome/ESLint) ve 2FA — kullanıcının diğer projelerine göre.
6. info@kefkenahsap.com aktifleşince NAP güncellemesi (tek global alan).
7. Müşteri yorumları ve referans logo izinleri.
8. Fotoğraf ağırlığı (#116): gerçek fotoğraflarla Lighthouse mobil performansı ana sayfa/kategori/galeride ~80. Ara türev genişlik (`w480`) eklenip mevcut türevler yeniden üretilsin mi? Media yükleme ayarını değiştirir; karar bekliyor.
9. ~~Seed fotoğraflarının dil metinlerinde köken kaydı yok (#203).~~ Karar (2026-10-18): seed metinleri seed AI hattında üretildi ve elle düzenlenmedi, AI metni sayılır. `scripts/seed/media-provenance.ts` kaydı olmayan her seed fotoğrafına (`seedKey`; admin yüklemelerine dokunmaz) mevcut metinlerden köken kaydı yazar (metne dokunmaz, boş alanları çeviriye bırakır, iş kuyruğa almaz, tekrar çalışınca bir şey yazmaz); dev'e merge sonrası çalıştırılır.

## 13.1 Lansman sonrası kullanıcı işleri (not alındı, en sonda yapılacak)
- [ ] GSC: Domain mülkü doğrulaması (TXT → Cloudflare'e eklenir), GA4 ↔ GSC bağlantısı, Performans (16 ay, sorgu+sayfa) ve Sayfalar raporu CSV dışa aktarımı → `docs/legacy/gsc/`.
- [ ] GBP: ana kategori (Millwork shop → asıl işi anlatan kategori) + ek kategoriler, 16 hizmet (site kategorileriyle aynı adlar; #172), fotoğraflar, gönderiler, yorum isteme linkinin eski müşterilere gönderimi, website linki → `https://www.kefkenahsap.com/tr?utm_source=gbp&utm_medium=organic`.
- [ ] Instagram kullanıcı adının marka ile tutarlı hale getirilmesi → siteSettings'te URL güncelle.
- [ ] Murat Şen'in mesleğe başlama yılının teyidi → siteSettings (o zamana kadar yalnızca "2009'dan beri").
- [ ] info@kefkenahsap.com (MX/Mailu) — ayrı iş.

## 14. Riskler
| Risk | Etki | Önlem |
|---|---|---|
| Eski görseller düşük çözünürlük/filigranlı | Hero ve büyük görünümlerde kalite | Hero için en iyi 10 görsel elle seçilir; düşük çözünürlüklüler büyük boyutta gösterilmez (size cap) |
| Redirect eşleşmeyen medya | Google Görseller trafiği kaybı | Eşleşen ~550 görsel 301; kalan ~600 bilinçli 410 (kullanıcı kararı); GSC 8 hafta takip |
| AI etiketleri yanlış | Yanlış alt metin/etiket | "Onay bekliyor" akışı; yayın için onay şart |
| Payload major (v4) | Yükseltme maliyeti | 3.x'te kal, v4 stabil + 3 ay sonra değerlendir |
| GlitchTip kaynak tüketimi | Küçük sunucuda RAM | `observability` profili; gerekirse harici/kapatılabilir |
| DNS geçişinde mail kesintisi | E-posta kaybı | MX/SPF kayıtları önceden kopyalanır, TTL düşürülür |
