# Görsel incelemesi: işaretli görseller, kapaklar ve hero

Bu rapor, sitedeki 568 fotoğrafın elle yapılan incelemesidir. Her fotoğrafa tek tek bakıldı. Veritabanında hiçbir şey değiştirilmedi. Öneriler yalnızca öneridir: uygulayıp uygulamamak sizin kararınız. Admin'den elle uygulayabilirsiniz. Onaylarsanız `recommendations.json` dosyasıyla bir betik de uygulayabilir.

Dosyalar:
- `recommendations.json`: makinenin okuyacağı öneriler. `seedKey`, veritabanındaki `media.seedKey` alanıyla aynıdır.
- `flagged-1…4.webp`: işaretli 59 görselin küçük önizlemeleri. Numaralar aşağıdaki tablodaki numaralarla aynı.
- `covers-1…2.webp`: önerilen kategori kapakları. `heroes-1.webp`: hero önerileri.

## Özet

- **İşaretli 59 görsel:** 9'u **kalsın**, 26'sı **taşınsın**, 24'ü **gizlensin**.
  - Gizlenecek 24 görselin 13'ü kopya. Aynı fotoğraf başka bir kategoride, doğru yerinde zaten var.
  - Gizlenecek 8 görselde ahşap iş görünmüyor. Bunların 7'si `mobilya-ve-cila`'daki ofis, banyo ve koridor fotoğrafları, biri metal gölgelik.
  - Kalan 3'ü konu dışı: dükkân tabelası, başka bir markanın tabelası ve şap zemin.
  - Taşınacakların hedefleri: Kapı, Dolap ve Seperatör 6, Mobilya ve Cila 6, Korkuluk ve Çit 5, Çiçeklik ve Oturma Grubu 5, Ahşap Yapılar 4.
- **Metin düzeltmesi:** 5 görselin başlık, alt metin veya açıklaması fotoğrafta görünenle uyuşmuyor. Düzeltilmiş TR/EN metin aşağıdaki tabloda.
  - Örnek: "sarmaşık teli" denmiş, fotoğrafta ahşap kafes var.
  - Örnek: "özel ölçüde üretilen" yazılmış, bu fotoğraftan görülemez.
  - Örnek: kapıların ahşap olduğu anlaşılmıyor ama metin "ahşap" diyor.
- **Genel not (başlık yazımı):** Seed metinlerindeki bütün başlıklar Her Kelimesi Büyük yazılmış ("Beyaz Boyalı Ahşap Dış Merdiven"). Yazım rehberi §3 başlıkların cümle düzeninde yazılmasını istiyor ("Beyaz boyalı ahşap dış merdiven"). Bu 568 başlığın hepsini etkiliyor. Toplu bir düzeltme ayrı bir iş olarak ele alınabilir. Bu rapordaki önerilen başlıklar cümle düzeninde yazıldı.
- **Kapaklar:** Kapak seçilmemiş kategorilerde site şu an en geniş fotoğrafı kullanıyor (`getCategoryPhotos`, genişliğe göre sıralar). Merdivenler'in kapağı bu yüzden şap zemin fotoğrafı, Korkuluk ve Çit'inki tarih damgalı bir fotoğraf. Her kategori için bir ya da iki kapak önerisi aşağıda. Kapak alanı herhangi bir görseli kabul ediyor, kategori sınırı yok.
- **Çözünürlük:** Birçok kategoride 1280 px'ten geniş, yatay ve konuyu iyi gösteren fotoğraf yok. Merdivenler, Köprü ve İskele, Mobilya ve Cila'da önerilen kapakların bir kısmı 960–1280 px. Bunlar tabloda belirtildi. İleride çekilecek yeni fotoğraflar bu açığı kapatır.
- **Filigran:** Fotoğrafların çoğunda ortada "kefkenahsap.com" filigranı var. Eski fotoğraflarda iki satırlı, kalın "kefken ahşap dekorasyon / www.kefkenahsap.com" filigranı ve kameranın tarih damgası da var. Ayrıntı "Filigran notları" bölümünde.

