# Kaliteli arşivinden seçilen fotoğraflar (#65)

Arşivdeki 3.250 fotoğraftan **210** tanesi seçildi. Bu fotoğraflar sitede **"Onay bekliyor"** durumunda. Ziyaretçiler, siz admin › Galeri'den onaylayana kadar bunları görmez. Her fotoğrafın TR/EN başlığı, alt metni, açıklaması ve SEO dosya adı hazır. Onaylamadan önce metni düzeltebilir, uymayan fotoğrafı "Gizle" ile kapatabilirsiniz.

Dosyalar:
- `seed/media-meta-archive/<kategori>/<dosya>.json`: her seçilen fotoğrafın metni. `source` alanı arşivdeki yerini gösterir (`Kaliteli/<klasör>/<dosya>`).
- `docs/media-archive/<kategori>.webp`: seçilen fotoğrafların küçük önizlemeleri. Altındaki yazı SEO dosya adıdır.
- Yükleme betiği: `scripts/seed/archive.ts`. Arşiv dosyaları depoya konmadı.

## Kategori başına

| Kategori | Sitede (onaylı) | Arşivden eklenen | Toplam (onaydan sonra) |
|---|---:|---:|---:|
| Ahşap Yapılar | 63 | 17 | 80 |
| Deck ve Zeminler | 86 | 17 | 103 |
| Pergola ve Kamelyalar | 47 | 33 | 80 |
| Korkuluk ve Çit | 59 | 26 | 85 |
| Köprü ve İskele | 19 | 14 | 33 |
| Merdivenler | 24 | 30 | 54 |
| Çiçeklik ve Oturma Grubu | 39 | 24 | 63 |
| Kapı, Dolap ve Seperatör | 48 | 31 | 79 |
| İroko ve Teak | 41 | 15 | 56 |
| Mobilya ve Cila | 132 | 3 | 135 |
| Boya, Tamir ve Bakım | 10 | 0 | 10 |
| **Toplam** | **568** | **210** | **778** |

- **Köprü ve İskele** ile **Merdivenler** zayıf kategorilerdi. İkisi de belirgin biçimde büyüdü.
- **Boya, Tamir ve Bakım** için arşivde yalnızca 5 fotoğraf var. 3'ü zaten sitede, 1'i düşük çözünürlüklü, sonuncusunda bir kişinin yüzü net görünüyor. Bu kategoriye yeni fotoğraf eklenmedi; yeni çekim gerekiyor.
- **Mobilya ve Cila** arşivindeki 119 fotoğrafın 98'i zaten sitede. Eklenen 3 fotoğraf başka klasörlerden geldi.
- 17 fotoğraf arşivdeki klasöründen farklı bir kategoriye kondu. Örnek: İroko-Teak klasöründeki yemek takımları Mobilya ve Cila'ya, bir bahçe kapısı Korkuluk ve Çit'e.

## Nasıl seçildi

1. **Kopya taraması (otomatik).** Her arşiv fotoğrafı sitedeki 568 fotoğrafla karşılaştırıldı: algısal özet (pHash) ve görsel benzerlik (CLIP, `seed/clusters/embeddings.json` ile aynı model). Sitedeki bir fotoğrafla aynı olanlar çıkarıldı. Arşivin kendi içindeki çok benzer kareler (aynı anda çekilmiş seriler) gruplandı; her gruptan en iyi puanlı kare kaldı.
2. **Teknik eleme (otomatik).** Uzun kenarı 1000 px'ten küçük olanlar ve bulanık olanlar çıkarıldı. Kalanlara keskinlik, pozlama, çözünürlük ve yatay kadraja göre puan verildi.
3. **İçerik işaretleri (otomatik).** CLIP ve yüz algılama; insan, plaka, yazı/belge, ahşap dışı iş ve bitmemiş şantiye görüntülerini işaretledi. Güçlü işaretliler elendi, zayıf işaretliler gözle bakılmak üzere listede kaldı. İnce kategorilerde (Köprü ve İskele, Merdivenler, Boya) hiçbir fotoğraf otomatik elenmedi; hepsine gözle bakıldı.
4. **Gözle inceleme.** Her kategoride en iyi puanlı fotoğraflara iki turda bakıldı (852 fotoğraf): önce toplu önizleme sayfalarında, kararsız kalınanlarda tek tek 1024 px önizlemede. Aynı projeden en fazla 2–3 kare seçildi, böylece galeri tekrar etmiyor.
5. **Metin.** Seçilen her fotoğraf için TR/EN başlık, alt metin, açıklama, SEO dosya adı ve etiketler, sitedeki 568 fotoğrafla aynı şemada (`tagImage@2`) yazıldı. Metin yalnızca fotoğrafta görüneni anlatır. Ahşap türü fotoğraftan anlaşılmadığı için hiçbir fotoğrafta tür yazılmadı. Başlıklar yazım rehberine göre cümle düzeninde.

## Sayılar

| Aşama | Fotoğraf |
|---|---:|
| Arşivde | 3.250 |
| Sitedeki bir fotoğrafla aynı (pHash 429, CLIP 4) | 433 |
| Arşiv içinde neredeyse aynı kare | 169 |
| Bulanık | 64 |
| Düşük çözünürlük (<1000 px) | 8 |
| Otomatik içerik işareti (insan 161, ahşap dışı 54, bitmemiş 52, yazı/belge 38, plaka 10) | 315 |
| Puan sırasında listeye girmedi (gözle bakılmadı) | 1.409 |
| Gözle incelendi | 852 |
| **Seçildi** | **210** |

