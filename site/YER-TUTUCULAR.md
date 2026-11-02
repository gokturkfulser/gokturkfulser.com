# Yer tutucu envanteri

Bu klasördeki **tüm örnek içerik uydurmadır** ve `taslak: true` ile işaretlidir. Production build'de hiçbiri bulunmaz (sayfa, RSS, sitemap, OG görseli, Pagefind dizini, görsel dosyaları dahil); `SHOW_DRAFTS=true` ile alınan preview build'inde tasarımı denemek için görünürler.

Kontrol: `pnpm site:build`, sonra `site/dist/` içinde aşağıdaki dizelerden hiçbiri bulunmamalı: `Paris, Texas`, `Pick and roll`, `Dakika`, `Salon Rehberi`, `Eski Portföy`, `flower.mp4`, `github.io`. `dist/pagefind/` hariç aranır: Pagefind'ın kendi betiği `github.io` dizesini içerir (yanlış alarm). (Doğrulandı: 0 eşleşme; `dist/` 9 HTML içeriyor: 6 sabit sayfa, 404, `projeler/kelime-avi/` ve `projeler/tur/oyun/`.)

## 1. Yazılar (`src/content/sinema/`, `src/content/basketbol/`)

| Klasör | Uydurma olanlar |
| --- | --- |
| `sinema/paris-texas-bir-yalnizlik-resmi/` | Yazı metni ve yorumları, `puan: 4.5`, "Ry Cooder" cümlesi, alıntı, etiketler. `tmdbId: 655` gerçek filmin kimliğidir ama cache hiç çekilmedi, doğrulanmadı. `kapak.svg`, `col.svg` düz renk yer tutucu görseller. |
| `sinema/uzak-karin-ve-sessizlik/` | Yazı metni, `puan: 4`, `orijinalAd`, etiketler. **Bilerek kapaksız**: görselsiz yedek kapağı (projektör ışığı + yıl) gösterir. |
| `basketbol/pick-and-roll-sadeligi/` | Yazı metni, **uydurma istatistikler** (`istatistik`: 64 / %41 / %27 ve gövdedeki "Perde sonrası tercihler (örnek veri)" tablosu: 26 / 17 / 12 / 9), "Not defterimden" alıntısı, `sezon: 2026-27`, `kapak.svg`, `saha-bir.svg`, `saha-iki.svg`. |
| `basketbol/sezon-acilisi-ritim-savasi/` | Yazı metni, `takimlar` (gerçek takım adları, içerik uydurma). **Bilerek kapaksız**: görselsiz yedek kapağı (saha çizgileri + sezon) gösterir. |

Hepsinde `tarih` değerleri (2026-08 – 2026-10) de uydurmadır.

## 2. Projeler (`src/content/projeler/`)

> `kelime-avi/` artık yer tutucu değildir: gerçek, oynanabilir oyun `lab/apps/kelime-avi/` içindedir (`lab.gokturkfulser.com/kelime-avi/`); kapak ve ekran görüntüleri o oyundan alınmış PNG'lerdir, `taslak: false`. **Tek istisna:** `metin.tr.mdx` ve `metin.en.mdx` frontmatter'ındaki `vaka.ne`, `vaka.neden` ve `vaka.nasil` metinleri (**iki dilde de**) (proje sayfasındaki Ne / Neden / Nasıl modülleri) **uydurmadır**; gerçek metinle değiştirilmeli ya da alanlar silinmeli (boş modül hiç render edilmez). Aşağıdaki liste kalan yer tutucuları kapsar.

| Klasör | Uydurma olanlar |
| --- | --- |
| `perde-perde-anadolu/` | Oyun **yayında** (`durum: yayinda`, `citiesofanatolia.gokturkfulser.com`, ad "Perde Perde Anadolu", "Oyna" bağlantısı; hakkımda'nın "Şu sıralar" grubunda yok). **Yer tutucu kalanlar:** `metin.tr.mdx` / `metin.en.mdx` içindeki geçici `ozet` cümlesi ("Çocuklar için hazırladığım Türkçe bir Anadolu macerası." / "An Anatolian adventure I made for kids."), boş `stack`, hiç yazılmamış `vaka` (ne/neden/nasıl) ve MDX gövdesi (**iki dil için de**). Klasör adı (slug) bilerek `perde-perde-anadolu`; özgeçmiş bu slug'a bağlanır. `kapak.png` oyunun başlangıç ekranından alınmış gerçek ekran görüntüsüdür. |
| `dakika/` | Servis yok. `repo: github.com/gokturkfulser/dakika` (yok), **`demoVideo`: MDN'in `flower.mp4` örnek videosu** (konuyla ilgisiz), metin, `kapak.svg`. |
| `salon-rehberi/` | Site yok. `url: gokturkfulser.github.io/salon-rehberi/` (yok), `repo` (yok), metin, `kapak.svg`. |
| `eski-portfoy/` | `url: gokturkfulser.github.io/` (belirsiz), metin, `kapak.svg`. |

> **İki dil:** her proje `proje.yaml` (ortak) + `metin.tr.mdx` + `metin.en.mdx` biçimindedir. Mevcut Türkçe proje metinlerinin İngilizcesi Claude tarafından yazıldı (gözden geçirilmeli); yer tutucu olan metinler iki dilde de yer tutucudur (`dakika`, `eski-portfoy`, `salon-rehberi` ve `kelime-avi` vaka metinleri, `perde-perde-anadolu` özeti). Yazılar: `basketbol/is-this-october-really-different/` gerçek yazının (`bu-ekim-gercekten-farkli-mi`) İngilizcesidir (`ceviri` ile bağlı).

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