## İşaretli 59 görsel

"Kalsın": kategori doğru. "Taşınsın": başka bir kategoriye ait. "Gizlensin": yayından kaldırılsın; fotoğraf silinmez. Kopyalarda doğru kategorideki eş fotoğraf yayında kalır.

| # | Dosya | Şu anki kategori | Öneri | Gerekçe | Önerilen metin düzeltmesi |
|---|---|---|---|---|---|
| 1 | `12.webp` | Ahşap Yapılar | Gizlensin | Dükkân önündeki yazı tahtası ve tabela; bir hizmet örneği değil, arkada Kefken Ahşap afişi görünüyor. | — |
| 2 | `18301686_1512595868785007_8271455338534986310_n.webp` | Ahşap Yapılar | Gizlensin | Direkler ve çatı metal; fotoğrafta ahşap iş görünmüyor. Bu işi siz yaptıysanız Pergola ve Kamelyalar'a taşıyın. | — |
| 3 | `2-3.webp` | Ahşap Yapılar | Kalsın | Çatı kaplaması ve kiremit dizimi; ahşap yapı işinin çatı aşaması. Kapak için uygun değil. | — |
| 4 | `4.webp` | Ahşap Yapılar | Kalsın | Yatay çıtalı ahşap duvar kaplaması; Ahşap Yapılar kapsamında. | — |
| 5 | `21.webp` | Deck ve Zeminler | Gizlensin | Aynı fotoğraf zaten merdivenler/21.webp ve ahsap-yapilar/82.webp olarak var; kopya. | — |
| 6 | `30.webp` | Deck ve Zeminler | Gizlensin | Aynı fotoğraf zaten ahsap-yapilar/30.webp olarak var; kopya. | — |
| 7 | `32.webp` | Deck ve Zeminler | Gizlensin | Aynı fotoğraf zaten merdivenler/32.webp (ve ahsap-yapilar/80.webp) olarak var; kopya. | — |
| 8 | `8.webp` | Deck ve Zeminler | Taşınsın → Kapı, Dolap ve Seperatör | Gömme dolap; deck ile ilgisi yok. Aynı fotoğraf mobilya-ve-cila/8.webp olarak da var; orada kalabilir ya da gizlenebilir. | — |
| 9 | `WhatsApp Image 2026-08-07 at 17.59.56 (1).webp` | Deck ve Zeminler | Taşınsın → Korkuluk ve Çit | Ön planda ahşap çit ve çıtalı paravan var; zemin işi görünmüyor. | — |
| 10 | `WhatsApp Image 2026-08-07 at 17.59.58 (1).webp` | Deck ve Zeminler | Taşınsın → Çiçeklik ve Oturma Grubu | Yükseltilmiş ahşap bahçe yatakları (çiçeklik). | — |
| 11 | `WhatsApp Image 2026-08-07 at 18.00.35.webp` | Deck ve Zeminler | Taşınsın → Çiçeklik ve Oturma Grubu | Ateş çukuru çevresinde L biçimli ahşap oturma bankı. | — |
| 12 | `10926343_890180887693178_996297002468608749_o.webp` | Pergola ve Kamelyalar | Gizlensin | Aynı fotoğraf zaten korkuluk-ve-cit/14-1.webp olarak var; kopya. | — |
| 13 | `17190381_1441116925932902_657908285864852438_n.webp` | Pergola ve Kamelyalar | Kalsın | Kemerli ahşap kafes; bahçe kemeri olarak pergola grubuna en yakın iş. | — |
| 14 | `960082_672566669454602_219012458_n.webp` | Pergola ve Kamelyalar | Kalsın | Üst kirişli, kare kafesli ahşap paravan; pergola yan yüzü gibi duruyor. | — |
| 15 | `WhatsApp Image 2026-08-07 at 17.59.56 (3).webp` | Pergola ve Kamelyalar | Taşınsın → Korkuluk ve Çit | Teras duvarı üstünde çapraz çıtalı paravan; korkuluk/paravan işi, pergola görünmüyor. | — |
| 16 | `WhatsApp Image 2026-08-07 at 18.00.40.webp` | Pergola ve Kamelyalar | Kalsın | T biçimli ahşap direk sıraları; çardak ya da asma desteği olarak pergola grubunda kalabilir. Başlık "çardak" diyor ama fotoğrafta çardak yok; metin düzeltildi. Asma desteği olduğunu teyit ederseniz metne eklenebilir. | **Başlık:** Bahçede T biçimli ahşap direk sıraları / _Rows of T-shaped timber posts in a garden_<br>**Alt:** Bahçede sıra hâlinde dikilmiş yuvarlak ahşap direkler; üstlerinde yatay ahşap kollar var / _Rows of round timber posts set out in a garden, each topped with a horizontal timber cross-arm_<br>**Açıklama:** Bahçede sıra hâlinde dikilen T biçimli ahşap direkler. Yatay kollar yuvarlak direklerin üstüne bağlandı. / _T-shaped timber posts set out in rows in a garden, with horizontal arms fixed to the tops of round posts._ |
| 17 | `img3.webp` | Pergola ve Kamelyalar | Gizlensin | Aynı fotoğraf zaten kopru-ve-iskele/img3-1.webp olarak var; kopya. | — |
| 18 | `19.webp` | Korkuluk ve Çit | Gizlensin | Aynı fotoğraf zaten ahsap-yapilar/19.webp olarak var; kopya. | — |
| 19 | `27.webp` | Korkuluk ve Çit | Gizlensin | Aynı fotoğraf zaten kapi-dolap-ve-seperator/27.webp olarak var; kopya. | — |
| 20 | `34.webp` | Korkuluk ve Çit | Gizlensin | Aynı fotoğraf zaten kapi-dolap-ve-seperator/34.webp olarak var; kopya. | — |
| 21 | `38.webp` | Korkuluk ve Çit | Gizlensin | Aynı fotoğraf zaten ciceklik-ve-oturma-grubu/38.webp olarak var; kopya. | — |
| 22 | `62.webp` | Korkuluk ve Çit | Gizlensin | Aynı fotoğraf zaten ahsap-yapilar/62.webp olarak var; kopya. | — |
| 23 | `IMG_20150623_141949.jpg1_.webp` | Köprü ve İskele | Kalsın | Kavisli kirişin tutkallama aşaması; kavisli köprü imalatı olabilir, köprüye ait olduğunu teyit edin. Teyit yoksa gizleyin. | — |
| 24 | `img6.webp` | Köprü ve İskele | Kalsın | Köprü serisindeki (img1–img15) korkuluk direği montajı; imalat aşamasını gösteriyor. | — |
| 25 | `4-3.webp` | Merdivenler | Gizlensin | Aynı fotoğraf zaten deck-ve-zeminler/9-2.webp olarak var; kopya. | — |
| 26 | `IMG_20180523_164159.webp` | Merdivenler | Gizlensin | Kulübe içindeki şap zemin; merdiven yok, bitmemiş iş ve konu dışı. Şu an Merdivenler'in otomatik kapağı bu fotoğraf (en geniş görsel); gizlenince kapak değişir. | — |
| 27 | `WhatsApp Image 2026-08-07 at 18.00.05 (2).webp` | Merdivenler | Taşınsın → Korkuluk ve Çit | Beyaz bahçe kapısı; merdiven yok. Bahçe kapıları bu kategoride toplanıyor (örnek: korkuluk-ve-cit/14-1). | — |
| 28 | `37354501_2002494806461775_4855452479359287296_n.webp` | Çiçeklik ve Oturma Grubu | Taşınsın → Korkuluk ve Çit | Siyah çerçeveli, ahşap çıtalı bahçe kapısı; çiçeklik ya da oturma grubu değil. | — |
| 29 | `37416566_2002495076461748_1297389996692471808_n.webp` | Çiçeklik ve Oturma Grubu | Taşınsın → Korkuluk ve Çit | Aynı tip bahçe kapısının farklı bir fotoğrafı; bahçe kapısı. | — |
| 30 | `39243115_2051741308203791_98833588392296448_n.webp` | Çiçeklik ve Oturma Grubu | Taşınsın → Kapı, Dolap ve Seperatör | Klima dış ünitesi için ahşap kasa ve çıtalı panel; dolap/kasa işi. | — |
| 31 | `WhatsApp Image 2026-08-07 at 18.00.06 (2).webp` | Çiçeklik ve Oturma Grubu | Taşınsın → Kapı, Dolap ve Seperatör | Kapaklı uzun ahşap dolap; oturma işlevi fotoğraftan anlaşılmıyor. | — |
| 32 | `WhatsApp-Image-2021-04-30-at-20.41.53-1.webp` | Çiçeklik ve Oturma Grubu | Taşınsın → Mobilya ve Cila | Karo kaplı tekerlekli sehpa; mobilya. | — |
| 33 | `img1.webp` | Çiçeklik ve Oturma Grubu | Gizlensin | Aynı fotoğraf zaten kopru-ve-iskele/img1.webp olarak var; kopya. | — |
| 34 | `1-2.webp` | Kapı, Dolap ve Seperatör | Taşınsın → Mobilya ve Cila | Dış mekân yemek masası; mobilya. | — |
| 35 | `14088607_1234325203278743_4558274487196146018_n.webp` | Kapı, Dolap ve Seperatör | Taşınsın → Ahşap Yapılar | Bahçe deposu; Ahşap Yapılar'a ait. ahsap-yapilar/30.webp aynı deponun düşük çözünürlüklü kopyası; bu 2560 px'lik sürüm taşınınca o gizlenebilir. | — |
| 36 | `1476218_672566129454656_1898661068_n.webp` | Kapı, Dolap ve Seperatör | Taşınsın → Mobilya ve Cila | Şömine üstü ahşap kiriş ve konsollar; iç mekân ahşap işi, kapı/dolap değil. | — |
| 37 | `20264838_1593382434039683_318923615082542297_n.webp` | Kapı, Dolap ve Seperatör | Taşınsın → Mobilya ve Cila | Dekoratif ahşap duvar panosu; iç mekân ahşap işi. | — |
| 38 | `21-1.webp` | Kapı, Dolap ve Seperatör | Taşınsın → Ahşap Yapılar | Köpek kulübesi; küçük ahşap yapı. | — |
| 39 | `26169459_1762669607110964_7510602167361803329_n.webp` | Kapı, Dolap ve Seperatör | Taşınsın → Çiçeklik ve Oturma Grubu | Sarmaşık için duvara monte çıtalı panel; bitki işi. (Diğer sarmaşık kafesleriyle birlikte.) | — |
| 40 | `34.webp` | Kapı, Dolap ve Seperatör | Taşınsın → Mobilya ve Cila | Banyo küveti ön yüzüne ahşap çıta kaplama; iç mekân özel imalat. | — |
| 41 | `60823172_2490831890961395_4779172571692138496_n.webp` | Kapı, Dolap ve Seperatör | Gizlensin | Başka bir markanın logolu ışıklı tabelası; atölyede çekilmiş, hizmet kategorilerine uymuyor. | — |
| 42 | `67154201_2591747794203137_4497047160839208960_n.webp` | Kapı, Dolap ve Seperatör | Taşınsın → Ahşap Yapılar | Köpek kulübesi; küçük ahşap yapı. | — |
| 43 | `96.webp` | Kapı, Dolap ve Seperatör | Taşınsın → Ahşap Yapılar | Ahşap bahçe deposu ve önündeki zemin; depo öne çıkıyor. | — |
| 44 | `WhatsApp Image 2026-08-07 at 18.00.06 (3).webp` | Kapı, Dolap ve Seperatör | Kalsın | Ahşap pencere kepengi; kapı/kapak işi. Açıklamadaki "özel ölçüde üretilen" fotoğraftan görülmüyor, çıkarıldı. | **Açıklama:** Açık renk dış duvardaki pencereye takılan, siyah ferforje menteşeli çift kanatlı ahşap kepenk. / _Double-leaf wooden window shutters with black wrought-iron hinges, fitted to a window on a light exterior wall._ |
| 45 | `WhatsApp Image 2026-08-07 at 18.00.08.webp` | Kapı, Dolap ve Seperatör | Kalsın | Bahçe duşunun ahşap kapı kanatları ve çıtalı zemini; kapı işi görünüyor. | — |
| 46 | `WhatsApp Image 2026-08-07 at 18.00.09 (2).webp` | Kapı, Dolap ve Seperatör | Taşınsın → Mobilya ve Cila | Doğal kenarlı masif masa tablası; mobilya. | — |
| 47 | `WhatsApp-Image-2021-04-30-at-20.41.44-1-1.webp` | Kapı, Dolap ve Seperatör | Taşınsın → Çiçeklik ve Oturma Grubu | Duvara monte sarmaşık kafesi; bitki işi. Başlıktaki "sarmaşık teli" yanlış (tel değil ahşap kafes), boya iddiası fotoğraftan görülmüyor. | **Başlık:** Duvara monte ahşap sarmaşık kafesi / _Wall-mounted wooden climbing trellis_<br>**Açıklama:** Bahçe duvarına sabitlenen kare gözlü ahşap kafes. Sarmaşık kafese sarılarak yukarı çıkıyor. / _A square-grid wooden trellis fixed to a garden wall, with a climbing plant growing up it._ |
| 48 | `WhatsApp-Image-2021-04-30-at-20.41.44-2.webp` | Kapı, Dolap ve Seperatör | Taşınsın → Çiçeklik ve Oturma Grubu | Duvara monte sarmaşık kafesi; bitki işi. Başlıktaki "sarmaşık teli" yanlış: tel değil, ahşap kafes. | **Başlık:** Duvara monte ahşap sarmaşık kafesi / _Wall-mounted wooden climbing trellis_<br>**Açıklama:** Bahçe duvarına sabitlenen, dikey ve yatay çıtalardan oluşan ahşap sarmaşık kafesi. Bitki çıtaların arasından yukarı sarılıyor. / _A wooden trellis of vertical and horizontal battens fixed to a garden wall, with a plant climbing through it._ |
| 49 | `01cc3cf5-0ef5-4536-95fe-18afbb97874a.webp` | Mobilya ve Cila | Taşınsın → Kapı, Dolap ve Seperatör | Koridorda siyah kapılar ve kasalar; kapı işi. Kapıların ahşap olduğu fotoğraftan anlaşılmıyor, metinden "ahşap" ve "güçlü kontrast" çıkarıldı. Ahşap değilse gizleyin. | **Başlık:** Koridorda siyah kapılar ve kasalar / _Black doors and frames in a corridor_<br>**Alt:** Beyaz zeminli dar koridorda siyah kapılar ve kasalar, ortada ızgara paspas / _Narrow corridor with a white floor, black doors and frames, and a grate mat in the middle_<br>**Açıklama:** Koridordaki kapılar ve kasalar siyah. Zemin beyaz, duvarlarda mermer desenli kaplama var. / _The corridor doors and frames are black, with a white floor and marble-pattern wall cladding._ |
| 50 | `2b1c483d-c836-416b-8863-70d472616be3.webp` | Mobilya ve Cila | Gizlensin | Mutfak ve tavan genel görünümü; ahşap iş seçilemiyor, düşük ışık. | — |
| 51 | `435e02ca-f074-4bfc-aa47-bb26d41d8406.webp` | Mobilya ve Cila | Gizlensin | Banyo (ayna, mermer tezgâh, cam duşakabin); fotoğrafta ahşap iş yok. | — |
| 52 | `4747c67c-fd27-420e-832f-e000a0c21295.webp` | Mobilya ve Cila | Gizlensin | Açık ofis masaları ve kumaş paravanlar; ahşap iş görünmüyor. | — |
| 53 | `68046448-0b1b-46b1-9b9f-d6bd172e5836.webp` | Mobilya ve Cila | Gizlensin | Ofis girişi, cam kapı ve başka bir markanın ışıklı tabelası; ahşap iş görünmüyor. | — |
| 54 | `714d8202-2479-4eac-a30b-4a450a35ab9d.webp` | Mobilya ve Cila | Gizlensin | Bronz ayna kaplı koridor; ahşap iş yok (mevcut açıklama da bunu söylüyor). | — |
| 55 | `88e6f349-d742-4616-91c9-595feb7c3eb6.webp` | Mobilya ve Cila | Gizlensin | Ofis masası ve kumaş duvar paneli; ahşap iş görünmüyor. | — |
| 56 | `9b2a2584-7efd-461c-a74c-2d2311204f19.webp` | Mobilya ve Cila | Taşınsın → Kapı, Dolap ve Seperatör | Yıldız motifli oymalı çift kanatlı ahşap kapı; kapı işi. | — |
| 57 | `bf36a488-dd2a-4fdb-97e3-291f7da4880f.webp` | Mobilya ve Cila | Gizlensin | Siyah çerçeveli füme cam kapı; ahşap iş görünmüyor. | — |
| 58 | `c3193239-90d7-4b67-9ed8-12b0e54ef0a3.webp` | Mobilya ve Cila | Taşınsın → Kapı, Dolap ve Seperatör | Cam bölme ve yanındaki dikey çıtalı panel; seperatör/bölme işi. | — |
| 59 | `WhatsApp-Image-2021-04-30-at-20.41.55-2-1.webp` | Boya, Tamir ve Bakım | Gizlensin | Aynı fotoğraf zaten ireko-teak/WhatsApp-Image-2021-06-27-at-20.13.42-3.webp olarak var; kopya. | — |

