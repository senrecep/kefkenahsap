# Malzeme ve teklif hesaplayıcı: analiz ve plan

- Tarih: 2026-10-19 (analiz), aynı gün sahip kararlarıyla güncellendi
- Kaynak: `senrecep/wood-material-calculator` (son commit `d174fd0`), canlı adresler `/calculator-v1` ve `/calculator-v2`
- Hedef: kefkenahsap.com içinde, 5 dilde (tr, en, ru, de, ar), herkese açık "Malzeme ve teklif hesaplayıcı" sayfası
- Durum: **sahip onayladı (2026-10-19)**, uygulama #233 (`feat/233-malzeme-hesaplayici`)
- Canlı davranış testi Playwright 1.58 + Chromium ile yapıldı (eski uygulama ekran görüntüleri analiz oturumunda kaldı).

---

## 0. Kapsam kararı

`docs/PLAN.md` §2 "fiyat hesaplayıcı"yı kapsam dışı sayıyordu. Sahip 2026-10-19'da aracı kapsama aldı; PLAN.md güncellendi. Ayrım:

- Kefken'in kendi ürün fiyatı **yoktur**; sayfada hiçbir varsayılan fiyat gösterilmez.
- Fiyatı **kullanıcı girer**; araç bir **tahmin** verir ("Sonuçlar tahminidir; kesin fiyat için keşif gerekir.").

Bu, "fiyat uydurma, fiyatlar yalnızca CMS'ten gelir" kuralıyla uyumludur.

---

## 1. Ürün kapsamı (sahip kararları, 2026-10-19)

### 1.1 Bölüm 1: Kereste
- Satır: kalınlık × en × boy, adet, fiyat (₺/m³). Her ölçü için **birim seçici** (mm / cm / m, varsayılan cm); birim sütun başına seçilir, değiştirmek sayıları dönüştürmez, yeniden yorumlar.
- Adet pozitif tamsayı (1–100 000). Ölçü > 0 ve ≤ 20 m. Fiyat isteğe bağlı (boşsa satır yalnız m³ verir).
- **Fire %** (isteğe bağlı, varsayılan 0, 0–100): kereste hacmine ve kereste tutarına eklenir; özette ayrı satırdır.
- Satır ekle, çoğalt, sil (en çok 50).
- Boy 30 cm'den kısaysa (birim m değilken) engellemeyen uyarı: "Metre olarak mı girdiniz?"

### 1.2 Bölüm 2: Ek kalemler
- Satır: açıklama, miktar (ondalık olabilir), birim (adet, kutu, litre, kg, m², m³, metre, saat, götürü), birim fiyat (₺).
- **Götürü**: miktar sabit 1.
- Sık kullanılan kalemler cihazda hatırlanır (`localStorage`, en çok 50, en son kullanılan önce). Yazarken öneri (`<datalist>`); hatırlanan bir kalem seçilince birimi ve son fiyatı (fiyat boşsa) dolar.

### 1.3 KDV ve toplamlar
- Girilen fiyatlar **KDV hariç**. "KDV ekle" anahtarı (varsayılan açık), oran 20 / 10 / 1 / 0 (varsayılan 20).
- Özet: kereste hacmi → kereste tutarı → fire → ek kalemler → **ara toplam** → KDV → **genel toplam**.

### 1.4 Teklif bilgileri (isteğe bağlı)
- Müşteri adı, iş başlığı, not. Yalnızca doldurulursa paylaşım linkine ve dışa aktarmalara girer.

