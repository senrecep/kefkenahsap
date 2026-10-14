# İçerik kontrol listesi (#34): ilk TR + EN geçişi

**Durum: TASLAK. Sahibinin onayını bekliyor.** Metinler `seed/content/**` altında. `scripts/seed/content.ts` bunları **taslak** (draft) olarak yükler. Yayına alma, admin'de "Yayınla" ile yapılır.

Sayılar `src/lib/content/content.test.ts` ile aynı kuraldan üretildi (`wordCount`). Testler her kategori için şunları zorunlu tutar:
- Açıklama TR ve EN'de 300–600 kelime.
- En az 3 H2 ve hepsi soru cümlesi.
- Kısa açıklama tek cümle.
- 4–6 SSS.
- Yasaklı klişe ve uydurma iddia kalıbı yok: `N yıl/sene`, `TL/₺/€/$`, garanti, sertifika, ücretsiz, "yıllardır" / "onlarca yıl" / "decades", "eşsiz" vb.

## Kategori başına §7 kuralları

| Kategori | Kısa açıklama (kelime) | Giriş paragrafı (≤150) | Açıklama TR / EN (kelime) | H2 (soru) | SSS TR / EN | Uydurma iddia yok |
|---|---|---|---|---|---|---|
| Ahşap Yapılar | 18 | 29 | 315 / 385 | 4 | 5 / 5 | ✓ |
| Deck ve Zeminler | 16 | 28 | 317 / 416 | 4 | 6 / 6 | ✓ |
| Pergola ve Kamelyalar | 16 | 28 | 336 / 446 | 4 | 5 / 5 | ✓ |
| Korkuluk ve Çit | 19 | 28 | 332 / 407 | 4 | 5 / 5 | ✓ |
| Köprü ve İskele | 19 | 47 | 340 / 415 | 5 | 5 / 5 | ✓ |
| Merdivenler | 17 | 26 | 309 / 397 | 4 | 5 / 5 | ✓ |
| Çiçeklik ve Oturma Grubu | 16 | 39 | 319 / 410 | 4 | 5 / 5 | ✓ |
| Kapı, Dolap ve Seperatör | 19 | 39 | 325 / 410 | 5 | 5 / 5 | ✓ |
| İroko ve Teak | 18 | 37 | 354 / 424 | 5 | 6 / 6 | ✓ |
| Mobilya ve Cila | 18 | 32 | 311 / 398 | 5 | 5 / 5 | ✓ |
| Boya, Tamir ve Bakım | 17 | 33 | 309 / 392 | 4 | 6 / 6 | ✓ |

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
- **Thermowood ve kompozit kategori metinlerinde yok.** Ne eski sitede ne fotoğraf etiketlerinde geçiyor. Thermowood yalnızca "Ahşap türleri" rehberinde (#49) genel bilgi olarak anlatılıyor; firmanın thermowood işi yaptığı söylenmiyor.

## Sahibinin onaylaması gereken cümleler

Genel bilgi ya da fotoğraf etiketlerinden çıkarım. Yanlışsa düzeltilmeli veya silinmeli.

**Bakım aralıkları (genel bilgi, firmaya özgü değil)**
1. Deck: "yılda en az bir kez yıkamak … yağla beslemek", "Genellikle yılda bir kez yeterlidir."
2. İroko/Teak: "yılda bir ya da iki kez yıkayıp … yağ sürmek yeterlidir."
3. Ahşap Yapılar: "Genellikle birkaç yılda bir yapılan zımpara ve boya ile…"
4. Boya, Tamir ve Bakım: "Deck gibi yatay yüzeyler genellikle yılda bir yağ ister." Ayrıca bakım mevsimi olarak ilkbahar ve sonbahar öneriliyor.
5. Köprü ve İskele: "Bağlantı cıvatalarını ve korkuluk dikmelerini her sezon kontrol etmek gerekir."

**Malzeme ve yöntem**

6. İroko/Teak: "maliyeti genellikle daha düşüktür", "Teak, tekne güvertelerinde … geleneksel olarak kullanılan ağaçtır", "emprenye gibi bir ön işleme gerek duymadan". Bunlar genel bilgi.
7. Köprü ve İskele: kavisli kirişlerin "ince ahşap katmanları tutkallayıp kalıp üzerinde presleyerek" yapıldığı yazıyor. Kaynak, kavisli kirişin tutkallandığını gösteren bir fotoğraf başlığı. Yöntem doğru mu?
8. Köprü ve İskele: "Suyun içine inen ayaklarda … beton ya da metal taşıyıcılar da kullanılabilir."
9. Çiçeklik: iç yüzeyin "bir astar ya da örtüyle" kaplandığı, tabanda tahliye deliği bırakıldığı ve kasanın yükseltildiği yazıyor. Uygulamanız böyle mi?
10. Metal kasa (kaynak: metal kasalı ve sürgülü kapı fotoğrafları):
    - Kapı/Dolap gövdesi: "Geniş kapı kanatlarında ahşabı metal bir kasayla taşımak…"
    - Kapı/Dolap SSS: "Geniş ya da sürgülü kapılarda taşıyıcı metal bir kasa, görünen yüz ahşap çıta olabilir."
    - Korkuluk ve Çit SSS: "Geniş kapılarda kanat metal bir kasayla güçlendirilebilir."
11. Mobilya: "gövde ve iç bölmelerde … levha malzemeler kullanılabilir". Fotoğraf etiketlerinde yalnızca meşe var.
12. Ahşap Yapılar: "OSB gibi levhalardan da yararlanılabilir". Fotoğraf etiketinden alındı.
13. Merdivenler (SSS): "İstenirse basamak yüzeyine kaydırmaz detaylar eklenebilir." Bu hizmeti veriyor musunuz?
14. Klima kasası (SSS): "servis için de kapak ya da sökülebilir panel bırakılır."
15. Atölye adımları (iş akışı doğru mu?):
    - Deck, adım 3: "gerekirse ilk koruyucu kat burada uygulanır."
    - İroko ve Teak, adım 3: "ilk yağ katı uygulanır"; adım 4: "son yağlama yapılır."
    - Mobilya, adım 3: "boya ve cilası atölyede uygulanır."

**Hizmet kapsamı**

16. Ahşap Yapılar: "WC ve duş kabini", "köpek kulübeleri" (fotoğraf başlıkları) ve "Türkiye'nin farklı yerlerinde de çalışıyoruz". Hakkımızda: "yurt dışında, Libya'da da çalıştık" (PRODUCT.md).
17. Mobilya: "Toplantı masaları ve yönetici ofisi mobilyaları", "Tekne kamaraları için çalışma masası, konsol ve dolaplar". Kaynak fotoğraf başlıkları.
18. Hakkımızda: "Murat Şen, marangoz babasının yanında ahşapla büyüdü ve gençliğinde mesleği tam zamanlı sürdürmeye başladı" ve "Zanaatımız iki kuşaktır aynı ailenin elinde." Kaynak decisions #63; kesin yıl bilerek yazılmadı.
19. İletişim: "Mesajınızı aldıktan sonra işi sizinle konuşuyor, uygun bir günde yeri görmeye geliyoruz." Keşif ücretli mi ücretsiz mi bilinmediği için bundan hiç bahsedilmedi.
20. Firmanın çalışma alışkanlığı (fotoğraflardan çıkarım): "Çoğu işte deck'i korkuluk, merdiven ya da çiçeklikle birlikte tamamlıyoruz" (Deck); "Merdiven çoğu zaman bir deck, teras ya da çit işinin parçası olarak geliyor" ve "çoğu işte merdiveni deck, teras ya da çit ile birlikte yapıyoruz" (Merdivenler); "çoğu zaman bir deck ya da teras işiyle birlikte" (Çiçeklik).

## Açık sorular

- **Beton temel:** Ahşap Yapılar'da "Temel ya da zemin hazırlığının ardından yapı yerinde kurulur" (adım 4) ve "beton ya da taş bir temelin veya ayakların üzerine kurulur" (SSS) yazıyor. Beton temeli firma kendisi mi yapıyor, yoksa müşteri ya da başka bir usta mı hazırlıyor?
- **"Seperatör" yazımı:** eski sitedeki kategori adı ve metinler "Seperatör" diyor. Standart yazım "separatör" olabilir (TDK'den teyit edilmeli). Kategori adı ve metinler hangisiyle kalsın? (Slug `kapi-dolap-ve-seperator` eski URL olduğu için değişmez.)
- **Eski Hizmetlerimiz sayfasındaki bağlantılar** büyük olasılıkla yanlış:
  - "Gazebo" Boya, Tamir ve Bakım'a gidiyor.
  - "Garaj ve Garaj Kapıları" ile "Dış Cephe Ahşap Kaplama" Pergola'ya gidiyor.

  Metinlerde cephe kaplaması Ahşap Yapılar'a, bahçe kapıları Kapı, Dolap ve Seperatör ile Korkuluk ve Çit'e yazıldı. Garaj kapısı hiçbir metinde yok. Garaj kapısı yapılıyor mu?

## Rehberler (#49)

Dört rehber (`seed/content/guides/*.json`) taslak olarak yüklenir. Sahibin onaylaması gerekenler:

1. **Yazar adı:** Rehberlerin altında "Murat Şen · Kurucu ve usta" yazsın mı? Her rehberde "Yazar kutusunu göster" kutusu varsayılan olarak kapalıdır; onay gelince açılır.
2. **Yayın sırası:** "İroko mu teak mi?" ve "Pergola fiyatını ne belirler?" rehberleri "Ahşap türleri" rehberine bağlantı veriyor. Yayınlanmamış rehbere giden bağlantı sitede düz metin olarak görünür; dördünü birlikte yayınlamak en temizi.
3. **Ahşap türleri tablosu:** tür listesi (sedir, sarıçam, ladin, iroko, teak, meşe, meranti, sapelli) ve yoğunluklar eski sitedeki tablodan alındı, "kaynaklardaki yaklaşık değer" diye sunuluyor. "Dış mekânda" sütunu (Evet / Emprenye ile / Kısmen) genel bilgidir. Hiç çalışmadığınız türler tablodan çıkarılsın mı?
4. **Thermowood satırı** eski tabloda yoktu; genel bilgi olarak eklendi ("toprakla temas etmeyen yerlerde", "daha kırılgandır").
5. **Yağlama aralığı:** "Yağlama aralığını kullanılan ürün ve yüzeyin aldığı güneş belirler; çoğu üretici güneş alan zeminlerde yılda bir ya da iki kat önerir." Uygulamanızla uyumlu mu?
6. **Deck bakımı:** "deckte vernik gibi film oluşturan katlar genellikle önerilmez", "iroko ve teak deckler genellikle boyanmaz, yağlanır", "yüksek basınçlı yıkama makinesini yakından tutmayın". Doğru mu?
7. **Deck tahtası bağlantısı:** "vidayla ya da gizli klipsle tutturulur" yazıyor. Siz hangisini kullanıyorsunuz?
8. **Başka firmaların işleri:** "Kendi yaptığımız ya da başka firmaların döşediği decklerin bakımını ve onarımını yapıyoruz." (Deck kategorisindeki cümleyle aynı.) Doğru mu?
9. **Pergola rehberi:** fiyat yok, yalnızca etkenler var. Tente, şeffaf örtü ve oluk hizmet olarak değil, "ahşap dışı parçalar ayrı malzeme ve uygulama gerektirir" diye anlatılıyor. Bunları siz de yapıyor musunuz, yoksa başka bir ustaya mı yönlendiriyorsunuz?
10. **Pergola SSS:** "Pergolaya sonradan çatı çoğu zaman eklenebilir, ama kirişlerin ek yükü taşıyıp taşımayacağına bakmak gerekir." Doğru mu?
11. **EN metinler** ilk çeviridir; bir İngilizce okurun gözden geçirmesi iyi olur.

## Notlar

- **Referanslar:** 9 referans, PRODUCT.md ve decisions.md'deki yazımla yüklenir ("Kemer Golf & Country Club", "Nurol A.Ş.", "İBB Sosyal Tesisler", "İGK"). Tek kaynak `seed/content/references.json`. Yükleme yalnızca koleksiyon boşken yapılır; dolu bir koleksiyona hiç dokunulmaz.
- **EN marka adı:** EN metinlerde "Kefken Ahşap Dekorasyon" çevrilmeden kullanılır. siteSettings'in EN açıklaması #96'da düzeltiliyor.
- **İletişim sayfasında** adres, telefon ve e-posta yok. Bunlar siteSettings'ten render edilir; aynı bilgiyi iki yerde tutmamak için gövdeye yazılmadı. Çalışma saatleri bilinmediği için onlar da yazılmadı.
- **SEO alanları** (`seo.title` / `seo.description`) bu geçişte doldurulmadı.