**Taşıma ve gizlemeyle ilgili notlar**
- #26 (şap zemin) gizlenirse veya Merdivenler'e kapak seçilirse, Merdivenler'in otomatik kapağı değişir.
- #35 (2560 px bahçe deposu) Ahşap Yapılar'a taşınırsa `ahsap-yapilar/30.webp` aynı deponun düşük çözünürlüklü kopyası olarak kalır. O fotoğraf işaretli değil, ama gizlenebilir.
- #8'in eşi `mobilya-ve-cila/8.webp` de bir gömme dolap. Taşıma yapılırsa o da Kapı, Dolap ve Seperatör'e alınabilir.
- 3 kararda sizin teyidiniz gerekiyor: #2 (metal gölgeliği siz mi yaptınız?), #23 (kavisli kiriş köprüye mi ait?), #49 (kapılar ahşap mı?). Gerekçe sütununda belirtildi.
- İşaretli olmayan fotoğraflarda da kategoriler arası kopyalar var. Örnek: `deck-ve-zeminler` ile `ireko-teak` arasında 10'dan fazla aynı fotoğraf. Bu raporun kapsamı dışında, ama aynı fotoğraf iki galeride görünüyor.

## Kategori kapak önerileri

Her kategoride en geniş 15–25 yatay fotoğrafa bakıldı (1280 px ve üstü önce, yetmezse 960 px ve üstü). İlk sıradaki asıl öneri, ikincisi yedek. "Filigran konunun üstünde mi" sütunu, kapakta kırpıldığında filigranın işin tam üstüne düşüp düşmediğini söyler.