### 1.5 Kaydet, paylaş, dışa aktar
- **URL durumu**: sürümlü, kısa (`#c=2.<base64url JSON>`), yer imine eklenebilir. **URL parçası (fragment)** kullanıldı: tarayıcı onu hiçbir istekte göndermez, yani sunucuya, erişim kayıtlarına ve Cloudflare proxy'sine gitmez (müşteri adı içinde olabilir, KVKK). İstemci tarafı ölçüm adresi kendisi okur: Umami betiği `history.replaceState`'i izliyor ve parçayı gönderiyordu; `data-exclude-hash="true"` ile kapatıldı (betik kaynağında doğrulandı). GA4 (onaydan sonra) parçayı göndermiyor: hesaplayıcıda ilk ve geçmiş güncellemesi sonrası `page_view` isteklerinin `dl` değeri Playwright ile incelendi (#236 incelemesi). `page_location` sabitlenmedi: sabitlenirse sonraki istemci tarafı sayfa geçişleri hep ilk adresi bildirirdi. Cloudflare Web Analytics yerelde doğrulanamadı. Sayfa tek bir ISR belgesi kalır (#211); dolu hesap ayrı bir URL olarak taranmaz, kanonik temiz sayfadır (sahibin "dolu durumda noindex" isteği böylece yapısal olarak karşılanır).
- **Cihazda kayıt**: en çok 30 kayıt; aç, sil. Sunucu kaydı **yok**.
- **PNG**: Canvas 2D (bağımlılık yok, tıklamada yüklenen ayrı parça). Telefonda Web Share (dosya ile), değilse indirme (`kefken-hesap-YYYY-AA-GG-SSDD.png`, İstanbul saati).
- **PDF**: yazdırma stil sayfası + `window.print()` ("PDF olarak kaydet").
- Markalama (ikisinde de): köşede logo, ortada soluk filigran, Europe/Istanbul tarih ve saat ("TSİ"), "Kefken Ahşap malzeme ve teklif hesaplayıcı ile hazırlanmıştır", kefkenahsap.com, "Sonuçlar tahminidir; kesin fiyat için keşif gerekir." (5 dil). Türkçe karakterler ve RTL tarayıcının metin motoruyla çizilir.

### 1.6 Varsayılanlar
- Tek boş kereste satırı, ek kalem yok, fiyat boş, KDV açık %20, birimler cm. Örnek değerler yalnızca placeholder ("örn. 5").

---

## 2. Mimari (uygulanan)

### 2.1 URL'ler ve erişim
| Dil | URL |
|---|---|
| tr | `/tr/malzeme-hesaplayici` |
| en | `/en/material-calculator` |
| ru | `/ru/kalkulyator-materialov` |
| de | `/de/materialrechner` |
| ar | `/ar/material-calculator` (ar sabit rotaları Latin harfli) |

"Kereste" yerine "malzeme": araç artık ek kalemleri ve teklifi de kapsıyor. Slug'lar öneri; sahip değiştirirse yalnızca `src/i18n/routing.ts` güncellenir (kategori slug'ları bunlarla çakışamaz, `RESERVED_CATEGORY_SLUGS`).

