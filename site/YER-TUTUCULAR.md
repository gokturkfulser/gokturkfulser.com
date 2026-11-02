# Yer tutucu envanteri

Bu klasördeki **tüm örnek içerik uydurmadır** ve `taslak: true` ile işaretlidir. Production build'de hiçbiri bulunmaz (sayfa, RSS, sitemap, OG görseli, Pagefind dizini, görsel dosyaları dahil); `SHOW_DRAFTS=true` ile alınan preview build'inde tasarımı denemek için görünürler.

Kontrol: `pnpm site:build`, sonra `site/dist/` içinde aşağıdaki dizelerden hiçbiri bulunmamalı: `Paris, Texas`, `Pick and roll`, `Dakika`, `Salon Rehberi`, `Eski Portföy`, `flower.mp4`, `gokturkfulser.github.io/"` (`eski-portfoy` uydurma projesinin adresi; kapanış tırnağıyla, çünkü gerçek `ece-ismail-dugun-davetiyesi` projesinin adresi de `gokturkfulser.github.io/` ile başlar), `gokturkfulser.github.io/salon-rehberi` (`salon-rehberi` uydurma projesinin adresi). Eski kontroldeki yalın `github.io` dizesi kaldırıldı: gerçek proje yüzünden her zaman eşleşir. `dist/pagefind/` ve `dist/pagefind-b/` (Pagefind'ın kendi dosyaları) hariç aranır. (Doğrulandı: 0 eşleşme; `dist/` 28 HTML içeriyor, her dilde 14: ana sayfa, 404, hakkımda, arama, yazı listesi + 2 bölüm listesi, 1 çeviri yazısı, projeler, 3 proje sayfası (`kelime-avi`, `perde-perde-anadolu`, `ece-ismail-dugun-davetiyesi`) ve 2 tür sayfası (oyun, site).)

## 3. Sayfa metinleri ve tasarım yer tutucuları

| Dosya | Durum |
| --- | --- |
| `src/pages/hakkimda.astro` | Sayfa artık `ozgecmis.yaml`'ı okur (yukarıdaki satır). `taslak: true` iken production'da "Bu sayfa hazırlanıyor" yazar, nav bağlantısı kalır; `SHOW_DRAFTS=true`'da yer tutucu özgeçmiş görünür. Gerçek veri girilince `taslak` satırı silinir. |
| `src/content/ozgecmis.yaml` | **Gerçek veri** (`taslak: false`); yer tutucu değil. Alanlar `{ en, tr }` iki dilli; sayfa kendi dilini gösterir. |
| `public/favicon.svg` | Geçici "G" işareti. |
| Tüm `*.svg` kapak/ekran görüntüleri | Düz renk + daire. Gerçek görsellerle (jpg/png/webp) değiştirilmeli. |
| `src/data/tmdb-cache.json` | Boş (`{}`): yer tutucu değil, `pnpm site:tmdb` ile dolacak. |

## 4. Gerçeğe çevirme

1. Gerçek içeriği yeni klasör olarak ekleyin (`taslak: false` ya da alanı hiç yazmayın).
2. İlgili yer tutucu klasörü silin. Hepsini silmek için `site/src/content/*/` altındaki yukarıdaki 7 klasörü kaldırmak yeter; şema ve kod değişmez.
3. `hakkimda.astro`'daki `SHOW_DRAFTS` koşulunu gerçek metinle değiştirin.
4. `public/favicon.svg`'yi değiştirin; isterseniz `public/tmdb-logo.svg` ekleyin.
5. `pnpm site:tmdb` (anahtar gerekir), sonra `pnpm site:build`; yukarıdaki "Kontrol" adımını yeniden çalıştırın.

## 5. Production'da boş durumlar

İçerik hiç yokken sayfalar şöyle davranır: ana sayfa "Henüz yazı yok" ve projeler/hakkımda bağlantıları, `/yazilar/` (ve `/yazilar/sinema/`, `/yazilar/basketbol/`) başlık + "Bu bölümde henüz yazı yok", `/projeler/` "Henüz proje yok", hakkımda "Bu sayfa hazırlanıyor"; RSS'ler öğesiz, sitemap yalnızca 6 sabit sayfa, arama yalnızca hakkımda'yı indeksler. `etiketler/` ve `projeler/tur/` sayfaları üretilmez.

## 4. Yeniden tasarımla gelen yer tutucular

| Dosya | Uydurma/yer tutucu olan |
| --- | --- |
| `src/lib/site.ts` | `PROFILLER` yalnızca GitHub + RSS (Letterboxd vb. eklenecek). **`HERO_CUMLESI` ve `KISACA_METNI`: isteğe bağlı, boş bırakılabilir.** Boşken hero cümlesi ve "Kısaca" bölümü hiç render edilmez; metin yazılınca kendiliğinden görünür. |
| `src/pages/index.astro` | Yer tutucu metin yok (hero cümlesi ve "Kısaca" `site.ts`'ten gelir, şimdilik boş). Hero görseli kalıcı: `HeroSahne` SVG; portre fotoğrafı kullanılmaz. |
| `src/pages/hakkimda.astro` | `deneyim` listesi yalnızca `SHOW_DRAFTS` iken uydurma; gerçek deneyim girilince `SHOW_DRAFTS` koşulu kalkar. |

## 5. /hakkimda/ hikâye düzeni

| Alan | Durum |
| --- | --- |
| `src/content/hakkimda.en.md` | İngilizce metin (ve tüm İngilizce arayüz sözlüğü `src/i18n/en.ts`) Claude tarafından Türkçe metnin tonunda yazıldı; gözden geçirilmeli. |
| `ozgecmis.yaml` → `kisa`, `duraklar`, beceri `cumle`, `sayilar` | Cümleleri Claude özgeçmiş verisinden yazdı (tr + en); gözden geçirilmeli. `duraklar` içindeki "Kendi projelerim" yılı (2026) lab/apps/kelime-avi'nin ilk commit tarihinden (Ekim 2026) alındı. |
| `ozgecmis.yaml` → `su_siralar` | Her iki grup da boş (Perde Perde Anadolu yayında olduğu için "Üzerinde çalıştığım"dan çıkarıldı); doldurulana kadar görünmez: doldurulana kadar görünmez. İzlediklerim Letterboxd'dan gelir (`LETTERBOXD_RSS`). |

## 6. Top 10 ("İnsan highlight makarası") örnek verisi

Hepsi uydurmadır (oyuncular, videolar ve açıklamalar gerçek değil) ve `taslak: true`'dur; production'da yüklenmez, yazı da taslaktır. Gerçek veri girilince silinir.

| Dosya | Durum |
| --- | --- |
| `src/content/top10/2026-27/2026-10-28.yaml` | Uydurma Top 10 gecesi (çoğu tek kişilik oyun, bir 50/50 alley-oop). |
| `src/content/top10/2026-27/2026-10-30.yaml` | Uydurma **Top 5** gecesi (50/50 ve 70/30 paylı oyunlar). |
| `src/content/top10/2026-27/2026-11-01.yaml` | Uydurma Top 10 gecesi: 50/50 alley-oop (açık pay), 70/30 pas ağırlıklı alley-oop, blok + hızlı hücum (iki katkı), üçlü eşit bölüşüm (34/33/33), top çalma + hızlı hücum, `rakip` ve `aciklama` örnekleri; aynı oyuncu (Ilse Brandt) o gecede hem tek başına (3. sıra) hem paylı oyunla (8. sıra) gelir. |
| `src/content/basketbol/insan-highlight-makarasi/index.mdx` | Taslak yazı (tr); giriş metni yer tutucu, yazılacak. |
| `src/content/basketbol/human-highlight-reel/index.mdx` | Taslak çeviri (en); giriş metni yer tutucu. |

Kontrol: production `dist/` içinde şu dizelerin hiçbiri bulunmamalı: `Veltri`, `Kofi Adebayo`, `Ilse Brandt`, `Piet Kronen`, `Wes Okafor`, `Cal Meyer`, `Sol Brando`, `Ben Archer`, `Noor Hale`, `Amara Osei`, `Jun Takeda`, `Rafael Quintero`, `Nils Haugen`, `Mirko Daval`, `Leo Marchetti`, `Dario Fenn`, `yer-tutucu-`, `insan-highlight`, `human-highlight` (`dist/pagefind*` ve bileşen CSS'i dışında; Top 10 bileşenlerinin stil kuralları paylaşılan `mdx.*.css` paketinde yer alır, veri değildir). Gerçeğe çevirirken `src/content/top10/2026-27/` altındaki üç dosyayı silin, iki yazıdan `taslak: true` satırını kaldırın.