| Kategori | Öneri | Boyut | Ne gösteriyor | Filigran konunun üstünde mi |
|---|---|---|---|---|
| Ahşap Yapılar | `965846_672567792787823_2038390235_o.webp` | 1746×1146 | Kütük ahşap ev, sundurma ve çatı makasları | Evet, tek satır, sundurmanın ortasında |
| | `55-1.webp` | 1030×773 | Çimenlik bahçede bitmiş ahşap ev | Evet, iki satır, kalın |
| Deck ve Zeminler | `IMG_20180503_114721.jpg1_.webp` | 2560×1920 | Çimen üstünde deck, saksılar ve oturma | Evet ama soluk |
| | `IMG_20180604_164216.jpg1_.webp` | 2560×1920 | Bahçede yeni döşenmiş deck | Evet ama soluk; sağ altta hortum makarası var |
| Pergola ve Kamelyalar | `251820_406039149440690_716310992_n.webp` | 2000×1500 | Deniz kenarında deck üstünde pergola | Evet, iki filigran üst üste, merdivenin üstünde |
| | `598608_406038439440761_1961507705_n.webp` | 2000×1500 | Deck üstünde iki gölgelikli pergola | Evet, tek satır, ortada |
| Korkuluk ve Çit | `WhatsApp Image 2026-08-07 at 17.59.57 (2).webp` | 1600×1204 | Taş duvar üstünde beyaz ahşap çit ve bahçe kapısı | Çok soluk |
| | `11-1.jpg1_-1.webp` | 2048×1536 | Oyun alanını çevreleyen dikey çıtalı çit | Evet, iki satır, kalın |
| Köprü ve İskele | `img10.webp` | 1024×768 (1280 altı) | Kemerli ahşap bahçe köprüsü | Soluk, sağ üstte |
| | `img11.webp` | 2048×1536 | Göl kenarında korkuluklu ahşap yürüyüş yolu | Evet, iki satır, kalın |
| Merdivenler | `31.webp` | 1024×768 (1280 altı) | Bahçede kıvrılan ahşap dış merdiven | Evet, merdivenin ortasında |
| | `17-1.webp` | 1030×773 (1280 altı) | Taş basamaklı bahçe merdiveninde ahşap korkuluk | Evet, ortada |
| Çiçeklik ve Oturma Grubu | `36040198_1957699650941291_1402449926159335424_n.webp` | 2560×1920 | Tek, yağlı ahşap çiçeklik | Soluk |
| | `34411599_1929538933757363_3219014968296865792_n.webp` | 2560×1920 | Yol kenarında sıra çiçeklikler | Soluk |
| Kapı, Dolap ve Seperatör | `102.webp` | 2560×1440 | Bahçede kapaklı ahşap dolap | Soluk |
| | `26165828_1750114745033117_4637695302055954385_n.webp` | 2560×1440 | Terasta yatay çıtalı seperatör ve kutu | Soluk |
| İroko ve Teak | `WhatsApp-Image-2021-06-27-at-20.13.46-2-1.webp` | 1600×1200 | Ağaç çevresinde ahşap deck | Evet, ortada, orta kalınlıkta |
| | `WhatsApp-Image-2021-06-08-at-23.27.44-3-1.webp` | 1600×737 | Kavisli ahşap oturma bankı | Evet, bankın üstünde |
| Mobilya ve Cila | `a188e2ac-749e-4bcf-b867-3562130102b5.webp` | 1080×608 (1280 altı) | Cilalı, oymalı konsol | Soluk, ortada |
| | `86fb075e-3647-40dc-b134-6ddc810b04ae.webp` | 960×720 (1280 altı) | Ahşap masalı ve raflı yönetici ofisi | Soluk |
| Boya, Tamir ve Bakım | `10426910_890180967693170_7525110688328373046_n-1.webp` | 960×720 (1280 altı) | Deck'in basınçlı suyla temizlenmesi | Evet, deck'in üstünde |
| | `DSC_0296.webp` | 2560×1440 | Bakımı yapılmış kütük ev balkonu | Soluk, üstte |

