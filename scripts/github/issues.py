# Issue data for senrecep/kefkenahsap. Keys referenced as {{key}} get replaced by #number after creation.
P = "docs/PLAN.md"

EPICS = [
 dict(key="E0", ms="F0 Spike", title="[Epic] F0 — Teknik spike: riskli varsayımları doğrula", labels=["epic","phase:F0"],
  goal="G001-f0-spike",
  body=f"""Plan: `{P}` §12 F0. Next 16 + Payload 3 iskeletini kurup planın dayandığı ama henüz doğrulanmamış teknik varsayımları kanıtla. Olumsuz çıkan her madde için kod yazmadan önce plan güncellenir.

**Kabul kriterleri**
- [ ] `docs/SPIKE.md`: her doğrulama maddesi için geçti/kaldı + kanıt (test çıktısı, ekran görüntüsü, link)
- [ ] Doğrulanan paket sürümleri `package.json`'da pinli
- [ ] Kalan maddeler için `docs/PLAN.md` güncellendi
- [ ] Tüm testler yeşil"""),
 dict(key="E1", ms="F1 Lansman", title="[Epic] F1a — Temel altyapı: repo araçları, compose, CI/CD, development ortamı", labels=["epic","phase:F1"],
  goal="G002-f1a-foundations",
  body=f"""Plan: `{P}` §3.2, §10, §12 F1/1, §12.1. Kod tabanının iskeleti, Docker Compose, CI/CD ve `development.kefkenahsap.com`.

**Kabul kriterleri**
- [ ] `main` üzerinde CI yeşil (lint, typecheck, vitest, playwright, lighthouse)
- [ ] `development` dalına push → GHCR image → Dokploy deploy otomatik
- [ ] development.kefkenahsap.com basic auth + `X-Robots-Tag: noindex` ile erişilebilir"""),
 dict(key="E2", ms="F1 Lansman", title="[Epic] F1b — İçerik modeli ve admin paneli", labels=["epic","phase:F1"],
  goal="G003-f1b-content-model-admin",
  body=f"""Plan: `{P}` §4. Payload koleksiyonları, global'ler, roller, özel Galeri ekranı, talepler ve yeni yüklemeler için AI etiketleme.

**Kabul kriterleri**
- [ ] §4'teki tüm koleksiyon ve global'ler, TDD seam testleri yeşil
- [ ] Editör telefondan fotoğraf ekleyip sıralayıp onaylayabiliyor (asıl editörle 15 dk kullanılabilirlik testi, notlar issue'ya)
- [ ] Talep fotoğrafları private bucket'ta, saklama süresi işi çalışıyor"""),
 dict(key="E3", ms="F1 Lansman", title="[Epic] F1c — Görsel seed'i ve eski URL göçü", labels=["epic","phase:F1"],
  goal="G004-f1c-seed-legacy-redirects",
  body=f"""Plan: `{P}` §5.2, §12 F1/3. 568 görselin metadata'sı lokalde Claude ile hazırlanır ve onaylı seed olarak girer. Eski WP'nin 16 sayfası, attachment sayfaları ve 14.468 medya URL'si tek adımda yönlendirilir.

**Kabul kriterleri**
- [ ] `docs/legacy/wp-media.json`'daki her URL için E2E: tek adımda 200 ya da 410
- [ ] Seed idempotent (iki kez çalışınca kopya oluşmuyor)
- [ ] Her kategoride görsel sırası, canlı sitedeki sırayla aynı"""),
 dict(key="E4", ms="F1 Lansman", title="[Epic] F1d — Public site ve tasarım (kategori standardı, tam ustalıkla)", labels=["epic","phase:F1"],
  goal="G005-f1d-public-site-design",
  body=f"""Plan: `{P}` §6, §9, §11. Referanslar: Millboard (galeri ve filtre), Archadeck (kategori sayfası akışı), Oakwrights (proje sayfası).

**Kabul kriterleri**
- [ ] impeccable finish review: `ship`; `DESIGN.md` ve `.impeccable/design.json` yazıldı
- [ ] axe: 0 kritik ihlal; Lighthouse mobil ≥95 (ana sayfa, kategori, proje, görsel, rehber)
- [ ] TR ve EN tam; hiçbir yerde doğrulanmamış iddia yok"""),
 dict(key="E5", ms="F1 Lansman", title="[Epic] F1e — SEO/GEO, ölçüm ve lansman", labels=["epic","phase:F1"],
  goal="G006-f1e-seo-geo-analytics-launch",
  body=f"""Plan: `{P}` §7, §10, §12 F1/6-8. SEO/GEO çekirdeği, 3–4 temel rehber, gözlemlenebilirlik ve production'a geçiş.

**Kabul kriterleri**
- [ ] §7 kontrol listesinin tamamı (CI kontrolleriyle)
- [ ] Lansmandan sonraki 2 hafta: eski URL'lerden 404 = 0 (GSC + GlitchTip)
- [ ] CWV yeşil; WhatsApp, telefon ve form dönüşümleri Umami ve GA4'te görünüyor"""),
 dict(key="E6", ms="F2 İçerik & AI", title="[Epic] F2 — İçerik ve AI araçları", labels=["epic","phase:F2"],
  goal="G007-f2-content-ai-tools",
  body=f"""Plan: `{P}` §8, §12 F2.

**Kabul kriterleri**
- [ ] Otomatik yayına giden hiçbir yol yok (test ile kanıtlı)
- [ ] Aylık AI bütçesi aşılınca işler duruyor (test)
- [ ] geolyt skoru lansman ölçümüne göre karşılaştırıldı"""),
 dict(key="E7", ms="F3 Genişleme", title="[Epic] F3 — Genişleme: AR (RTL), RU, DE ve arşiv", labels=["epic","phase:F3"],
  goal="G008-f3-expansion",
  body=f"""Plan: `{P}` §12 F3.

**Kabul kriterleri**
- [ ] RTL düzeni ekran görüntüleriyle doğrulandı
- [ ] 5 dilde hreflang doğru
- [ ] Lighthouse bütçeleri hâlâ karşılanıyor"""),
]