Gözle incelemede elenen 642 fotoğrafın gerekçeleri:

| Gerekçe | Adet |
|---|---:|
| Bitmemiş iş, şantiye, iskele, alt konstrüksiyon | 156 |
| Yüzü görünen kişiler | 141 |
| Seçilen bir kareyle aynı proje (tekrar) | 125 |
| Kalite: dağınıklık, kötü kadraj, gölge, pozlama | 103 |
| İşin üstüne binen kalın filigran veya tarih damgası | 75 |
| Tabela, yazı, belge | 23 |
| Konu dışı | 8 |
| Ahşap dışı iş | 6 |
| Okunabilir plaka | 5 |

Klasör başına ("Seçilen" klasöre göredir; kategoriye göre dağılım ilk tabloda):

| Klasör | Arşivde | Sitede var | Arşivde kopya | Teknik eleme | Otomatik işaret | Gözle bakılan | Seçilen |
|---|---:|---:|---:|---:|---:|---:|---:|
| Ahşap Yapılar | 560 | 57 | 27 | 31 | 92 | 100 | 19 |
| Deck ve Zeminler | 821 | 76 | 83 | 6 | 61 | 115 | 14 |
| Pergola ve Kamelyalar | 330 | 37 | 1 | 1 | 19 | 100 | 29 |
| Korkuluk ve Çit | 299 | 40 | 14 | 0 | 25 | 95 | 27 |
| Köprü ve İskele | 94 | 11 | 0 | 1 | 0 | 80 | 16 |
| Merdivenler | 209 | 19 | 6 | 0 | 0 | 120 | 31 |
| Çiçeklik ve Oturma Grubu | 313 | 27 | 15 | 9 | 38 | 85 | 23 |
| Kapı, Dolap ve Seperatör | 267 | 36 | 8 | 8 | 27 | 85 | 31 |
| İroko-Teak | 233 | 29 | 15 | 6 | 42 | 70 | 20 |
| Mobilya ve Cila | 119 | 98 | 0 | 9 | 11 | 1 | 0 |
| Boya Tamir ve Bakım | 5 | 3 | 0 | 1 | 0 | 1 | 0 |

## Onaylarken bakmanız gerekenler

- **Filigran:** Fotoğrafların çoğunun ortasında ince "kefkenahsap.com" yazısı var; bu kabul edildi. Kalın iki satırlı filigran veya tarih damgası işin üstündeyse fotoğraf elendi. Tek istisna havuz üstündeki kavisli deck (Deck ve Zeminler/3680): bu işin başka karesi yok.
- **Telefon damgası:** Birkaç fotoğrafın köşesinde "Redmi Note 8 Pro" yazısı var. İşin üstünde değil, ama kırpmak isteyebilirsiniz: Korkuluk ve Cit/12239, 12237, 12242; Pergola ve Kamelyalar/12190.
- **Ahşap türü:** İroko ve Teak'e eklenen 15 fotoğrafta tür yazılmadı, çünkü fotoğraftan anlaşılmıyor. Bunların gerçekten iroko veya teak olduğunu teyit edin; değilse başka kategoriye taşıyın.
- **Sizin işiniz mi:** Yeşil metal korkuluklu ahşap köprü (Kopru ve Iskele/1446), parktaki eskimiş köprü (Kopru ve Iskele/11007), lamine ahşap çatılı büyük salon (Ahsap Yapilar/6306), ahşap kaplamalı cumbalı ev (Ahsap Yapilar/12542; yalnızca kaplama mı, bütün ev mi?).
- **Ne olduğu:** Merdiven altındaki kapaklı bölümler "dolap/depo" diye anlatıldı (5 fotoğraf). Bir verandadaki çıtalı paravan klima dış ünitesini gizliyor diye yazıldı (Korkuluk ve Cit/13925). Yanlışsa metni düzeltin.
- **Arka plandaki kişi ve araçlar:** Birkaç fotoğrafın kenarında küçük, tanınmayan kişiler (Pergola ve Kamelyalar/5495, 271, 13791) veya plakası okunmayan araçlar var. Tam boyutta bir kez bakın.
- **Elenen ama güçlü olanlar:** Bazı fotoğraflar yalnızca filigran ya da tarih damgası yüzünden elendi: Pergola ve Kamelyalar/1053 (taş evin yanında büyük pergola), Merdivenler/4828 (eski kirişten basamaklar, tozlu oda). Temiz bir kopyası veya yeni çekimi varsa eklemeye değer.

## Çalıştırma

```bash
# Önce seed.ts çalışmış olmalı (kategoriler gerekli). Tekrar çalıştırmak güvenli: var olanları atlar.
KEFKEN_ARCHIVE=/yol/kefken-data/Kaliteli bun run payload run scripts/seed/archive.ts
```

Lokal sonuç: 210 fotoğraf `pending` olarak yüklendi, onaylı 568 fotoğraf değişmedi, her kategoride yeni fotoğraflar mevcut sıranın sonuna eklendi, ikinci çalıştırma 0 yeni kayıt oluşturdu.