- **İnceleme belgesindeki üç kapak sorunu:**
  - Ahşap Yapılar'ın çatı fotoğrafının yerine kütük ev önerildi.
  - Mobilya ve Cila'nın buzdolaplı mutfak fotoğrafının yerine (`mobilya-ve-cila/2.webp`) cilalı konsol önerildi.
  - Merdivenler'in şap zemin fotoğrafının yerine kıvrılan bahçe merdiveni önerildi.
- Merdivenler için başka bir seçenek de var: `merdivenler/21.webp`. Kütük evin dış merdivenini gösteriyor. Aynı fotoğraf `deck-ve-zeminler/21.webp` olarak da var, o kopyanın gizlenmesi önerildi.

## Ana sayfa hero önerileri

Ölçütler: yatay, yüksek çözünürlük, dış mekân işi, sol alt köşe metin için sakin, alt %40'ta filigran yok. Her adayın alt %40'ı ayrıca büyütülüp kontrol edildi.

| Sıra | Görsel | Boyut | Neden |
|---|---|---|---|
| 1 | `ciceklik-ve-oturma-grubu/IMG_20180601_103750.webp` | 3264×2448 | Boğaz manzaralı terasta ahşap zemin ve ahşap çiçeklikler. Sol alt düz zemin tahtası. Filigran ortada (yaklaşık %50 yükseklikte), alt %40'ın dışında. |
| 2 | `deck-ve-zeminler/IMG_20180503_114721.jpg1_.webp` | 2560×1920 | Bahçede deck, çiçekli saksılar, sandalyeler. Alt kısım çimen. Filigran ortada ve soluk. |
| 3 | `pergola-ve-kamelyalar/251820_406039149440690_716310992_n.webp` | 2000×1500 | Palmiyeler arasında pergola ve deck. Alt kısım açık renk deck tahtası. Filigran yaklaşık %50 yükseklikte, alt %40'ın dışında. |

