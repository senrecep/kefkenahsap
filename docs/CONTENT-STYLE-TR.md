# Türkçe içerik yazım rehberi

Sitedeki her metin bu kurallara göre yazılır: kategori açıklamaları, rehberler, SSS, görsel başlıkları ve alt metinleri, AI taslakları ve çevirileri. Kısacası sitede okunan her şey.

Diğer belgelerle ilişkisi:
- **AI prompt'ları** bu belgenin kısaltılmış hâlini taşır: `src/ai/prompts/turkish.ts` (`TURKISH_RULES`). Bir kural burada değişirse orası da güncellenir ve prompt'un sürüm sabiti artırılır. Ayrıntı: [AI-PROMPTS.md](AI-PROMPTS.md).
- **Sayfa yapısı ve SEO/GEO kuralları** [PLAN.md §7 "İçerik kuralları"](PLAN.md#7-seo--geo-geolyt-rubric--easyapp-website-envanterinden) içindedir. Aşağıdaki §2 yalnızca yazarın aklında tutması gerekenleri özetler.
- **Ürün sesi ve iddia kuralı** `PRODUCT.md`'dedir: rakam, yıl, sayı, fiyat ve müşteri yorumu yalnızca admin'deki gerçek veriden gelir.
- Seed içeriğinin otomatik kontrolleri: `src/lib/content/content.test.ts` (#34). Yasak listesi (§5) değişirse oradaki `BANNED` dizisi de güncellenir.

---

## 1. Ton

- Esnaf sıcaklığında, sade ve somut yazılır. Usta müşteriyle konuşur gibi yazar, broşür gibi yazmaz.
- Okura "siz" diye seslenilir. Firma kendinden "biz" diye söz eder; "firmamız" ve "şirketimiz" kullanılmaz.
- Kısa cümleler kurulur, bir cümlede bir bilgi verilir. Bir paragraf kendi başına okunduğunda da anlaşılır olmalıdır.
- Somut olan yazılır: ahşap türü, ölçü, yer, iş adımı. Sıfat yığını kullanılmaz ("sağlam, estetik, kaliteli, şık…").
- Bilinmeyen boş bırakılır. Emin olunmayan bilgi "olabilir" diye yumuşatılarak yazılmaz. "-abilir" yalnızca gerçekten koşula bağlı durumlarda kullanılır.

## 2. Yapı (özet; asıl kaynak PLAN §7)

- **Önce cevap verilir:** ilk paragraf sorunun cevabıdır ve 150 kelimeyi geçmez.
- **H2'ler soru cümlesidir** ("Deck'e hangi ahşap kullanılır?"). Her H2 bölümü tek başına alıntılandığında anlamlı olmalıdır.
- Karşılaştırmalar **tablo** ile yapılır (iroko / teak / çam / thermowood).
- Rehber ve kategori sayfasında **"Güncellendi: tarih"** görünür.
- Doldurma yapılmaz: ilçe listesi yığılmaz, anahtar kelime tekrar edilmez, gizli metin yazılmaz.
- Marka adı geçtiği her yerde aynı yazılır: **Kefken Ahşap Dekorasyon**, kısaca **Kefken Ahşap**. EN metinde de çevrilmez.

## 3. Türkçe karakter ve büyük harf

- Türkçe karakterler her yerde kullanılır: ç, ğ, ı, İ, ö, ş, ü. "Ahsap", "Kefken Ahsap" gibi ASCII yazımlar yalnızca URL ve dosya adında geçerlidir.
- **I/İ dönüşümüne dikkat edilir.** Küçük harfle "iroko" yazılan kelime cümle başında ve başlıkta "**İroko**" olur, "Iroko" değil. Aynı şekilde "ışık" kelimesinin büyüğü "Işık"tır. Kod içinde büyük harfe çevirirken `toLocaleUpperCase('tr')` kullanılır.
- Ahşap türleri cins isimdir ve cümle içinde küçük yazılır: iroko, teak, çam, meşe, thermowood. "ThermoWood®" yalnızca o marka kastediliyorsa yazılır. Büyük harf yalnızca cümle başında, başlıkta ve kategori adında kullanılır ("İroko ve Teak").
- Kişi ve kurum adları büyük harfle başlar: Murat Şen, İBB Sosyal Tesisler, Nurol A.Ş.
- **Ev kuralı: başlıklar cümle düzeninde yazılır** (TR ve EN). Yalnızca ilk kelime ve özel isimler büyük harfle başlar: "Ahşap deck bakımı nasıl yapılır?", "How do you maintain a timber deck?" Her kelimeyi büyük yazmak İngilizce başlık alışkanlığıdır.

## 4. Ekler ve kesme işareti

### 4.1 Özel isimler: kesme işareti zorunludur
| Doğru | Yanlış |
|---|---|
| İstanbul'da, Riva'daki, Arnavutköy'deki atölye | İstanbulda, Rivadaki |
| Kefken Ahşap'ın, Kefken Ahşap'a | Kefken Ahşapın, Kefken Ahşap 'a |
| Murat Şen'in | Murat Şenin |
| İBB'nin, İGK'ye (kısaltma, okunuşa göre ek) | İBB'in, İGK'ya |
| 2009'dan beri, 3'üncü kat | 2009 dan beri, 2009'den |

- Ek, kelimenin **okunuşuna** göre gelir (ünlü ve ünsüz uyumu): Kefken Ahşap'**ın**, Riva'**da**, Şile'**de**; kısaltmada harflerin okunuşu esas alınır: İGK ("i-ge-ke") → İGK'**ye**.
- Kesme işaretinden sonra boşluk bırakılmaz. Tipografik (’) ve düz (') kesme işaretinin ikisi de geçerlidir, ama bir metin içinde biri seçilir. Seed metinleri düz (') kullanır.

### 4.2 Cins isimler: ek bitişik yazılır
- Türkçede yazıldığı gibi okunan cins isimlere ek bitişik gelir: irokonun, çamın, pergolada, kamelyaya, korkuluğun. Okunuşu yazılışından farklı yabancı kelimeler için bkz. 4.3.
- Ünsüz yumuşaması uygulanır: korkuluk → korkuluğu, kapak → kapağı, ahşap → ahşabı, ahşabın.

### 4.3 Yazılışı okunuşundan farklı yabancı kelimeler (ev kuralı)
Yazılışı okunuşundan farklı yabancı cins isimlerde ek kesme işaretiyle ayrılır ve okunuşa göre seçilir. Seed metinleri (#34) bu kurala göre yazıldı:

| Kelime (okunuş) | Örnek |
|---|---|
| deck (dek) | deck'in, deck'i, deck'e, deck'imi; çoğulda kesme yok: deckler, decklerin |
| thermowood (termovud) | thermowood'un, thermowood'dan |
| teak (tik) | teak'in, teak'ten |

Bu bir ev kuralıdır ve TDK teyidi bekler; bkz. §9 Açık sorular. Kelime Türkçe karşılığıyla yazılabiliyorsa karşılığı tercih edilir ("deck zemini" yerine "ahşap zemin" bağlama uyuyorsa).

### 4.4 Sık yapılan ek hataları
- **"de/da" bağlacı ayrı, "-de/-da" hâl eki bitişik yazılır.** "Bahçede de kullanılır" doğrudur. Sınama yolu: kelimeyi çıkarınca cümle bozulmuyorsa bağlaçtır, ayrı yazılır.
- **"ki" bağlacı ayrı, "-ki" sıfat eki bitişik yazılır.** "Öyle sağlam ki…" ama "bahçedeki deck", "Riva'daki iş".
- **"-mi" soru eki her zaman ayrı yazılır**, kendinden sonraki ekler ona bitişir: "Teak mi daha dayanıklı?", "Uygun mudur?"
- Birim ile sayı arasında boşluk bırakılır: "20 m²", "4 cm". Birime ek gelirse kesme işareti kullanılır: "20 m²'lik deck".

## 5. Yasak ifadeler

Bu ifadeler hiçbir metinde kullanılmaz. Yıldızlı (*) olanlar admin'de teyitli bir veri varsa ve yalnızca o veriyle birlikte yazılabilir.

**Klişeler:** eşsiz, benzersiz, mükemmel, kusursuz, hayallerinizdeki, kaliteden ödün vermeden, en iyi hizmet, müşteri memnuniyeti odaklı, profesyonel çözümler, uzman ekibimiz, alanında lider, son teknoloji, A'dan Z'ye, yaşam alanlarınıza değer katın, fark yaratan, ayrıcalıklı, firmamız, şirketimiz.

**Uydurma iddia riski taşıyanlar:**
- yıllardır, onlarca yıl, otuz yıl, "X yıllık tecrübe"* (yıl yalnızca `siteSettings.foundingYear` / `founder.craftStartYear` doluysa yazılır).
- "X'ten fazla proje"* (`siteSettings.projectCount`).
- garanti*, sertifika*, ücretsiz*, "Türkiye'nin en…", "İstanbul'un en…".
- **Fiyat:** TL, ₺, €, "m² fiyatı …". Fiyat yalnızca kategorinin `priceGuide` alanından ve tarihiyle gösterilir. Metinde fiyat soruları **fiyatı belirleyen etkenlerle** cevaplanır.
- Müşteri sözü (yalnızca `testimonial` + `consentGiven`).

**Eski siteden taşınmayacak içerik:** "Ağaçların yaşı nasıl belirlenir", yıllık halkalar ve dendrokronoloji bölümleri (karar #3, #57). Ahşap türleri tablosu taşınır, ama §7'deki doğruluk kurallarıyla.

## 6. Çeviri kokan yapılar ve düzeltmeleri

| Kaçın | Yerine | Not |
|---|---|---|
| Iroko yüksek dayanıklılığa **sahiptir**. | İroko dayanıklıdır. / İrokonun doğal dayanımı yüksektir. | "have" çevirisi |
| Ahşap koruma **sağlamaktadır**. | Ahşabı korur. | "-mektedir" yığını resmî ve yorucudur. Geniş zaman yeterlidir. |
| Montaj ekibimiz **tarafından** yapılır. | Montajı kendi ekibimiz yapar. | Edilgen + "tarafından", İngilizce passive çevirisidir. |
| Bu, deck'in ömrünü uzatmak **için önemlidir**. | Bu bakım deck'in ömrünü uzatır. | "It is important to…" |
| …dikkate **alınmalıdır** / göz önünde bulundurulmalıdır. | …dikkat edin. / …bakılır. | Doğrudan söyleyin. |
| Kamelyalar bahçeler **için ideal bir seçimdir**. | Kamelya bahçede gölgelik ve oturma yeri olur. | "ideal choice" |
| Su yüzeyde **boncuklanır**. | Su ahşaba işlemez, yüzeyde damla damla kalır. | "beading" kalkı (#34 incelemesi) |
| **Günün sonunda** önemli olan… | Sonuçta… / Kısacası… | "at the end of the day" |
| **Bir adet** pergola | bir pergola | "bir adet" yalnızca teklif ve fatura dilidir. |
| İroko, teak **olmak üzere** iki tür | İroko ve teak | "olmak üzere" tekrarı |
| **Son derece / oldukça / gerçekten** dayanıklı | dayanıklı (+ neden: "öz maddeleri sayesinde çürümeye dirençli") | Güçlendirici yerine gerekçe yazın. |
| Ahşap **yüzey bitirme** işlemi | son kat, cila, yağ, vernik (hangisiyse) | "finish" kalkı; somut işlemi adlandırın. |
| **…ile ilgili olarak** bilgi almak | …hakkında bilgi almak / …yı sormak | |
| **Fark yaratın**, **hayata geçirin** | yapalım, kuralım | reklam kalkı |

Kontrol yöntemi: cümleyi sesli okuyun. Usta telefonda bu cümleyi kurmazdı diyorsanız yeniden yazın.

## 7. Doğruluk: genel bilgi, uygulama ve iddia

#34 içerik incelemesinden çıkan kurallar:

1. **Uygulama, olgu gibi yazılmaz.** "Dış mekânda emprenyeli çam kullanılır" bir olgu cümlesidir ve yanlıştır. Doğrusu: "Dış mekânda genellikle emprenyeli çam kullanılır." Firmanın kendi yöntemi ("bu kurala göre çalışıyoruz", "kirişleri tutkallayıp presleriz") yalnızca firma teyit ettiyse yazılır. Teyit edilmemişse nötr anlatılır ("…önerilir", "…yaygındır") ya da hiç yazılmaz.
2. **Genel ahşap bilgisi, genel bilgi olarak sunulur:** "genellikle", "çoğu uygulamada", "kaynaklarda … olarak geçer". Kitap bilgisi firmanın ölçümüymüş gibi verilmez.
3. **Ahşap bilgisinde bilinen tuzaklar:**
   - **Çam sert ağaç değildir.** Çam iğne yapraklıdır ve yumuşak ağaç sınıfındadır. "Sert ağaç" (hardwood) iroko, teak, meşe gibi geniş yapraklılar için kullanılır.
   - **İroko ve teak'in dayanımı öz maddelerinden gelir.** Doğru ifade: "doğal dayanımı yüksek", "öz maddeleri sayesinde çürümeye ve böceğe dirençli". "Yağlı" sözü yalnızca teak için kullanılır: "teak ayrıca çok yağlıdır." İroko yağlı ağaç diye anlatılmaz.
   - **Emprenye bakım gerektirir.** Emprenye ahşabın içine işlenen koruyucudur. Yüzeydeki yağ, vernik veya boyanın yerini tutmaz, "bakım istemez" diye anlatılmaz.
   - **thermowood** ısıl işlemle boyutsal kararlılık kazanır, çürümeye dayanımı artar; buna karşılık daha kırılgandır, eğilme dayanımı düşer. Özgül ağırlık veya ömür gibi rakamlar kaynak gösterilmeden yazılmaz.
   - Bilimsel adlarda güncel ad kullanılır: iroko *Milicia excelsa* (eski sitedeki *Chlorophora excelsa* eski addır), teak *Tectona grandis*, sarıçam *Pinus sylvestris*.
4. **Rakam yalnızca kaynağıyla yazılır.** Eski site tablosundaki özgül ağırlık gibi değerler "yaklaşık, kaynaklarda verilen değer" diye sunulur. Firma ölçümü gibi gösterilmez.
5. **Sözü edilen hizmet gerçekten verilmeli.** "Garaj kapısı", "kaydırmaz basamak", "beton temel" gibi işler yalnızca firma yaptığını teyit ettiyse yazılır (bkz. `docs/content/CHECKLIST.md`).
6. **Zaman ifadesi yazılmaz.** "Bugün", "bu yıl", "son yıllarda" gibi ifadeler metin eskidiğinde yanlış olur. Tarih gerekiyorsa "Güncellendi" alanı kullanılır.

## 8. Terim sözlüğü (TR ↔ EN)

Çeviri ve iki dilli metinlerde bu karşılıklar kullanılır. Admin › AI Ayarları › Terim sözlüğü (`aiSettings.glossary`) bu tablodan doldurulur; admin'deki kayıt önceliklidir.

| TR | EN | Not |
|---|---|---|
| deck, ahşap zemin | deck, decking | Zemin malzemesine "decking", yapının kendisine "deck" denir. |
| deck tahtası | deck board | |
| kamelya | gazebo | "Camellia" değildir. |
| pergola | pergola | |
| çardak | arbour (gazebo değil) | Basit, açık yapı. |
| emprenye, emprenyeli | pressure-treated (timber) | "impregnated" kullanılmaz. |
| emprenyeli çam | pressure-treated pine | |
| iroko | iroko | TR'de cümle başında "İroko" yazılır. |
| teak | teak | TR'de "tik" de denir, sitede "teak" kullanılır. |
| thermowood, ısıl işlem görmüş ahşap | thermally modified timber (thermowood) | "ThermoWood®" bir ticari addır; yalnızca o marka kastediliyorsa yazılır. Genel anlatımda "thermally modified timber". |
| çam, sarıçam | pine, Scots pine | |
| meşe | oak | |
| sert ağaç / yumuşak ağaç | hardwood / softwood | Çam softwood'dur. |
| korkuluk | railing; balustrade | Teras/balkon korkuluğu "railing"; dikmeli merdiven veya balkon korkuluğunun tamamı "balustrade". Tutunulan üst parça "handrail" (küpeşte). |
| küpeşte | handrail | |
| çit | fence | |
| bahçe kapısı | garden gate | |
| seperatör (bölme) | partition, room divider | TR yazımı açık soru (§9). |
| cila | lacquer, polish (genel: finish) | varnish = vernik. Genel son kat için "finish". |
| vernik | varnish | |
| ahşap yağı | wood oil, decking oil | |
| boya | paint, stain | Ahşap rengini gösteren yarı saydam boya "stain"dir. |
| zımpara | sandpaper (malzeme), sanding (işlem) | |
| bakım | maintenance | |
| iskele (su kenarı) | jetty, pier | |
| iskele (yapı) | scaffolding | |
| köprü (bahçe) | (garden) footbridge | |
| merdiven / basamak | staircase / step, tread | |
| çiçeklik | planter | |
| oturma grubu | seating set | |
| kaplama (cephe) | cladding | |
| atölye | workshop | |
| keşif | site visit | |
| ölçü / teklif | measurement / quote | |
| imalat / montaj | fabrication / installation | |
| usta | craftsman, master carpenter | |

## 9. Açık sorular (sahip teyidi bekliyor)

- **Yabancı cins isimlerde kesme işareti (§4.3).** "deck'in" mi, "deckin" mi? Ev kuralı kesme işaretli yazımdır. TDK'nin güncel kuralıyla karşılaştırılmalı.
- **"Seperatör" mü, "separatör" mü?** Eski site "Seperatör" yazıyor. Slug `kapi-dolap-ve-seperator` değişmez; kategori adı ve metinler için karar bekleniyor (#34 CHECKLIST).
- **"mekân" mı, "mekan" mı?** Seed metinleri şapkalı "mekân" kullanıyor; şimdilik bu korunur.