def T(*items): return "\n".join(f"- [ ] {i}" for i in items)

ISSUES = [
# ---------------- F0 ----------------
 dict(key="s-scaffold", epic="E0", labels=["phase:F0","type:spike","area:infra"],
  title="Spike: Next 16 + Payload 3 + Postgres + MinIO iskeleti (bun) ve tsentials kurulumu",
  body=f"""Plan: §3.1, §3.4, §12 F0. CLAUDE.md'deki repo yapısıyla iskelet.

**Görevler**
{T("`create-payload-app` (Next 16 + Postgres adapter) ile iskelet, bun",
   "`docker compose --profile local`: postgres:17 + minio",
   "next-intl 4 kurulumu: `tr`, `en` ve localized pathnames",
   "`npx skills add senrecep/tsentials` ile tsentials ve skill'leri",
   "Vitest + Playwright iskeleti; ilk seam testi kırmızı → yeşil (ör. `src/lib/slug.ts`)",
   "`bun dev` ile `/admin` ve `/tr` açılıyor")}

**Kabul**: Temiz bir clone'da `bun install && docker compose --profile local up -d && bun dev` çalışıyor."""),
 dict(key="s-orderable", epic="E0", labels=["phase:F0","type:spike","area:admin"],
  title="Spike: kategori → media `orderable` join ile sürükle-bırak sıralama", deps=["s-scaffold"],
  body="""Plan: §4 (categories.media join `orderable: true`). Doğrula: 140 görsellik bir kategoride sıralama performansı, sıranın frontend sorgusunda kullanılabilirliği, mobilde sürükle-bırak davranışı.

**Kabul**: Kayıt + ekran görüntüsü SPIKE.md'de. Olumsuzsa alternatif (array of uploads veya `sortOrder` alanı) belirlenir."""),
 dict(key="s-storage", epic="E0", labels=["phase:F0","type:spike","area:infra"],
  title="Spike: S3 adapter ile doğrudan CDN URL'leri + sharp WebP boyutları + next/image özel loader'ı", deps=["s-scaffold"],
  body="""Plan: §3.3. `disablePayloadAccessControl: true` + `generateFileURL` → `media.kefkenahsap.com` (lokalde MinIO URL'si). WebP 320/640/960/1280/1920; Payload orijinalden büyük boyut üretmez. Loader, mevcut en büyük uygun boyutu seçer. LQIP + dominant renk.

**Kabul**: HTML'de `/api/media/file` geçmiyor (test). 800px'lik bir kaynakta srcset doğru. Upload süresi ölçüldü."""),
 dict(key="s-i18n", epic="E0", labels=["phase:F0","type:spike","area:i18n"],
  title="Spike: lokalize slug'da dil başına benzersizlik + Lexical canlı önizleme + taslaklar", deps=["s-scaffold"],
  body="""Plan: §4, §5.1. Postgres unique index lokalize slug'da TR=EN çakışması yaratıyor mu? `beforeValidate` ile dil başına benzersizlik. "Dil yayında" kuralı: slug + title dolu. Draft + live preview, localization ile birlikte.

**Kabul**: Aynı slug iki dilde kaydedilebiliyor; aynı dilde reddediliyor (test). Live preview çalışıyor (ekran görüntüsü)."""),
 dict(key="s-redirect", epic="E0", labels=["phase:F0","type:spike","area:seo"],
  title="Spike: `proxy.ts` ile tek adımlı eski URL yönlendirmesi (next-intl ve trailing slash sırası)", deps=["s-scaffold"],
  body="""Plan: §5.2. `skipTrailingSlashRedirect: true`; eski URL araması next-intl'den önce. Türkçe karakterli ve URI-encoded yollar, `-WxH` sonekleri.

**Kabul**: `/deck-ve-zeminler/`, `/wp-content/uploads/2018/09/1-1-400x400.jpg`, `kapıdolap2.jpeg` örnekleri tek adımda doğru hedefe gidiyor (Playwright)."""),
 dict(key="s-docker", epic="E0", labels=["phase:F0","type:spike","area:infra"],
  title="Spike: standalone Docker build (bun) + `jobs.autoRun` + Dokploy development deploy denemesi", deps=["s-scaffold"],
  body="""Plan: §3.2, §3.3. Multi-stage Dockerfile, non-root kullanıcı, healthcheck. Payload Jobs Queue'nun standalone'da cron ile çalıştığını doğrula. Dokploy `development` ortamına (`QdLx3aVSsHEUs0FXGlSXK`) deneme deploy'u.

**Kabul**: Image boyutu ve soğuk başlatma süresi kayıtlı; zamanlanmış bir test job'ı çalıştı (log)."""),
 dict(key="s-ai", epic="E0", labels=["phase:F0","type:spike","area:ai"],
  title="Spike: AI SDK + OpenRouter ile yapılandırılmış çıktı (vision) + Arapça admin RTL kontrolü", deps=["s-scaffold"],
  body="""Plan: §8. Güncel AI SDK sürümünde `generateObject` (ya da halefi) + `@openrouter/ai-sdk-provider`, Zod şeması, bir örnek görselle `tagImage` denemesi, maliyet bilgisinin yanıtta gelmesi. Payload admin'i `ar` dilinde açıp RTL görünümünü kontrol et (F3 notu).

**Kabul**: 3 görselde geçerli JSON + maliyet kaydı; RTL ekran görüntüsü."""),
 dict(key="s-report", epic="E0", labels=["phase:F0","type:docs"],
  title="Spike raporu: `docs/SPIKE.md`, sürüm pinleri, plan güncellemesi", deps=["s-orderable","s-storage","s-i18n","s-redirect","s-docker","s-ai"],
  body="""Tüm spike sonuçlarını topla. Olumsuz çıkanlar için plana alternatif yaz ve kullanıcı onayı al.

**Kabul**: SPIKE.md merge edildi; epic {{E0}} kapanabilir."""),
# ---------------- F1a ----------------
 dict(key="f-tooling", epic="E1", labels=["phase:F1","type:chore","area:infra"],
  title="Repo araçları: `/impeccable hooks on`, lint/format, tsconfig strict, test komutları", deps=["s-report"],
  body="""İlk adım: `/impeccable hooks on`. Linter seçimi (Biome ya da ESLint, kullanıcının diğer projeleriyle uyumlu), `typecheck`, `test`, `test:e2e`. `.env.example`. CLAUDE.md'deki "Komutlar" bölümünü doldur.

**Kabul**: `bun run lint typecheck test` yerelde ve CI'da geçiyor."""),
 dict(key="f-compose", epic="E1", labels=["phase:F1","type:feature","area:infra"],
  title="Docker Compose: app, postgres, umami, glitchtip, minio profilleri + `docker-compose.dokploy.yml`", deps=["s-report"],
  body="""Plan: §3.2. Tek compose dosyası her yerde çalışır; sunucudaki paylaşımlı servislere bağımlılık yok. Postgres'te `kefken`, `umami` ve `glitchtip` DB'leri. Dokploy dosyası `dokploy-network`'e bağlı, healthcheck'li.

**Kabul**: `docker compose --profile local --profile observability up` ile tüm servisler sağlıklı."""),
 dict(key="f-ci", epic="E1", labels=["phase:F1","type:feature","area:infra"],
  title="CI/CD: GitHub Actions (lint, typecheck, vitest, playwright, lighthouse) → GHCR → Dokploy webhook", deps=["f-tooling","f-compose"],
  body="""Plan: §10. PR'larda test; `development` ve `main` push'larında image build + deploy webhook. Secret'lar GitHub/Dokploy env'de.

**Kabul**: Bir PR'da tüm job'lar görünüyor; merge sonrası development otomatik deploy oluyor."""),
 dict(key="f-devenv", epic="E1", labels=["phase:F1","type:chore","area:infra"],
  title="development.kefkenahsap.com: Dokploy domain, basic auth, noindex, env/secrets", deps=["f-ci"],
  body="""Plan: §12.1. DNS kaydı hazır (A → 45.196.28.107, proxied). Dokploy'da domain, Let's Encrypt, basic auth ve `X-Robots-Tag: noindex, nofollow`.

**Kabul**: Tarayıcıda şifre soruyor; `curl -I` ile noindex başlığı görülüyor."""),
 dict(key="f-cloudflare", epic="E1", labels=["phase:F1","type:chore","area:infra"],
  title="Cloudflare temel ayarları: R2 bucket'ları + media custom domain, Turnstile, Cache Rules, AI botlarına izin", deps=["s-report"],
  body="""Plan: §10, §7 madde 7. R2: `kefken-media` (public, `media.kefkenahsap.com`), `kefken-leads` (private), `kefken-backups`. Turnstile site key. Cache Rules: statik ve medya 1 yıl, HTML 5 dk, `/admin` ve `/api` bypass. "Block AI bots" ve AI Labyrinth kapalı. HTTP/3, Early Hints, Brotli.

**Kabul**: Ayarlar `docs/RUNBOOK.md`'de; R2'ye yükleme/okuma testi."""),
# ---------------- F1b ----------------
 dict(key="m-core", epic="E2", labels=["phase:F1","type:feature","area:admin"],
  title="Koleksiyonlar: users (admin/editor), media, categories, tags", deps=["f-tooling"],
  body="""Plan: §4. Media'da lokalize alt/title/caption, status (pending/approved/hidden), aiSuggestion, legacyUrls, lqip, focalPoint. Categories'de body (Lexical), faq[], priceGuide (Maybe), seo ve `media` join (orderable). Tags'de axis.

**TDD**: slug/seoFilename seam'i, yayın için onaylı alt metin zorunluluğu (hook testi).
**Kabul**: Migration'lar temiz; editör rolü yalnızca izinli koleksiyonları görüyor."""),
 dict(key="m-projects", epic="E2", labels=["phase:F1","type:feature","area:admin"],
  title="Koleksiyonlar: projects, references, pages (+ redirects plugin)", deps=["m-core"],
  body="""Plan: §4. Projects: künye alanları (il/ilçe, yıl, ahşap, m², süre, finish), sıralı galeri, testimonial (consentGiven), reference ilişkisi. Pages: Hakkımızda, KVKK, Çerez, Süreç. `@payloadcms/plugin-redirects`.

**Kabul**: Proje, galerisiyle birlikte live preview'da görünüyor."""),
 dict(key="m-globals", epic="E2", labels=["phase:F1","type:feature","area:admin"],
  title="Global'ler: siteSettings (NAP, kurucu, sosyal, WhatsApp şablonları), homepage blokları, navigation", deps=["m-core"],
  body="""Plan: §4. siteSettings: kuruluş yılı 2009, kurucu Murat Şen, telefonlar, adres + geo, çalışma saatleri, sosyal URL'ler, areaServed, WhatsApp mesaj şablonları. Opsiyonel alanlar `Maybe<T>`: boşsa hiçbir iddia render edilmez. Homepage: blok listesi (aç/kapa + sıralama).

**TDD**: "boş alan → iddia yok" seam'i; WhatsApp mesaj builder."""),
 dict(key="m-leads", epic="E2", labels=["phase:F1","type:feature","area:admin"],
  title="Talepler: leads koleksiyonu, private R2 bucket, Resend bildirimi, 2 yıllık saklama işi", deps=["m-core","f-cloudflare"],
  body="""Plan: §4, §10 KVKK. Zorunlu alanlar: ad, telefon, KVKK rızası; diğerleri opsiyonel; en fazla 5 foto (≤10MB, image/*). Ayrı upload koleksiyonu + `signedDownloads`. Resend ile e-posta (alıcı gmail). `retentionUntil` + zamanlanmış silme işi.

**TDD**: Doğrulama seam'i, sahte zaman sağlayıcıyla saklama tarihi."""),
 dict(key="m-galeri", epic="E2", labels=["phase:F1","type:feature","area:admin","area:design"],
  title="Admin özel 'Galeri' ekranı (mobil öncelikli): yükle → AI önerisi → onayla → sürükle-bırak sırala", deps=["m-core","m-ai-tag"],
  body="""Plan: §4 "Admin deneyimi". Kategori/proje seçici; çoklu yükleme, kameradan çekim; istemcide 2560px'e küçültme + GPS temizliği; "Onay bekliyor" rozeti; tek tuşla Onayla/Düzenle/Gizle; büyük küçük resimlerle sürükle-bırak + ↑↓ butonları. Dokunma hedefleri ≥48px. impeccable Operate modu.

**Kabul**: Asıl editörle 15 dk kullanılabilirlik testi; notlar bu issue'ya."""),
 dict(key="m-pwa", epic="E2", labels=["phase:F1","type:feature","area:admin"],
  title="Admin PWA + editör menüsünün sadeleştirilmesi + Türkçe admin", deps=["m-galeri"],
  body="""Plan: §4. Manifest ve ikonlar; editörün menüsünde yalnızca Galeri, Projeler, Talepler, Yazılar ve Site Bilgileri. Admin yazı boyutu büyütülmüş.

**Kabul**: Android ve iOS'ta ana ekrana eklenebiliyor (ekran görüntüsü)."""),
 dict(key="m-ai-tag", epic="E2", labels=["phase:F1","type:feature","area:ai"],
  title="AI altyapısı: OpenRouter model zinciri, `tagImage` job'ı (yeni yüklemeler), aiUsage + bütçe durdurma", deps=["m-core"],
  body="""Plan: §8. geolyt pattern'i: görev bazlı zincir (aiSettings > env > varsayılan), fallback, Zod + JSON repair, prompt sürüm sabiti, `docs/AI-PROMPTS.md` Türkçe kuralları. Çıktı her zaman `pending` durumunda. Aylık bütçe aşılınca işler duruyor.

**TDD**: Sahte provider ile zincir/fallback, şema doğrulama, bütçe durdurma."""),
 dict(key="m-search", epic="E2", labels=["phase:F1","type:feature","area:frontend"],
  title="Arama altyapısı: Postgres FTS + pg_trgm (Türkçe) migration'ı ve sorgu servisi", deps=["m-core","m-projects"],
  body="""Plan: §3.1, §6. Alt metin, başlık, etiket, proje ve rehberlerde arama; yazım hatası toleransı; otomatik tamamlama.

**TDD**: Türkçe karakter ve typo örnekleri ("pergole" → pergola)."""),
# ---------------- F1c ----------------
 dict(key="d-meta", epic="E3", labels=["phase:F1","type:feature","area:content"],
  title="568 görselin metadata'sını lokalde Claude ile üret ve kategori bazında gözden geçir", deps=["m-core"],
  body="""Plan: §12 F1/3, karar #58. TR/EN başlık, alt, caption, SEO dosya adı ve 4 eksende etiket. Pipeline'daki `27_contact_sheet.py` / `09_serve_review.py` uyarlanarak kategori bazında inceleme yapılır; düzeltilmiş çıktı `seed/media.json` (status approved) olur.

**Kabul**: Her kategori kullanıcı tarafından gözden geçirildi; filigran metni alt metinlere girmedi."""),
 dict(key="d-seed", epic="E3", labels=["phase:F1","type:feature","area:content"],
  title="Seed script'i: kategoriler, media (approved), canlı sıradaki görsel sırası, legacyUrls", deps=["d-meta","m-core"],
  body="""Plan: §5.2, §12 F1/3. Sıra `docs/legacy/live-site-images-ordered.json`'dan gelir; Webiste'deki 69 "Yeni" foto kategorinin sonuna eklenir. Görseller R2'ye yüklenir, boyutlar üretilir. Seed idempotent.

**Kabul**: İki kez çalıştırıldığında kopya oluşmuyor; 11 kategorinin sırası test ile doğrulandı."""),
 dict(key="d-redirects", epic="E3", labels=["phase:F1","type:feature","area:seo"],
  title="Eski URL çözücüsü: 16 sayfa, attachment sayfaları, 14.468 medya URL'si (301/410)", deps=["s-redirect","d-seed"],
  body="""Plan: §5.2. `src/lib/legacy/` saf fonksiyonu (Result döner) + `proxy.ts` entegrasyonu. URI decode, NFC, `-WxH`/`-N`/`.jpg1_` normalize; ~550 eşleşme 301 ile CDN'deki en yakın boyuta, eşleşmeyen ~600 için 410. `/feed/`, `/?s=`, `/wp-json/*` kuralları.

**TDD + E2E**: `wp-media.json`'daki her URL tek adımda 200 ya da 410 veriyor."""),
 dict(key="d-projects", epic="E3", labels=["phase:F1","type:feature","area:content","area:ai"],
  title="CLIP kümeleme ile 'olası proje' önerileri → taslak projeler (admin onayıyla)", deps=["d-seed","m-projects"],
  body="""Plan: §8 `clusterProjects`. Pipeline'daki CLIP embedding'leri + EXIF tarihi ile kümeleme; LLM önerilen başlığı yazar. Projeler **taslak** olarak oluşturulur, kullanıcı admin'den onaylar.

**Kabul**: Öneri raporu; otomatik yayınlanan proje yok."""),
 dict(key="d-content", epic="E3", labels=["phase:F1","type:feature","area:content"],
  title="İçerik göçü: kategori metinleri, SSS, referanslar, hakkımızda, iletişim (TR + EN ilk geçiş)", deps=["m-projects","m-globals"],
  body="""Plan: §6, §7 içerik kuralları. Kaynak: `docs/legacy/crawl-md/`. Kategori başına cevap-önce giriş, 300–600 kelime açıklama ve 4–6 SSS (lokalde Claude taslağı, kullanıcı onayı). 9 referans. EN ilk geçişi + insan kontrolü. Uydurma iddia yok.

**Kabul**: Her kategori sayfası §7 içerik kurallarına uyuyor (kontrol listesi)."""),
# ---------------- F1d ----------------
 dict(key="u-direction", epic="E4", labels=["phase:F1","type:design","area:design"],
  title="impeccable new-work: direction contract (code-led, kategori standardı) + tasarım token'ları", deps=["f-tooling"],
  body="""Plan: §11. Seçilen yön kategori standardı. Kalite çıtası Millboard, Archadeck, Oakwrights; referansları telefonda gözle kontrol et. Surface brief'e direction contract; renk, tipografi (Montserrat + gerekirse başlık fontu, self-host) ve spacing token'ları.

**Kabul**: Surface brief'te 6 blok + seed key."""),
 dict(key="u-layout", epic="E4", labels=["phase:F1","type:feature","area:frontend"],
  title="Layout: header + mega menü, footer, mobil sabit aksiyon çubuğu (WhatsApp · Ara · Teklif), dil seçici", deps=["u-direction","m-globals"],
  body="""Plan: §6. Dil seçici, diğer dildeki slug'ı çözer; yoksa o dilin ana sayfasına gider. WhatsApp: bağlama göre mesaj, masaüstünde QR popover, mesai dışı notu, Umami event. Logical CSS (RTL'ye hazır).

**TDD**: WhatsApp builder, dil seçici slug çözümü."""),
 dict(key="u-home", epic="E4", labels=["phase:F1","type:feature","area:frontend"],
  title="Ana sayfa: admin'den yönetilen bloklar (hero, galeri, hizmetler, projeler, süreç, referanslar, ahşap türleri, SSS, iletişim)", deps=["u-layout","u-gallery"],
  body="""Plan: §6, §11. Hero: admin'den seçilen gerçek proje fotoğrafı; H1'de doğrulanmamış rakam yok ("2009'dan beri"); WhatsApp birincil, Teklif ikincil. Galeri odaklı.

**Kabul**: LCP < 2.0s (mobil), bloklar admin'den aç/kapa ve sırala."""),
 dict(key="u-category", epic="E4", labels=["phase:F1","type:feature","area:frontend"],
  title="Kategori sayfası (Archadeck akışı): giriş, galeri, açıklama, fiyat rehberi, SSS, ilgili projeler ve rehberler, CTA", deps=["u-layout","u-gallery"],
  body="""Plan: §6. 11 kategori × 2 dil, SSG + ISR. Fiyat rehberi yalnızca doluysa ve güncelleme tarihiyle gösterilir.

**Kabul**: Lighthouse ≥95, JSON-LD görünür metinle birebir."""),
 dict(key="u-gallery", epic="E4", labels=["phase:F1","type:feature","area:frontend"],
  title="Galeri: masonry (CLS=0) + infinite feed + filtre URL'leri + PhotoSwipe + görsel SSR sayfası", deps=["u-layout","d-seed"],
  body="""Plan: §3.3, §6. İlk 24 görsel SSR, devamı `/[locale]/galeri/feed?cursor=` ile. Filtreler paylaşılabilir URL (Millboard). Lightbox'ta sayaç, önceki/sonraki, küçük resim şeridi ve açıklama; URL görsel sayfasına `replaceState` ile güncellenir. Skeleton ve boş durum.

**TDD**: cursor kararlılığı, en-boy oranından kolon dağılımı. **Kabul**: CLS < 0.05, klavye ile gezilebilir lightbox."""),
 dict(key="u-project", epic="E4", labels=["phase:F1","type:feature","area:frontend"],
  title="Proje sayfası (Oakwrights yapısı) + projeler dizini (facet filtreler) + referanslar sayfası", deps=["u-gallery","m-projects"],
  body="""Plan: §6. Künye kutusu, kısa hikaye, 8–15 foto, müşteri sözü (yalnızca rızası varsa), benzer projeler. Referanslar: isim, konum ve bağlı proje; logo yok.

**Kabul**: Boş künye alanları render edilmiyor (test)."""),
 dict(key="u-contact", epic="E4", labels=["phase:F1","type:feature","area:frontend"],
  title="İletişim sayfası + teklif formu (Turnstile, foto yükleme, KVKK rızası) + harita (statik)", deps=["u-layout","m-leads"],
  body="""Plan: §6, §10. Zorunlu alanlar: ad, telefon, KVKK; diğerleri opsiyonel. Gönderilemezse WhatsApp alternatifi sunulur. Harita iframe değil, statik görsel + "Yol tarifi" linki. NAP siteSettings'ten gelir.

**E2E**: Formun uçtan uca gönderimi (Resend mock), spam koruması."""),
 dict(key="u-pages", epic="E4", labels=["phase:F1","type:feature","area:frontend"],
  title="Hakkımızda, KVKK, çerez politikası, süreç, 404, arama sayfası", deps=["u-layout","m-search"],
  body="""Plan: §6, §10. Hakkımızda: Murat Şen, 2009, iki kuşak marangozluk; doğrulanmamış yıl yok. KVKK metninde yurt dışı aktarım (Cloudflare, Resend, Gmail) belirtilir; avukat kontrolü önerilir. 404 sayfasında arama ve popüler kategoriler. Arama sayfası noindex.

**Kabul**: Metinler kullanıcı onaylı."""),
 dict(key="u-consent", epic="E4", labels=["phase:F1","type:feature","area:analytics"],
  title="Çerez banner'ı + Consent Mode v2 + GA4 (G-S84WKG63MS, page_locale) + Umami event'leri", deps=["u-layout"],
  body="""Plan: §7 Ölçüm. GA4 yalnızca onaydan sonra yüklenir; tek property, `page_locale` custom dimension. Umami her zaman çalışır: `whatsapp_click`, `phone_click`, `form_submit`, `gallery_open`, `filter_use`, `lang_switch`.

**E2E**: Reddedince gtag isteği gitmiyor."""),
 dict(key="u-motion", epic="E4", labels=["phase:F1","type:feature","area:frontend","area:design"],
  title="Hareket: Motion + GSAP ScrollTrigger + OGL hero efekti (lazy, reduced-motion, saveData)", deps=["u-home"],
  body="""Plan: §3.1, §9. Hepsi dinamik import. `prefers-reduced-motion`, `saveData`, düşük `deviceMemory` ya da WebGL yoksa yüklenmez.

**Kabul**: İlk yükleme JS ≤150KB gz korunuyor (Lighthouse CI bütçesi)."""),
 dict(key="u-finish", epic="E4", labels=["phase:F1","type:design","area:design"],
  title="impeccable finish review + DESIGN.md + design.json", deps=["u-home","u-category","u-gallery","u-project","u-contact","u-pages","u-motion"],
  body="""Plan: §11. Masaüstü ve mobil ekran görüntüleri; finish reviewer; en fazla 2 düzeltme turu; impeccable-documenter.

**Kabul**: `ship` kararı; DESIGN.md merge edildi."""),
# ---------------- F1e ----------------
 dict(key="o-meta", epic="E5", labels=["phase:F1","type:feature","area:seo"],
  title="Metadata: title/description, self-canonical, hreflang (dil-yayında kuralı), OG/Twitter, opengraph-image", deps=["u-layout","s-i18n"],
  body="""Plan: §5.1, §7 Teknik 1–5. Çevirisi olmayan dil yalnızca noindex olur; çapraz canonical yok, hreflang'de yer almaz. `og:locale` tr_TR / en_US. 1200×630 OG görseli.

**TDD**: Dil-yayında kuralının hreflang ve noindex kararı; CI'da `nosnippet` ya da kazara `noindex` taraması."""),
 dict(key="o-robots", epic="E5", labels=["phase:F1","type:feature","area:seo"],
  title="robots.ts (tek `*` grubu), sitemap'ler (sayfa + görsel, dil alternatifleri), llms.txt / llms-full.txt", deps=["o-meta"],
  body="""Plan: §7 Teknik 6, 8, 9. `/admin`, `/api` ve arama disallow; tüm AI botlarına izin. lastmod `updatedAt`'ten. llms.txt "Key Facts" bloğu siteSettings'ten üretilir.

**Test**: robots çıktısı; sitemap'te yalnızca indekslenebilir URL'ler."""),
 dict(key="o-jsonld", epic="E5", labels=["phase:F1","type:feature","area:seo"],
  title="JSON-LD builder'ları: HomeAndConstructionBusiness, Service, FAQPage, BreadcrumbList, CreativeWork, ImageObject, Article, ItemList", deps=["o-meta"],
  body="""Plan: §7 Structured data. `safeJsonLd`; görünür metinle birebir; boş alanlar (Maybe) atlanır; founder Murat Şen, foundingDate 2009; sameAs Instagram, Facebook ve GBP. SearchAction yok.

**TDD**: Her builder için snapshot + "görünür metinde var" kontrolü; Rich Results Test sonuçları."""),
 dict(key="o-guides", epic="E5", labels=["phase:F1","type:feature","area:content"],
  title="Rehber şablonu + 3–4 temel rehber (Iroko mu Teak mi?, Deck bakımı, Ahşap türleri, Pergola fiyatı)", deps=["m-core","o-jsonld"],
  body="""Plan: §6 F2 notu, karar #57. Guides koleksiyonu, TOC, FAQ, yazar kutusu (Murat Şen), "Güncellendi" tarihi. İçerik lokalde Claude taslağı + kullanıcı onayı; ahşap türleri tablosu eski içerikten.

**Kabul**: §7 içerik kurallarına uygun; eski "ağaç yaşı" içeriği yok."""),
 dict(key="o-docs", epic="E5", labels=["phase:F1","type:docs","area:content"],
  title="`docs/CONTENT-STYLE-TR.md` + `docs/AI-PROMPTS.md` (Türkçe yazım kuralları, yasak klişeler, terim sözlüğü)", deps=["s-report"],
  body="""Plan: §7, §8. Ek kuralları, çeviri kokan yapılar, yasaklı ifadeler, TR↔EN terim sözlüğü (deck, kamelya → gazebo, emprenye → pressure-treated...).

**Kabul**: AI prompt'ları bu dokümana referans veriyor."""),
 dict(key="o-observe", epic="E5", labels=["phase:F1","type:chore","area:infra"],
  title="Gözlemlenebilirlik ve yedek: GlitchTip (lazy, tracing/replay yok), Uptime Kuma monitörü, Dokploy Postgres backup → R2", deps=["f-compose","f-cloudflare"],
  body="""Plan: §3.2, §9, §12.1. Uptime Kuma sunucudaki mevcut kurulumda (tools projesi). Geri yükleme prosedürü `docs/RUNBOOK.md`'de, bir kez denenmiş olarak.

**Kabul**: Test hatası GlitchTip'te görünüyor; backup dosyası R2'de; restore denemesi başarılı."""),
 dict(key="o-quality", epic="E5", labels=["phase:F1","type:chore","area:qa"],
  title="Kalite kapıları: Lighthouse CI bütçeleri + axe tüm şablonlarda geçiyor", deps=["u-finish"],
  body="""Plan: §9. Ana sayfa, kategori, proje, görsel, rehber, iletişim (TR ve EN, mobil).

**Kabul**: Hepsi ≥95; axe 0 kritik; CLS < 0.05."""),
 dict(key="o-launch", epic="E5", labels=["phase:F1","type:chore","area:infra"],
  title="Lansman: production ortamı, DNS geçişi (apex/www), cache purge, GSC sitemap, 2 hafta 404 izleme", deps=["o-quality","o-robots","o-jsonld","d-redirects","o-observe","d-content","o-guides"],
  body="""Plan: §10, §12.1. Dokploy production ortamı; Cloudflare'de apex ve www A kayıtları 104.247.167.3'ten 45.196.28.107'ye; `kefkenahsap.com` → www 301. cPanel kayıtları WP yedeği için kalır. GSC'ye sitemap gönderimi. 2 hafta boyunca eski URL'lerden gelen 404'ler izlenir.

**Kabul**: Yönlendirme E2E'si production'da yeşil; 404 = 0 raporu."""),
 dict(key="o-post", epic="E5", labels=["phase:F1","type:chore","area:seo"],
  title="Lansman sonrası kullanıcı işleri (§13.1): GSC, İşletme Profili, Instagram, başlangıç yılı", deps=["o-launch"],
  body="""Plan: §13.1.
- [ ] GSC Domain doğrulaması (TXT → Cloudflare), GA4 ↔ GSC bağlantısı, Performans ve Sayfalar CSV'leri → `docs/legacy/gsc/`
- [ ] GBP: ana ve ek kategoriler, 11 hizmet, fotoğraflar, gönderiler, yorum isteme, website linki (utm)
- [ ] Instagram kullanıcı adının marka ile tutarlı hale getirilmesi → siteSettings
- [ ] Murat Şen'in mesleğe başlama yılı → siteSettings
- [ ] (Ayrı iş) info@kefkenahsap.com: MX + Mailu"""),
# ---------------- F2 ----------------
 dict(key="a-translate", epic="E6", labels=["phase:F2","type:feature","area:ai","area:admin"],
  title="Admin: 'AI ile çevir' butonu (eksik diller, Lexical yapısı korunur, terim sözlüğü)", deps=["m-ai-tag","o-docs"],
  body="""Plan: §8. Tek prompt'ta tüm hedef diller; yalnızca metin düğümleri çevrilir; sonuç taslak olarak kaydedilir.

**TDD**: Lexical JSON yapısının korunması, sözlük uygulanması (sahte provider)."""),
 dict(key="a-draft", epic="E6", labels=["phase:F2","type:feature","area:ai","area:admin"],
  title="Admin: 'AI ile taslak' butonu (rehber ve proje hikayesi) — otomatik yayın yok", deps=["m-ai-tag","o-docs"],
  body="""Plan: §8. Taslak her zaman `draft` durumunda kalır. Yayına giden bir kod yolu olmadığı testle kanıtlanır."""),
 dict(key="a-settings", epic="E6", labels=["phase:F2","type:feature","area:ai","area:admin"],
  title="aiSettings: OpenRouter model seçici (görev başına zincir) + maliyet paneli + aylık limit", deps=["m-ai-tag"],
  body="""Plan: §8. OpenRouter `/models` listesi (1 saat cache); görev başına zincir düzenleme; aiUsage özeti.

**Kabul**: Model değişikliği sonraki job'da kullanılıyor (test)."""),
 dict(key="a-guides", epic="E6", labels=["phase:F2","type:feature","area:content"],
  title="Kalan rehberler (Thermowood, Emprenyeli ahşap, Korkuluk ahşap mı metal mi, Havuz kenarı deck...)", deps=["a-draft","o-guides"],
  body="""Plan: §12 F2. AI taslak + insan onayı; §7 içerik kuralları."""),
 dict(key="a-regions", epic="E6", labels=["phase:F2","type:feature","area:seo"],
  title="Bölge sayfaları: regions koleksiyonu + publishGate (en az 3 proje + 250 kelime)", deps=["m-projects","o-jsonld"],
  body="""Plan: §4, §7, karar #25. Elle yazılır; kalıp doorway sayfa yok. Gate karşılanmazsa noindex.

**TDD**: publishGate kararı."""),
 dict(key="a-3d", epic="E6", labels=["phase:F2","type:feature","area:frontend","area:design"],
  title="OGL 3D ahşap numuneleri (iroko, teak, çam, thermowood) — rehber sayfası", deps=["o-guides"],
  body="""Plan: §6 F2. WebGL yoksa statik görsel; lazy yükleme; reduced-motion desteği.

**Kabul**: Lighthouse bütçesi korunuyor."""),
 dict(key="a-content", epic="E6", labels=["phase:F2","type:feature","area:content"],
  title="Kategori metinleri, SSS ve fiyat rehberlerinin tamamlanması + proje kayıtlarının zenginleştirilmesi", deps=["d-content"],
  body="""Plan: §12 F2. Fiyat aralıkları kullanıcıdan gelecek, tarihli olacak."""),
 dict(key="a-geolyt", epic="E6", labels=["phase:F2","type:chore","area:seo"],
  title="geolyt ile GEO skoru: lansman baz ölçümü + 4 hafta sonra tekrar", deps=["o-launch"],
  body="""Plan: §7 Ölçüm. Rapor `docs/geo/` altında; düşük çıkan maddeler için yeni issue'lar açılır."""),
# ---------------- F3 ----------------
 dict(key="x-ar", epic="E7", labels=["phase:F3","type:feature","area:i18n"],
  title="Arapça (RTL) dil desteği", deps=["a-translate"],
  body="""Plan: §5.1. `dir="rtl"`, logical CSS denetimi, Arapça admin, fontlar.

**Kabul**: RTL ekran görüntüleri; hreflang."""),
 dict(key="x-rude", epic="E7", labels=["phase:F3","type:feature","area:i18n"],
  title="Rusça ve Almanca dil desteği", deps=["a-translate"],
  body="""Plan: §12 F3. AI çeviri + insan kontrolü; hreflang ve sitemap."""),
 dict(key="x-archive", epic="E7", labels=["phase:F3","type:feature","area:content"],
  title="Kaliteli arşivinden (3250) seçilmiş görsellerin eklenmesi", deps=["d-seed"],
  body="""Plan: §12 F3. Seçim, metadata ve onay `d-meta` akışıyla aynı şekilde yapılır."""),
 dict(key="x-geo", epic="E7", labels=["phase:F3","type:chore","area:seo"],
  title="geolyt bulgularına göre iyileştirme turu", deps=["a-geolyt"],
  body="""geolyt raporundaki düşük puanlı maddeler."""),
]

LABELS = {
 "epic":"5319e7","phase:F0":"bfd4f2","phase:F1":"0e8a16","phase:F2":"fbca04","phase:F3":"c5def5",
 "type:spike":"d4c5f9","type:feature":"a2eeef","type:chore":"ededed","type:docs":"0075ca","type:design":"f9d0c4",
 "area:infra":"1d76db","area:admin":"b60205","area:frontend":"0052cc","area:seo":"006b75","area:ai":"8a2be2",
 "area:content":"c2e0c6","area:i18n":"fef2c0","area:design":"e99695","area:analytics":"5319e7","area:qa":"d93f0b",
}
MILESTONES = ["F0 Spike","F1 Lansman","F2 İçerik & AI","F3 Genişleme"]
