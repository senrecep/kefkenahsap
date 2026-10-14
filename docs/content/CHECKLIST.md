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
- **Teak ve thermowood için yakın çekim fotoğraf (#60):** rehberdeki "Ahşap numuneleri" bloğu şimdilik yalnızca iroko ve emprenyeli çamı gösteriyor, çünkü arşivde teak ya da thermowood fotoğrafı yok ve ahşap çizilmiyor (DESIGN.md). Her biri için filigransız, düz bir yüzeye yakından çekilmiş bir fotoğraf gönderilirse doku `scripts/wood-textures.ts` ile kırpılır, `src/lib/wood/samples.ts` içinde yolu girilir ve numune sayfada görünür; başka değişiklik gerekmez.

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

## Rehberler (#58)

Beş yeni rehber (`seed/content/guides/`) aynı yükleyiciyle taslak olarak yüklenir. TR gövdeler 550–800 kelime, her dilde 5 SSS. Fiyat yok. Metinlerdeki ahşap bilgisi genel bilgi olarak yazıldı ("genellikle", "kaynaklarda", "yaygındır"). Firmanın kendi yöntemi olarak yalnızca teyitli olanlar geçiyor: keşif, aynı ekiple imalat ve montaj, başka firmaların işlerine bakım ve onarım.

| Rehber (TR slug) | Gövde TR / EN (kelime) | Giriş TR | H2 | SSS |
|---|---|---|---|---|
| Thermowood nedir, nerede kullanılır? (`thermowood-nedir`) | 569 / 698 | 77 | 6 | 5 / 5 |
| Emprenyeli ahşap nedir? (`emprenyeli-ahsap-nedir`) | 570 / 697 | 66 | 7 | 5 / 5 |
| Korkuluk: ahşap mı metal mi? (`korkuluk-ahsap-mi-metal-mi`) | 552 / 693 | 78 | 6 | 5 / 5 |
| Havuz kenarı deck'i nasıl seçilir? (`havuz-kenari-deck`) | 571 / 719 | 75 | 6 | 5 / 5 |
| Pergola mı kamelya mı? (`pergola-mi-kamelya-mi`) | 560 / 737 | 86 | 7 | 5 / 5 |

Sahibin onaylaması gerekenler:

1. **Thermowood işi:** Rehber thermowood'u yalnızca genel bilgi olarak anlatıyor; firmanın thermowood ile çalıştığı yazmıyor. Thermowood ile iş yapıyor musunuz? Yapıyorsanız rehbere ve Deck kategorisine bir cümle eklenebilir.
2. **Thermowood deck:** "Deck'te genellikle yalnızca tahtalar thermowood olur, altındaki kirişler emprenyeli çamdır" ve "vidalamadan önce kılavuz delik açmak yaygındır" yazıyor. Doğru mu?
3. **Emprenye, kesilen uçlar:** "Kesilen uçlara ve deliklere uç koruyucu sürmek yaygındır." Siz de uyguluyor musunuz?
4. **Emprenye, bağlantı:** "Paslanmaz ya da galvanizli vida ve bağlantı parçaları tercih edilir" (emprenye, korkuluk ve havuz rehberlerinde). Kullandığınız vida ve cıvata bu mu?
5. **Emprenye, koruma düzeyi:** "Toprağa ya da suya girecek parçalar için bu kullanıma uygun olduğu belirtilen ürün seçilir" yazıyor; sınıf adı ya da numarası yazılmadı. Tedarikçinizin verdiği sınıfı yazmak ister misiniz?
6. **Metal korkuluk:** Rehber metal ve karma (metal dikme + ahşap küpeşte) korkuluğu yalnızca genel bilgi olarak anlatıyor; firmanın yaptığı yazmıyor. Metal ya da karma korkuluk yapıyor musunuz, yoksa yalnızca ahşap kısmını mı? (Proje taslağı "Balkon deck'i ve metal korkuluk" fotoğraflarındaki metal korkuluğu siz mi yaptınız?)
7. **Korkuluk yüksekliği:** Yükseklik ve dolgu aralığı için rakam yazılmadı, "yapının kullanımına ve ilgili yönetmeliğe göre belirlenir" deniyor. Bir ölçü yazılsın mı? Yazılacaksa kaynağı ne?
8. **Küpeşte ve dikme başı:** "Küpeştenin üstüne hafif bir eğim vermek ya da dikme başlarını eğimli kesmek suyun üstte durmasını önler." Uygulamanızla uyumlu mu?
9. **Havuz kenarı, oluklu tahta:** Oluklu deck tahtası genel bilgi olarak geçiyor ("tutunmayı artırabilir, ama düzenli fırçalanmaları gerekir"). Açık soru 13 (kaydırmaz detay) ile bağlantılı. Bunu kullanıyor musunuz?
10. **Havuz kenarı, sökülebilir bölüm:** "Havuzun teknik kapakları deck'in altında kalacaksa onlara ulaşmak için deck'te sökülebilir bir bölüm bırakmak gerekir." Böyle yapıyor musunuz?
11. **Havuz kenarı, yağ:** "Yağın havuz kenarında kullanıma uygun olduğunu ürünün talimatından kontrol edin." Havuz kenarında kullandığınız bir ürün türü varsa yazılabilir.
12. **Kamelya:** "Kamelyanın çatısı ahşap kaplama üzerine örtüyle yapılır", "Kamelya çoğu zaman kendi ahşap döşemesiyle birlikte yapılır; döşeme yerden yükseltilir." Doğru mu? Çatı örtüsünü (shingle vb.) ve oluğu siz mi yapıyorsunuz? (#49 soru 9 ile aynı.)
13. **Tanımlar:** Kamelya "kapalı çatılı, çoğu zaman bağımsız yapı", çardak "daha basit, açık, üzerine bitki sarılan yapı" diye anlatılıyor. Sizin ve müşterilerinizin kullandığı anlamla uyuşuyor mu?
14. **Yayın sırası:** Yeni rehberler birbirine ve #49 rehberlerine bağlantı veriyor (ör. Pergola mı kamelya mı? → Emprenyeli ahşap nedir?, Pergola fiyatını ne belirler?). Yayınlanmamış rehbere giden bağlantı düz metin görünür; birlikte yayınlamak en temizi.
15. **EN metinler** ilk geçiştir; bir İngilizce okurun gözden geçirmesi iyi olur.

## Notlar

- **Referanslar:** 9 referans, PRODUCT.md ve decisions.md'deki yazımla yüklenir ("Kemer Golf & Country Club", "Nurol A.Ş.", "İBB Sosyal Tesisler", "İGK"). Tek kaynak `seed/content/references.json`. Yükleme yalnızca koleksiyon boşken yapılır; dolu bir koleksiyona hiç dokunulmaz.
- **EN marka adı:** EN metinlerde "Kefken Ahşap Dekorasyon" çevrilmeden kullanılır. siteSettings'in EN açıklaması #96'da düzeltiliyor.
- **İletişim sayfasında** adres, telefon ve e-posta yok. Bunlar siteSettings'ten render edilir; aynı bilgiyi iki yerde tutmamak için gövdeye yazılmadı. Çalışma saatleri bilinmediği için onlar da yazılmadı.
- **SEO alanları** (`seo.title` / `seo.description`) bu geçişte doldurulmadı.

## Fiyat rehberi (#61): sahibinden bekleniyor

Fiyat aralıklarını yalnızca sahibi verebilir. Bu geçişte hiçbir fiyat yazılmadı ve her kategoride `priceGuide` boş. Alan boş kaldığı sürece sitede fiyat görünmez. #61, bu bilgiler gelmeden kapanamaz.

Her kategori için şunlar gerekiyor (admin › Kategoriler › "Fiyat rehberi"):
- **Birim** (`unit`): m², metre ya da adet.
- **En az** (`min`) ve **En çok** (`max`): bu birim başına fiyat aralığı.
- **Para birimi** (`currency`): TRY, EUR ya da USD.
- **Fiyat güncelleme tarihi** (`updatedAt`): fiyatın geçerli olduğu tarih. Sitede "Güncellendi" olarak görünür.
- İsteğe bağlı **Not** (`note`, TR/EN): aralığı neyin değiştirdiği, ör. "ahşap türüne ve zemine göre değişir".

| Kategori | Birim | En az | En çok | Para birimi | Tarih |
|---|---|---|---|---|---|
| Ahşap Yapılar | | | | | |
| Deck ve Zeminler | | | | | |
| Pergola ve Kamelyalar | | | | | |
| Korkuluk ve Çit | | | | | |
| Köprü ve İskele | | | | | |
| Merdivenler | | | | | |
| Çiçeklik ve Oturma Grubu | | | | | |
| Kapı, Dolap ve Seperatör | | | | | |
| İroko ve Teak | | | | | |
| Mobilya ve Cila | | | | | |
| Boya, Tamir ve Bakım | | | | | |

Bir kategoride tek bir aralık anlamlı değilse (ör. Mobilya ve Cila, Köprü ve İskele) o satır boş bırakılabilir. Boş satır sitede hiçbir şey göstermez.

## Proje taslakları (#61)

#33'teki 17 taslak projeye kısa bir hikâye (TR + EN) ve EN başlık eklendi. Kaynak `seed/content/project-stories.json`, yükleyici `scripts/seed/project-stories.ts`. Yükleyici yalnızca hiç yayınlanmamış taslaklarda ve yalnızca boş alanları doldurur. Yazdığı her şey taslaktır; tekrar çalıştırıldığında hiçbir şey yazmaz.

Hikâyeler yalnızca fotoğrafta görüneni anlatıyor: yapı, görünen malzeme ve renk, çevre. Konum, müşteri, ölçü, süre ve yıl yazılmadı; başlıklardaki yıllar (2014, 2016) fotoğrafın EXIF tarihinden geliyor. Ahşap türü hikâyelere yazılmadı. Aşağıdaki tahminler yalnızca bu listede duruyor; doğruysa admin'de "Ahşap türü" alanına girilebilir.

Her proje için sahibinden beklenenler: il/ilçe, yıl, ölçü ve süre, ahşap türü, son kat. Bunlar bilinmeden proje yayınlanabilir, ama alanlar boş kalır.

| # | Taslak (TR başlık) | Hikâye TR / EN (kelime) | Ahşap türü | Sahibine soru |
|---|---|---|---|---|
| 1 | Balkon deck'i ve metal korkuluk | 66 / 88 | iroko (görselden tahmin) | Metal korkuluğu siz mi yaptınız? Küpeşte ahşap mı? |
| 2 | Bahçede yükseltilmiş küçük deck platformu | 64 / 82 | tanımlanamadı (iroko ya da teak olabilir) | Platformlar taşınabilir mi, yere sabit mi? |
| 3 | Kapı önünde küçük bahçe deck'i | 63 / 92 | tanımlanamadı (bal rengi sert ağaç) | Fotoğraflar farklı evlerden görünüyor. Tek proje mi, ayrılsın mı? |
| 4 | Ahşap teras, korkuluk ve çatılı kamelya (2014) | 65 / 79 | emprenyeli çam (görselden tahmin) | 2014 işin yılı mı? Gölgeliklerin çatı kaplaması nedir? |
| 5 | Bahçe sınırında ahşap çit | 60 / 80 | emprenyeli çam (görselden tahmin) | Çit boyandı ya da yağlandı mı, yoksa ham mı bırakıldı? |
| 6 | Su kenarında ahşap yürüme yolu | 62 / 69 | emprenyeli çam (görselden tahmin) | Kurum ya da referans işi mi? Referansa bağlansın mı? |
| 7 | Çapraz korkuluklu ahşap dış merdiven (2016) | 65 / 96 | emprenyeli çam (görselden tahmin) | Birden fazla merdiven görünüyor (aynı site?). Tek proje mi? 2016 işin yılı mı? |
| 8 | Dış mekân ahşap dolapları | 68 / 77 | çam, koyu koruyucu katlı (görselden tahmin) | Yağmur borusunun yanındaki kutu klima kasası mı, dolap mı? |
| 9 | Terasta pergola, çıtalı duvar ve dış mutfak | 67 / 81 | deck: iroko (görselden tahmin); çıtalar tanımlanamadı | Metal çerçeveyi siz mi yaptınız? Çıtalar hangi ağaç? |
| 10 | Yarım daire ahşap oturma bankı | 73 / 105 | iroko (görselden tahmin) | Beton zemin sizin işiniz mi? |
| 11 | Ahşap yemek masası ve bank | 63 / 81 | iroko (görselden tahmin) | Takım kaç bank? Bahçe için mi yapıldı? |
| 12 | Beyaz mutfak dolapları | 62 / 77 | boyalı, tür görünmüyor | İki farklı mutfak görünüyor. Tek proje mi? Gövde ve kapak malzemesi nedir? |
| 13 | Ahşap tezgâhlı mutfak bar masası | 60 / 82 | tanımlanamadı (lamelli masif panel) | Tabla ve asma raf hangi ağaç? |
| 14 | Kapaklı ahşap dolap | 66 / 86 | tanımlanamadı | Yeni imalat mı, yenileme mi? Fotoğraflar işin öncesi mi? |
| 15 | Ofis resepsiyon bankosu ve çalışma alanı | 63 / 82 | tanımlanamadı (açık renkli lamelli panel) | Hangi parçalar sizin işiniz (banko, bölmeler, raflar, mutfak)? |
| 16 | Beyaz oymalı vitrin ve konsol | 63 / 81 | boyalı, tür görünmüyor | İmalat mı, boya ve patina yenilemesi mi? |
| 17 | Ahşap çıta kaplamalı ofis odası | 66 / 91 | tanımlanamadı | Çıtalar masif mi, kaplama mı? Dolaplar ve kalorifer kapağı da sizin mi? |

EN başlık ve hikâyeler ilk geçiştir. **Dikkat:** EN başlık doluyken proje yayınlanırsa EN sayfa da açılır (EN slug başlıktan üretilir; slug + başlık dolu olan dil yayında sayılır). Yayınlamadan önce EN metni gözden geçirin ya da EN başlığı ve hikâyeyi boşaltın.

Hikâyeler yalnızca görüneni anlatır: "yağlanmış" gibi son kat bilgisi yerine "parlak görünüyor" yazıldı. Gerçek son kat admin'deki "Finish / renk" alanına girilir.

## Kategori metinleri ve SSS (#61)

Kategori metinleri ve SSS #34'te yazıldı ve testler bunları her kategori için zorunlu tutuyor (300–600 kelime, soru H2'ler, 4–6 SSS). Yukarıdaki "Sahibinin onaylaması gereken cümleler" ve "Açık sorular" sahibine sorulan sorulardır, metin boşluğu değildir. Bu yüzden bu geçişte kategori metinlerine dokunulmadı. Sahibin cevapları gelince ilgili cümleler düzeltilecek ya da silinecek.

"Notlar"daki boş SEO alanları (`seo.title` / `seo.description`) bir boşluk değildir. Kategori sayfası boş `seo.title` için kategori adını, boş `seo.description` için kısa açıklamayı kullanır (`src/app/(frontend)/[locale]/[category]/page.tsx`). Bu yüzden bu alanlar da boş bırakıldı.

## RU ve DE arayüz metinleri (#64)

**Durum: İLK GEÇİŞ. Anadili Rusça ve Almanca olan birinin kontrolü gerekiyor.** `messages/ru/*.json` ve `messages/de/*.json` TR kaynaktan Claude ile lokalde çevrildi (OpenRouter kullanılmadı). §8 terim sözlüğüne göre:
- RU: deck → терраса / деревянный настил, kamelya → беседка, emprenyeli çam → сосна, пропитанная под давлением, thermowood → термодревесина, keşif → выезд на объект, teklif → расчёт. Okura "вы".
- DE: deck → Holzterrasse, kamelya → Gartenpavillon, emprenyeli çam → kesseldruckimprägnierte Kiefer, thermowood → Thermoholz, keşif → Besichtigung, teklif → Angebot. Okura "Sie". "usta" için "Meister" değil "Handwerker" yazıldı (Almanya'da Meister bir unvandır, uydurma iddia olur).
- Marka adı çevrilmedi: "Kefken Ahşap Dekorasyon".

Kontrol edilecekler:
1. Ana sayfa ahşap tablosu TR kaynağa sadık çevrildi. TR kaynakta iroko için "doğal yağı" yazıyor; §7.3'e göre iroko yağlı ağaç diye anlatılmamalı. TR düzeltilirse RU/DE/EN de düzeltilmeli.
2. Telefon örneği ve doğrulama Türkiye numarası istiyor (0532 …). Yurt dışından gelen RU/DE ziyaretçi +7/+49 numarasıyla formu gönderemez; WhatsApp çalışır. Ayrı karar.
3. KVKK ve çerez politikası taslak metinleri RU/DE'de İngilizce gösterilir (`lang="en"`). Hukukçu onaylı çeviri admin'de Sayfalar'a girilince o dil kendi metnini gösterir.
4. Kategori, proje, rehber, görsel başlık/alt metinleri RU/DE'de boş. Bir dil, o dilde en az bir kategori ad + slug ile yayınlanana kadar noindex kalır (PLAN §5.1). Admin'deki "AI ile çevir" RU/DE'yi de taslak olarak doldurur; yayından önce anadili kontrolü gerekir.