Erişim: header menüsü ("Hesaplayıcı"), footer, kategori sayfalarında "Malzemeni hesapla" bağlantısı (deck ve zeminler, pergola ve kamelyalar, korkuluk ve çit, merdivenler, sundurma ve ahşap çatı, ahşap ev ve bungalov, köprü ve iskele; varsayılan dil slug'ıyla seçilir). Sitemap, llms.txt ("Tools"), LHCI ve axe fikstürleri.

### 2.2 Hesap modülü `src/lib/calc/` (saf TS, tsentials `Result`, TDD)
- `number.ts`: `parseDecimal` (ölçü/miktar: `,` ve `.` ondalık, Arapça-Hint ve Farsça rakamlar, `٫`; gruplama reddedilir) ve `parseMoney` (fiyat → **tamsayı kuruş**; en çok 2 ondalık, sıfırlar dahil sayılır). **Yazılan sayı, sayfanın dil kurallarıyla okunur** (sahip kararı 2026-10-19): tr/de'de "." binlik, "," ondalık; en/ar'da "," binlik, "." ondalık; ru'da boşluk binlik, "," ondalık. Üçer basamaklı gruplar binliktir (tr "20.000" = 20 000, "1.000" adet = 1000, "2.400" mm = 2400). Telefon klavyesi için diğer ayırıcının ardından üç basamak gelmiyorsa ondalıktır (tr "2.5" = 2,5; en "2,5" = 2.5). Dille çelişen giriş (tr'de "1,000.5") belirsiz, yanlış grup boyu ("20.00.0") geçersiz sayılır; fiyatta en çok 2 ondalık, sıfırlar dahil. Her sayısal alanın altında okunan değer gösterilir ("= ₺20.000,00", "= 1000"), yazıldığı gibi okunmuyorsa. **Saklama dilden bağımsızdır**: link, cihaz kaydı ve hatırlanan kalem fiyatı kanonik biçimde ("20000.5") tutulur, açan sayfanın diline göre yazılır.
- `quote.ts`: `computeQuote(input, locale)`. Hacim ve para **ölçekli tamsayı (BigInt) ile tam** hesaplanır; her satır bir kez yarım-yukarı yuvarlanır, ara toplam görünen satırların toplamıdır, KDV yuvarlanmış ara toplamdan hesaplanır. Hatalar `Err.validation` + `ErrorMetadata { section, row, field }`; geçersiz satır toplama girmez ve dışa aktarma/paylaşım engellenir.
- `format.ts`: m³ 3 ondalık, 0 < m³ < 0,0005 için "<0,001"; para `Intl` TRY (kuruşlu); tarih Europe/Istanbul. Tüm dillerde Latin rakam (`numberingSystem: 'latn'`), sunucu ve tarayıcı aynı biçimi verir.
- `codec.ts`: durum ↔ link, sürüm 2 (kanonik sayılar); bozuk/uzun/yanlış şekilli link `Err` döner, sayfa boş formla açılır. Üst sınır (80 000 karakter) formun alabileceği en büyük tekliften (55 021) büyüktür. Sürüm 1 linkleri ve eski cihaz kayıtları/hatırlanan kalem fiyatları Türkçe kurallarla okunup belirsiz olmayan biçime çevrilir. Dil menüsü `#c=` parçasını diğer dile taşır.
- `memory.ts`: kayıt listesi (30) ve hatırlanan kalemler (50), bozuk depolama boş liste sayılır.

