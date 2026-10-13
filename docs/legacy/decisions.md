# Kefken Ahşap — yeni site karar kaydı (interview sürüyor)

## Bulgular (mevcut durum)
- WordPress, 16 sayfa (page-sitemap.xml), 0 blog yazısı, 1169 medya eki (wp-content/uploads/YYYY/MM/*.jpg) — Google Görseller'de indeksli olabilir.
- 11 kategori: ahsap-yapilar, boya-tamir-ve-bakim, ciceklik-ve-oturma-grubu, deck-ve-zeminler, ireko-teak, kapi-dolap-ve-seperator, kopru-ve-iskele, korkuluk-ve-cit, merdivenler, mobilya-ve-cila, pergola-ve-kamelyalar + hakkimizda, hizmetlerimiz, referanslar, iletisim.
- Görseller: kefken-data/Webiste (568, sitedeki dosya adlarıyla eşleşir → eski URL eşleme için kullanılabilir), Kaliteli (3250), Kalitesiz (567). Hepsi webp, GPS EXIF temizlenmiş, filigranlı.
- Logo renkleri: #009444, #39b54a (yeşil), #231f20, #414042. Font: Montserrat.
- İletişim: GSM 0532 295 84 16, sabit 0212 322 43 59, info@ / kefkenahsapdekorasyon@gmail.com, Mavigöl Münteha Sk. No:31 Arnavutköy/İstanbul.
- Referanslar: Cennetköy (Bodrum), Riva Konakları, Kemer Golf & Country, Neo Gölpark, İBB Sosyal Tesisler, Mesa Mesken, Nurol, Yaşar Holding (Libya), İGK.
- Kullanıcının stack'i: Next.js 16 + React 19 + Tailwind 4, next-intl 4, Postgres + Drizzle, better-auth, bun, Dokploy compose (dokploy-network), GlitchTip(Sentry SDK), pino. portfolio projesinde gray-matter + react-markdown blog.

## Kararlar
1. Bölge: İstanbul ağırlıklı + Türkiye geneli.
2. Birincil dönüşüm: WhatsApp (sayfa bağlamına göre hazır mesaj).
3. Eski "ahşap teknik / ağaç yaşı / ağaç cinsleri" içerikleri: ana sayfadan kalkar; blog/rehber bölümü kurulacak (indekslenebilir içerik üretimi). Öneri bekleniyor.
4. Diller: TR + EN başlangıç; ileride AR (RTL), RU, DE → altyapı N dil + RTL hazır.
6. Lansman görsel seti: sadece Webiste (568). Kaliteli sonra admin'den eklenebilir.
7. Alt metin/başlık/dosya adı/etiket: AI toplu üretim (TR/EN) + admin'de "onay bekliyor" durumu.
8. Filigran: mevcutlar kalır, yeni yüklemelere otomatik eklenmez.
9. İçerik modeli: Kategori + Etiket + Proje (admin'den proje oluşturulur, listelenir).
10. Stack: Next.js 16 + Payload 3.x (tek uygulama, bun) + Postgres 17 + ~~local volume media~~ (→ #29 R2 ile değişti) (sharp). Go backend yok.
11. URL: tüm diller önekli (/tr/, /en/), çevrilmiş slug, hreflang + x-default; / → dil tespiti → /tr. 16 sayfa + 1169 medya + attachment sayfaları 301.
12. NAP: kefkenahsapdekorasyon@gmail.com (info@ aktif olunca geçilecek), 0532 295 84 16 (GSM/WhatsApp), 0212 322 43 59, Mavigöl Münteha Sk. No:31 Arnavutköy/İstanbul.
13. Google: GA4 var, GSC erişimi var (muhtemelen), GBP var (düzenleme gerekebilir). .env OAuth = Drive indirme için, projeyle ilgisiz.
14. Analitik: GA4 (Consent Mode v2, onay sonrası) + GSC + self-host Umami (çerezsiz, WhatsApp/tel event).
15. Tasarım yönü: impeccable skill ile belirlenecek (aday: sıcak zanaat + kurumsal sadelik).
16. 3D: hero'da ince efekt + ahşap türleri rehberinde 3D numune; lazy, reduced-motion/low-power'da kapalı.
17. Galeri: masonry + infinite scroll + lightbox + blur placeholder/skeleton + her görselin indekslenebilir URL'si.
18. Admin: 2 rol (admin, editor); editor için TR, sade menü.
19. Çeviri: admin'de "AI ile çevir" butonu + elle düzeltme; OpenRouter (model seçilebilir, geolyt pattern'i), çeviri yaklaşımı aciktirio'dan. Çevirisi olmayan dil sayfası noindex. Ahşap terim sözlüğü.
20. Form: ad, telefon zorunlu; e-posta, hizmet, il/ilçe, mesaj, ≤5 foto opsiyonel. Admin'de "Talepler" + e-posta bildirimi; Turnstile/honeypot + rate limit.
21. E-posta: Resend (SPF/DKIM), alıcı gmail.
22. Blog/Rehber: ~~lansmanda 6-10 rehber~~ (→ #57: lansmanda 3-4) + proje hikayeleri; admin'de "AI ile taslak", otomatik yayın yok. Ağaç cinsleri tablosu → interaktif rehber.
23. Editör: Payload Lexical (sade toolbar) + Payload Live Preview / draft-versions.
24. Kategori sayfası: açıklama (300-600 kelime) + SSS (FAQPage) + ilgili projeler/rehberler + hizmet bölgeleri. GEO/SEO checklist geolyt rubric + easyapp-website'tan türetilecek.
25. Bölge sayfaları: kalıp doorway yok; admin'de "Bölge" koleksiyonu (elle yazılır, projelere bağlanır, içerik yeterliyse yayınlanır).
26. AI altyapısı: geolyt pattern — Vercel AI SDK + @openrouter/ai-sdk-provider, görev bazlı model zinciri (env + admin'den override), generateObject + Zod, maliyet kaydı. Çeviri: aciktirio tarzı tek prompt çok dil + bizim eklediğimiz terim sözlüğü.
27. Gözlem: GlitchTip (Sentry SDK) + Umami, ikisi de projenin compose'unda. Prom/Grafana yok.
28. Taşınabilirlik: her şey tek compose'ta (app, postgres, umami, glitchtip(+redis), opsiyonel minio profili); sunucudaki başka hiçbir şeye bağımlı değil.
29. Medya: Payload S3 adapter → prod Cloudflare R2 (CDN, custom domain ör. media.kefkenahsap.com), lokal MinIO.
30. Cloudflare: DNS taşınacak (güzelhosting'den; WP orada yedek kalır, MX korunur), Turnstile, Cache Rules + Payload hook ile purge, AI bot engelleme kapalı, faydalı her şey (HTTP/3, Early Hints, Brotli, WAF managed rules — botları engellemeden).
31. AI botlar: arama + eğitim botlarının hepsine izin.
32. GEO/SEO checklist: .omc/research (geolyt rubric + easyapp) → plana gömülecek.
33. Şirket bilgileri: Site Ayarları global'inde yer tutucu (kuruluş yılı, kurucu/usta, ekip, proje sayısı); tüm schema/metin buradan beslenir. Eski "30 yıl" ifadesi doğrulanana kadar kullanılmaz.
34. Fiyat: faktörler + yaklaşık m² aralığı, admin'den güncellenir, "güncelleme tarihi" görünür.
35. sameAs: Instagram, Facebook (+GBP).
36. Ana sayfa: galeri odaklı + hero, hizmetler, öne çıkan projeler, süreç, referanslar, ahşap türleri, SSS, iletişim — bloklar admin'den aç/kapa/sırala.
37. Animasyon: Motion (UI/layout/lightbox) + GSAP ScrollTrigger (scroll anlatımı) + OGL (hero shader + rehberde 3D numune). Lazy, reduced-motion.
38. Arama: Postgres FTS + pg_trgm (Türkçe), autocomplete; ek servis yok.
39. Etiket eksenleri: ahşap türü, mekan, renk/finish, öncesi/sonrası/süreç/detay.
40. Her görselin SSR sayfası (/tr/galeri/<slug>); lightbox URL'yi günceller; WP attachment sayfaları buraya 301.
41. Yasal: KVKK aydınlatma + çerez politikası + Consent Mode v2 banner + form açık rıza; talepler 2 yıl sonra otomatik silinir.
42. Hedefler: Lighthouse mobil 95+, CWV yeşil (LCP<2.0s, INP<200ms, CLS<0.05), WCAG 2.2 AA, initial JS ≤150KB gz; CI'da Lighthouse + axe.
43. CI: GitHub Actions (lint, typecheck, Vitest, Playwright smoke) → GHCR image → Dokploy webhook; staging ortamı.
44. Yedek: Dokploy'un kendi Postgres backup'ı (hedef R2). Medya R2'de. (Not: compose taşınabilir, backup Dokploy'a bağlı — kabul edildi.)
45. Admin Galeri: özel Payload view (kategori/proje seç → sürükle-bırak yükle → büyük thumbnail ile sırala → AI önerisi "onay bekliyor" rozetiyle → tek tıkla yayınla/gizle).
46. Mobil admin: mobil-öncelikli Galeri + PWA, kameradan yükleme, istemci tarafı küçültme.
47. AI modeller: varsayılan vision=Gemini Flash sınıfı, metin/çeviri=Claude Sonnet sınıfı; görev bazlı model zinciri admin'den değiştirilebilir; aylık limit + maliyet kaydı. Türkçe prompt kuralları easyapp-bot'tan.
48. İlk aktarım: seed script (WP sırası korunur, eski URL + boyut varyantları kaydedilir → 301 haritası) + toplu AI etiketleme + CLIP embedding ile "olası proje" kümeleri (onaylı).
49. Fazlar: F1 lansman (TR+EN, kategoriler, galeri, proje iskeleti, iletişim/WhatsApp, admin Galeri, 301, SEO/GEO çekirdeği, analitik) → F2 (rehber içerikleri, 3D numune, AI çeviri/taslak butonları, bölge sayfaları) → F3 (AR/RU/DE, Kaliteli arşivi, ileri optimizasyon).
50. Proje alanları: başlık, kategoriler, etiketler, sıralı görseller, kapak, hikaye; il/ilçe (+opsiyonel harita), yıl; ahşap türü, m²/metre, süre, finish; müşteri yorumu + referans bağlantısı (Review schema sadece gerçek yorumda).
51. WhatsApp: wa.me + bağlama göre hazır mesaj + Umami event; masaüstünde QR; mesai dışı notu.
52. Referanslar: isim + konum + bağlı proje; logo yalnızca izinle (admin'den eklenebilir).
53. easyapp-bot: Türkçe kural yok → kendi TR yazım rehberimizi yazacağız. Alınacaklar: fallback zinciri, JSON-fixer/repair pass, prompt'ta Zod ile eşleşen sert limitler, bugünün tarihini enjekte etme, düşük temperature.
5. Eski URL'ler 301 ile yeni içeriğe yönlendirilecek (sayfalar + wp-content/uploads görselleri + attachment sayfaları).
54. Tasarım: impeccable round → kullanıcı "Kategori standardı"nı seçti (beyaz zemin, yeşil aksiyon, tam genişlik foto, hizmet gridi), tam ustalıkla. Referanslar: Millboard, Archadeck, Oakwrights. Hero'da doğrulanmamış "30 yıl" yok.
55. Kanonik host www.kefkenahsap.com; apex → www 301.
56. Webiste setinde eşleşmeyen ~600 eski WP medyası → 410. Eşleşen ~550 → 301 (14.468 boyut varyantı URL'si tek handler ile).
57. Rehber: lansmanda 3-4 temel rehber, kalanı F2.
58. 568 görselin metadatası lokalde Claude ile üretilip gözden geçirilir, seed'e approved olarak girer; runtime AI yalnızca yeni yüklemeler.
59. Critic düzeltmeleri plana işlendi: WebP-only, medya doğrudan CDN (disablePayloadAccessControl), lead foto private bucket, dil-yayında sinyali = slug+title dolu, untranslated = sadece noindex, tek robots grubu, jobs.autoRun, purge_everything, KVKK yurt dışı aktarım.
60. Altyapı: mevcut private repo senrecep/kefkenahsap kullanılır (eski içerik archive/gemini-plan), default main, development dalı → development.kefkenahsap.com (Dokploy `kefkenahsap` projesinde `development` ortamı). Staging yerine development.
61. Cloudflare zone zaten aktif; MX yok (info@ ayrı iş, Mailu ile). Lansmanda yalnızca apex/www A kaydı çevrilir.
62. GA4 kuruldu: ölçüm ID G-S84WKG63MS (env `NEXT_PUBLIC_GA_ID`; snippet olduğu gibi gömülmez, Consent Mode v2 ile onay sonrası yüklenir). GSC hesaba bağlandı. GBP doğrulanmış ve yönetiliyor: "Kefken Ahşap Dekorasyon", Millwork shop / Arnavutköy, 5.0 (9 Google yorumu), 294 etkileşim; Facebook 1.7K takipçi, 4.8 (19); Instagram @kefken_ahsap_dek_gokturk (1K+, profil adı "Murat Şen"). Google snippet'i hâlâ "30 senelik tecrübe" diyor.
63. Kurucu/usta: **Murat Şen** (adı soyadı ve telefonu sitede ve Person/founder schema'da yer alır; telefon = 0532 295 84 16, kullanıcı teyidiyle netleşir). Şirket kuruluşu **2009** (foundingDate). Zanaat geçmişi: 1968 doğumlu; çocukken marangoz babasıyla çalışmış, 20-25 yaşlarında (~1988-1993) mesleğe tam başlamış — kesin yıl kullanıcı babasıyla konuşunca girilecek; o zamana kadar "X yıllık tecrübe" yazılmaz, "2009'dan beri" + "iki kuşak marangozluk" ifadesi kullanılabilir (aile zanaatı doğrulandı).
64. sameAs: https://www.instagram.com/kefken_ahsap_dek_gokturk/ , https://www.facebook.com/kefkenahsapdekorasyon (+ GBP). Instagram kullanıcı adı sonradan tutarlı hale getirilecek → URL siteSettings'ten okunur, kodda sabit yok.