Yedek: `deck-ve-zeminler/IMG_20180604_164216.jpg1_.webp` (2560×1920). Sol alt sakin, ama sağ altta hortum ve makara var.

## Filigran notları

Öne çıkan alanlarda (hero, kapak, öne çıkan galeri) şu fotoğraflardan kaçının:

- **Kameranın tarih/saat damgası (kırmızı/sarı rakamlar):**
  - `korkuluk-ve-cit/50.webp`: sağ altta "2006/12/02". Şu an Korkuluk ve Çit'in otomatik kapağı bu.
  - `pergola-ve-kamelyalar/46.webp`, `korkuluk-ve-cit/51.webp`, `deck-ve-zeminler/17.webp`: sağ altta saat damgası.
- **İki satırlı, kalın filigran ("kefken ahşap dekorasyon / www.kefkenahsap.com") işin tam üstünde.** Eski 1030 px'lik seride çok yaygın.
  - Örnekler: `ahsap-yapilar/52.webp`, `54.webp`, `55-1.webp`, `56.webp`, `57.webp`; `pergola-ve-kamelyalar/47-1.webp`, `48-1.webp`, `49-1.webp`, `51-1.webp`; `korkuluk-ve-cit/11-1.jpg1_-1.webp`; `kopru-ve-iskele/img11.webp`, `img13.webp`, `img14.webp`, `img15.webp`; `deck-ve-zeminler/12.webp`, `15.webp`, `25.webp`.
  - Bunlardan biri kapak olacaksa kırpma filigranı kesmez, çünkü filigran ortadadır.
- **Üst üste iki filigran:** `pergola-ve-kamelyalar/251820_…` (kapak önerisi), `pergola-ve-kamelyalar/IMG_20180408_071129.webp` (en geniş kamelya fotoğrafı). Hero'da sorun değil, çünkü ikisi de alt %40'ın dışında. Kapakta görünür.
- **Başka marka:** `kapi-dolap-ve-seperator/60823172_…` (#41) ve `mobilya-ve-cila/68046448_…` (#53) başka firmaların logosunu gösteriyor. İkisinin de gizlenmesi önerildi.
- Soluk, tek satırlı "kefkenahsap.com" filigranı (2018 ve sonrası telefon fotoğrafları, WhatsApp serisi) çoğu yerde kabul edilebilir.
- Filigransız orijinaller varsa, öne çıkan alanlar için onları yüklemek en temiz çözüm.