### 2.3 Arayüz
- Sunucu: H1, kısa açıklama, "Nasıl hesaplanır?" ve "Bilmeniz gerekenler" (indekslenir), kapanış bandı. WebApplication + BreadcrumbList JSON-LD.
- Ada: `CalculatorLazy` (`next/dynamic`, SSR açık): sunucu formu HTML'de yerinde basar, adanın JS'i ayrı parça olarak ilk yükten sonra iner (ilk yük +1,8 KB gz). `React.lazy` denendi: form geç bir Suspense değişimiyle akıtıldı, Lighthouse mobil CLS 0,5 çıktı. PNG kodu ikinci bir parça, ilk tıklamada iner.
- Toplamlar her render'da saf fonksiyondan (E hatası yapısal olarak imkânsız).
- Masaüstü: satırlar tek satırlık ızgara, özet sağda yapışkan (≥1280 px). Mobil: satır başına 3+2 alan ızgarası, özet satırlardan sonra; yatay kaydırma yok, dokunma hedefleri ≥ 44 px.
- Erişilebilirlik: her alanda etiket (satır numarasıyla), birim alanın içinde, hata `aria-describedby` + `aria-invalid`, toplam `aria-live` (yazma durunca), satır silinince odak yönetimi, Enter sonraki alana geçer.
- Analitik: `window.umami?.track` (calc_row_add, calc_share_link, calc_save_local, calc_export_png, calc_export_pdf); `data-umami-event` JS işleyicili öğelerde kullanılmaz (#226). Girdi değeri gönderilmez.

---

## 3. Lansman sonrası

- Baba 1–2 hafta kullandıktan sonra `wood-material-calculator.senrecep.com/*` → `https://www.kefkenahsap.com/tr/malzeme-hesaplayici` **301** (Dokploy/Traefik redirect), eski Vue uygulaması kapatılır. Taşınacak veri yok. Bu iş sahibin onayıyla, ayrı yapılır.

## 4. Faz 2: deck / zemin hesaplayıcısı (takip işi, bu kapsamda değil)

m² → tahta adedi, kiriş adedi, vida ya da klips, fire. Sabitler **Murat Şen** tarafından verilecek: tahta eni ve boyu, derz boşluğu, kiriş aralığı, m² başına vida veya klips, fire. Test tuzakları: L uzunluğunda s aralıkla kiriş sayısı **⌈L/s⌉ + 1**; tahta sıra sayısı ⌈genişlik / (tahta eni + derz)⌉; boy eklemeleri ayrıca. Önce sabitler tablosu, sonra TDD.

## 5. Riskler ve doğrulanamayanlar

1. iOS Safari'de dosya paylaşımı ve yazdırma gerçek cihazda test edilmeli (bu ortamda WebKit yok). Paylaşım reddedilirse indirme yedeği devreye girer.
2. Canvas çiziminden önce sayfanın fontları, çizilecek karakterler için `document.fonts.load` ile beklenir (Arapça/Kiril alt kümeleri dahil).
3. LHCI CI adımı engelleyici değil; PR'a bu sayfanın raporu eklenir.

## 6. ADR özeti

- **Karar:** tek duyarlı Next.js sayfası; saf `src/lib/calc` (Result, TDD, tam sayı aritmetiği); URL parçası + localStorage; Canvas PNG + yazdırma PDF; sunucu kaydı ve yeni bağımlılık yok.
- **Değerlendirilen alternatifler:** html2canvas/html-to-image (bağımlılık + iOS riski), jsPDF (~100 KB, Arapça zayıf), satori/next/og (Arapça bidi sınırlı, yeni çalışma zamanı yolu), sunucuda Playwright (DoS yüzeyi), sunucu tarafı kayıt (KVKK yükü), query string durumu (sunucu kayıtlarına müşteri adı düşer, sayfa ISR olmaktan çıkar).
- **Sonuçlar:** kayıtlar cihaza özel, cihazlar arası taşıma yalnızca linkle. PNG düzeni elle çizildiği için tasarım değişiklikleri kodda yapılır.

---

## Ek: eski uygulamanın denetimi

### A1. Eski uygulama ne yapıyor?

#### 1.1 Tek hesaplayıcı var

v1 ve v2 aynı modeli kullanıyor (`src/types/CalculationItem.ts`, `CalculationResult.ts`). Uygulama **kereste hacmi (m³) ve fiyat** hesaplıyor.

Satır girdileri:

| Alan | Etiket | Birim |
|---|---|---|
| Thickness | Kalınlık | cm. v1'de birim yazmıyor, v2 metninde "cm" geçiyor. |
| Width | En | cm |
| Height | Boy | cm |
| Count | Adet | adet |
| UnitPrice | Fiyat | ₺/m³. Arayüzde birim yazmıyor; formülden çıkarıldı. |

Formüller (koddan birebir):

```
SingleCubicMeter = T*W*H / 1000          // aslında dm³ (litre)
TotalCubicMeter  = SingleCubicMeter * Count
TotalPrice       = UnitPrice * TotalCubicMeter / 1000   // = birim fiyat × m³
gösterim: m³ = değer / 1000              // cm³ → m³ toplam bölen 1.000.000
Toplam: CubicMeter = Σ TotalCubicMeter ; Price = Σ TotalPrice
VAT = Price * 0.2 (sabit %20) ; TotalPrice = Price + VAT
```

Biçimlendirme:
- Para: `Intl.NumberFormat('tr-TR', TRY, maximumFractionDigits: 0)`, yani tam liraya yuvarlanıyor.
- Toplam m³: `toFixed(2)` ile gösteriliyor, ondalık ayırıcı nokta.
- Satır m³: ham float olarak gösteriliyor.

Kartın başında her saniye güncellenen tarih ve saat var: `tr-TR`, `dateStyle full`, cihazın saat dilimi. Babanın bu kartın **ekran görüntüsünü alıp müşteriye gönderdiği** anlaşılıyor. Yeni sürümdeki "markalı dışa aktarma" isteği bu kullanımın düzgün hâlidir.

#### 1.2 Eski uygulamada olmayanlar (denetim kapsamı dışı)

Aşağıdakiler kodda **bulunamadı**:
- fire veya atık yüzdesi
- standart tahta veya kiriş ölçü listesi
- tahta sayısı hesabı (m² → adet)
- kiriş veya karkas aralığı
- vida, klips veya m² başına sarf
- kayıt, paylaşım, dışa aktarma
- çoklu dil, doğrulama

Bu nedenle bu konularda "eski formül hatası" yoktur. Yeni kapsamda yalnızca aday olarak ele alınırlar (bölüm 3.4).

#### 1.3 v1 ile v2 farkı

| | v1 | v2 |
|---|---|---|
| Matematik | aynı | aynı |
| Satır arayüzü | 9 sütunlu tablo, her input en az 200 px. Mobilde tablo içinde yatay kaydırma gerekiyor (390 px'te ilk sütun dışındakiler ekran dışında). | Satırda formül metni ("5cm * 10cm * 400cm = 0.02m³"). Düzenleme modal içinde. |
| Birim etiketi | yok | metinde "cm" |
| Modal "Toplam" | yok | ham `TotalPrice`, biçimlendirilmemiş |
| Mobil | kullanılabilir değil | okunur, ama her satır için modal açmak gerekiyor |
| Marka | Kefken logosu yalnızca ana sayfada var, hesaplayıcı ekranında yok | aynı |

Ortak sorunlar:
- `NumberInput` yalnızca `change` olayında güncelleniyor (blur veya Enter), yani yazarken sonuç değişmiyor.
- Alanlar "0" ile dolu başlıyor.
- `type="number"` kullanılıyor.

---

### A2. Matematik denetimi

#### 2.1 Elle türetme

Bir parçanın hacmi:

V = kalınlık × en × boy

Tüm ölçüler cm olduğunda:

V[m³] = t·w·L / 1.000.000, çünkü 1 m³ = 100³ cm³.

Diğer büyüklükler:
- Satır hacmi: V × adet
- Tutar: Σ hacim × birim fiyat (₺/m³)
- KDV: tutar × oran
- Genel toplam: tutar + KDV

Eski kod önce /1000 (cm³ → dm³), sonra gösterimde bir kez daha /1000 (dm³ → m³) uyguluyor. Toplam bölen 10⁶ olduğu için **dönüşüm doğru**. Fiyat formülü (`UnitPrice × dm³ / 1000`) de ₺/m³ birim fiyat için doğru.

**Sonuç: temel formül doğru. Hatalar durum yönetimi, girdi ayrıştırma, yuvarlama ve gösterimde.**

#### 2.2 Çalışılmış örnekler: eski çıktı ve doğru sonuç

Tüm "eski" değerler canlı siteden Playwright ile okundu. "Doğru" değerler elle hesaplandı. Para kuruşa yuvarlandı; KDV yuvarlanmış ara toplamdan hesaplandı.

| # | Girdi (t×w×L cm, adet, ₺/m³) | Eski çıktı (m³ / Fiyat / KDV / Toplam) | Doğru sonuç | Karar |
|---|---|---|---|---|
| A | 5×10×400, 10 adet, 20.000 | 0.20 / ₺4.000 / ₺800 / ₺4.800 | 0,2 m³ / 4.000,00 / 800,00 / 4.800,00 | Doğru |
| B | **"2,5"**×10×400, 10, 20.000 (virgüllü yazım) | 1.00 / ₺20.000 / ₺4.000 / ₺24.000 | 0,1 m³ / 2.000,00 / 400,00 / 2.400,00 | **Hata, 10 kat.** Virgül sessizce siliniyor: input değeri "25". Chromium'da hem en-US hem **tr-TR** yerel ayarında doğrulandı. WebKit/iOS host bağımlılığı eksik olduğu için test edilemedi. |
| C | 1,8×10,1×300, 3 adet, 12.345 (noktayla) | satır `0.016361999999999998`; toplam 0.02 / ₺202 / ₺40 / ₺242 | 0,016362 m³ / 201,99 / 40,40 / 242,39 | Hesap doğru, **gösterim hatalı**: float gürültüsü, m³ 2 haneye kırpılmış, kuruş kayıp. |
| D | 2×5×40, 1 adet, 20.000 | **0.00** / ₺8 / ₺2 / ₺10 | 0,0004 m³ / 8,00 / 1,60 / 9,60 | **Hata, gösterim.** Hacim 0 görünürken fiyat 8 ₺. KDV 1,60 → "₺2", toplam 9,60 → "₺10". |
| E | İki satır A gibi; 1 satır silinip 1 yeni satır eklenip doldurulduğunda | 0.20 / ₺4.000 / ₺800 / ₺4.800 (yeni satır **toplama girmiyor**) | 0,4 m³ / 8.000,00 / 1.600,00 / 9.600,00 | **Kritik hata.** `handleDelete` diziyi yeniden atıyor, `CalculationResult` ise eski diziyi derin izliyor (`watch(items.value)`). Silmeden sonra eklenen satırlar toplamı güncellemiyor; sayfa yenilenene kadar sonuç yanlış kalıyor. |
| F | 5×10×100, 1 adet, 20.500 | 0.01 / ₺103 / ₺21 / ₺123 | 0,005 m³ / 102,50 / 20,50 / 123,00 | **Hata, gösterim.** Ekrandaki parçalar tutmuyor: 103 + 21 = 124 ≠ 123. Müşteriye giden görüntüde çelişki oluşuyor. |
| G | **-5**×10×400, 10, 20.000 | -0.20 / -₺4.000 / -₺800 / -₺4.800 | Doğrulama hatası: "Kalınlık 0'dan büyük olmalı" | **Hata.** Doğrulama yok. Ondalık adet ("2,5 adet") ve boş alan (sessizce 0) da kabul ediliyor. |

#### 2.3 Diğer bulgular

1. **Ondalık ayırıcı karışık.** Aynı kartta "0.20" (ondalık nokta) ve "₺4.000" (binlik nokta) yan yana görünüyor. Türkçede "0.20" ile "4.000" karıştırılabilir. Yeni sürümde tüm sayılar `Intl.NumberFormat(locale)` ile biçimlendirilecek, Türkçede "0,20" olarak.
2. **Saat dilimi.** Tarih cihaz saatine göre basılıyor. Yurt dışındaki bir müşteri farklı saat görebilir. Dışa aktarmada `timeZone: 'Europe/Istanbul'` açıkça verilmeli ve "TSİ" etiketi eklenmeli.
3. **KDV sabit %20.** Türkiye'de genel oran 10.07.2023'ten beri %20'dir ve kereste için de bu oran beklenir. Yine de oran ayarlanabilir olmalı (varsayılan 20). Girilen fiyatın KDV hariç olduğu varsayılıyor; bunun onaylanması gerekiyor (Açık soru S3).
4. **Birim belirsizliği.** v1 birim göstermiyor. Usta boyu metre olarak "4" girerse sonuç 100 kat küçük çıkıyor (5×10×4 cm = 0,0002 m³). Yeni sürümde her alanın yanında birim yazmalı. Ayrıca makullük uyarısı olmalı: boy < 30 cm ise "Boyu metre olarak mı girdiniz?" İkinci olasılık mm/cm/m birim seçimi (S1).
5. **Yalnızca blur/Enter ile hesaplama.** Mobilde kullanıcı alandan çıkmadan sonucu göremiyor. Yeni sürüm yazarken hesaplamalı.
6. **v2 modalında ham değer.** "Toplam" alanı `TotalPrice` değerini biçimsiz gösteriyor (örneğin `201.98889`).

#### 2.4 Yeni modülde yuvarlama politikası

- Hesap tam hassasiyette yapılır; **yalnızca gösterimde yuvarlanır**.
- Para kuruş (tamsayı) olarak tutulur:
  - `araToplamKuruş = round(Σ m³ × fiyat × 100)`
  - `kdvKuruş = round(araToplamKuruş × oran / 100)`
  - `toplam = araToplam + kdv`

  Böylece görünen satırlar her zaman toplamı verir (F vakası). Yuvarlama yarımı yukarı (half-up) yapılır.
- m³ varsayılan olarak **3 ondalık** gösterilir. 0,0005'ten küçük değerler "< 0,001" yerine 4 haneli gösterilir; ondalık sayısı S5 ile kesinleşir. (Karar: 3 ondalık, küçük değer "<0,001".)
- Float gürültüsü gösterimde `Intl.NumberFormat` (`maximumFractionDigits`) ile temizlenir. Testlerde `toBeCloseTo` kullanılır.

---
