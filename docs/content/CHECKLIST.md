# İçerik kontrol listesi (#34): ilk TR + EN geçişi

**Durum: TASLAK. Sahibinin onayını bekliyor.** Metinler `seed/content/**` altında. `scripts/seed/content.ts` bunları **taslak** (draft) olarak yükler. Yayına alma, admin'de "Yayınla" ile yapılır.

Sayılar `src/lib/content/content.test.ts` ile aynı kuraldan üretildi (`wordCount`). Testler her kategori için şunları zorunlu tutar:
- Açıklama TR ve EN'de 300–600 kelime.
- En az 3 H2 ve hepsi soru cümlesi.
- Kısa açıklama tek cümle.
- 4–6 SSS.
- Yasaklı klişe ve uydurma iddia kalıbı yok: `N yıl/sene`, `TL/₺/€/$`, garanti, sertifika, ücretsiz, "eşsiz" vb.

## Kategori başına §7 kuralları

| Kategori | Kısa açıklama (kelime) | Giriş paragrafı (≤150) | Açıklama TR / EN (kelime) | H2 (soru) | SSS TR / EN | Uydurma iddia yok |
|---|---|---|---|---|---|---|
| Ahşap Yapılar | 18 | 29 | 322 / 395 | 4 | 5 / 5 | ✓ |
| Deck ve Zeminler | 16 | 28 | 312 / 416 | 4 | 6 / 6 | ✓ |
| Pergola ve Kamelyalar | 16 | 28 | 334 / 445 | 4 | 5 / 5 | ✓ |
| Korkuluk ve Çit | 19 | 28 | 334 / 407 | 4 | 5 / 5 | ✓ |
| Köprü ve İskele | 19 | 47 | 342 / 417 | 5 | 5 / 5 | ✓ |
| Merdivenler | 17 | 26 | 312 / 400 | 4 | 5 / 5 | ✓ |
| Çiçeklik ve Oturma Grubu | 16 | 39 | 320 / 410 | 4 | 5 / 5 | ✓ |
| Kapı, Dolap ve Seperatör | 19 | 39 | 318 / 402 | 5 | 5 / 5 | ✓ |
| Iroko ve Teak | 18 | 37 | 345 / 420 | 5 | 6 / 6 | ✓ |
| Mobilya ve Cila | 18 | 32 | 313 / 401 | 5 | 5 / 5 | ✓ |
| Boya, Tamir ve Bakım | 17 | 33 | 309 / 390 | 4 | 6 / 6 | ✓ |

Her kategoride ortak olanlar:
- Cevap-önce kısa açıklama.
- "Hangi ahşap", "İş nasıl ilerliyor" (keşif → ölçü ve teklif → atölyede imalat → montaj → bakım) ve "Bakımı nasıl yapılır" bölümleri.
- Fiyat sorusu yalnızca fiyatı belirleyen etkenlerle cevaplanır, rakam yok.
- `priceGuide` boş bırakıldı.

## Kaynaklar ve neyin nereden geldiği

- **Eski sitenin kategori sayfaları boş.** Crawl'da yalnızca başlık ve galeri var, metin yok. Bu yüzden kategori metinlerinin hepsi yeni yazıldı.
- **Doğrulanmış olgular:** PRODUCT.md ve decisions.md'den.
  - 2009, Murat Şen, Arnavutköy atölyesi.
  - İmalat ve montaj aynı elde, aracı yok.
  - Başka firmaların işlerine bakım.
  - Köprü, iskele, kurum işleri, Libya.
  - İstanbul ağırlıklı, Türkiye geneli.
  - Tekne ve teak işleri.
- **İş türleri ve ahşap türleri:** `seed/media-meta` içindeki gerçek fotoğrafların başlık ve etiketlerinden.
  - Ahşap türleri: çam, emprenyeli çam, iroko, teak, meşe, OSB.
  - İş türlerine örnekler: köpek kulübesi, kemerli köprü, T iskele, klima kasası, tekne konsolu.
- **Eski siteden alınanlar:** "her türlü ahşap ve emprenyeli ahşap imalat ve montaj", "gelenekten geleceğe uzanan ahşap sevdamız", "her türlü tamirat ve bakım işleri yapılır" ve Hizmetlerimiz listesi.
- **Eski siteden bilerek alınmayanlar** (CLAUDE.md, decisions #33/#54): "30 senelik tecrübe", "hızlı teslim", "yüksek kalite", "uzman ekipler", "ileri yapım teknikleri".
- **Thermowood ve kompozit hiçbir metinde yok.** Ne eski sitede ne fotoğraf etiketlerinde geçiyor.

## Sahibinin onaylaması gereken cümleler

Genel bilgi ya da fotoğraf etiketlerinden çıkarım. Yanlışsa düzeltilmeli veya silinmeli.

**Bakım aralıkları (genel bilgi, firmaya özgü değil)**
1. Deck: "yılda en az bir kez yıkamak … yağla beslemek", "Genellikle yılda bir kez yeterlidir."
2. Iroko/Teak: "yılda bir ya da iki kez yıkayıp … yağ sürmek yeterlidir."
3. Ahşap Yapılar: "Genellikle birkaç yılda bir yapılan zımpara ve boya ile…"
4. Boya, Tamir ve Bakım: "Deck gibi yatay yüzeyler genellikle yılda bir yağ ister." Ayrıca bakım mevsimi olarak ilkbahar ve sonbahar öneriliyor.
5. Köprü ve İskele: "Bağlantı cıvatalarını ve korkuluk dikmelerini her sezon kontrol etmek gerekir."

**Malzeme ve yöntem**

6. Iroko/Teak: "Iroko … maliyeti genellikle daha düşüktür", "Teak, tekne güvertelerinde … geleneksel olarak kullanılan ağaçtır", "emprenye gibi bir ön işleme gerek duymadan". Bunlar genel bilgi.
7. Köprü ve İskele: kavisli kirişlerin "ince ahşap katmanları tutkallayıp kalıp üzerinde presleyerek" yapıldığı yazıyor. Kaynak, "Kavisli Ahşap Kiriş İmalatında Tutkallama" başlıklı fotoğraf. Yöntem doğru mu?
8. Köprü ve İskele: "Suyun içine inen ayaklarda … beton ya da metal taşıyıcılar da kullanılabilir."
9. Çiçeklik: iç yüzeyin "bir astar ya da örtüyle" kaplandığı, tabanda tahliye deliği bırakıldığı ve kasanın yükseltildiği yazıyor. Uygulamanız böyle mi?
10. Kapı/Dolap: "Geniş kapı kanatlarında ahşabı metal bir kasayla taşımak…" Kaynak: metal kasalı ve sürgülü kapı fotoğrafları.
11. Mobilya: "gövde ve iç bölmelerde … levha malzemeler kullanılabilir". Fotoğraf etiketlerinde yalnızca meşe var.
12. Ahşap Yapılar: "OSB gibi levhalardan da yararlanılabilir". Fotoğraf etiketinden alındı.
13. Merdivenler (SSS): "İstenirse basamak yüzeyine kaydırmaz detaylar eklenebilir." Bu hizmeti veriyor musunuz?
14. Klima kasası (SSS): "servis için de kapak ya da sökülebilir panel bırakılır."

**Hizmet kapsamı**

15. Ahşap Yapılar: "WC ve duş kabini", "köpek kulübeleri" ve "Türkiye'nin farklı yerlerinde ve yurt dışında da çalıştık" (SSS). Yurt dışı bilgisi PRODUCT.md'deki Libya'ya dayanıyor.
16. Köprü ve İskele / Hakkımızda: "site, kurum ve otel gibi geniş alanlarda" ve "oteller, marinalar ve tekne sahipleri". Kaynak PRODUCT.md'deki kullanıcı grupları; otel ve marina için somut bir referans listede yok.
17. Mobilya: "Toplantı masaları ve yönetici ofisi mobilyaları", "Tekne kamaraları için çalışma masası, konsol ve dolaplar". Kaynak fotoğraf başlıkları.
18. Hakkımızda: "Murat Şen, marangoz babasının yanında ahşapla büyüdü ve gençliğinde mesleği tam zamanlı sürdürmeye başladı" ve "Zanaatımız iki kuşaktır aynı ailenin elinde." Kaynak decisions #63; kesin yıl bilerek yazılmadı.
19. İletişim: "Mesajınızı aldıktan sonra işi sizinle konuşuyor, uygun bir günde yeri görmeye geliyoruz." Keşif ücretli mi ücretsiz mi bilinmediği için bundan hiç bahsedilmedi.

## Açık sorular

- **Referans adları** eski siteden harfiyen alındı: "Kemer Golf & Contry Clup", "Göktürk / istanbul", "Nurol A.S". decisions.md'de "Kemer Golf & Country" yazıyor. Doğru yazım "Kemer Golf & Country Club" ve "Nurol A.Ş." mı? Doğruysa admin'den düzeltilebilir. Yükleyici yalnızca boş alanları doldurduğu için bu düzeltmeyi ezmez.
- **EN marka adı:** metinlerde "Kefken Ahşap Dekorasyon" çevrilmeden kullanıldı. siteSettings'in EN açıklamasında ise "Kefken Wood Decoration" geçiyor. Hangisi kullanılacak?
- **Eski Hizmetlerimiz sayfasındaki bağlantılar** büyük olasılıkla yanlış:
  - "Gazebo" Boya, Tamir ve Bakım'a gidiyor.
  - "Garaj ve Garaj Kapıları" ile "Dış Cephe Ahşap Kaplama" Pergola'ya gidiyor.

  Metinlerde cephe kaplaması Ahşap Yapılar'a, bahçe kapıları Kapı, Dolap ve Seperatör ile Korkuluk ve Çit'e yazıldı. Garaj kapısı hiçbir metinde yok. Garaj kapısı yapılıyor mu?
- **İletişim sayfasında** adres, telefon ve e-posta yok. Bunlar siteSettings'ten render edilir; aynı bilgiyi iki yerde tutmamak için gövdeye yazılmadı. Çalışma saatleri bilinmediği için onlar da yazılmadı.
- **SEO alanları** (`seo.title` / `seo.description`) bu geçişte doldurulmadı.
