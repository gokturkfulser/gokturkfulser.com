# Yer tutucu envanteri

Bu klasördeki **tüm örnek içerik uydurmadır** ve `taslak: true` ile işaretlidir. Production build'de hiçbiri bulunmaz (sayfa, RSS, sitemap, OG görseli, Pagefind dizini, görsel dosyaları dahil); `SHOW_DRAFTS=true` ile alınan preview build'inde tasarımı denemek için görünürler.

Kontrol: `pnpm site:build`, sonra `site/dist/` içinde aşağıdaki dizelerden hiçbiri bulunmamalı: `Paris, Texas`, `Pick and roll`, `Dakika`, `Salon Rehberi`, `Eski Portföy`, `flower.mp4`, `github.io`. `dist/pagefind/` hariç aranır: Pagefind'ın kendi betiği `github.io` dizesini içerir (yanlış alarm). (Doğrulandı: 0 eşleşme; `dist/` 9 HTML içeriyor: 6 sabit sayfa, 404, `projeler/kelime-avi/` ve `projeler/tur/oyun/`.)

## 1. Yazılar (`src/content/sinema/`, `src/content/basketbol/`)

| Klasör | Uydurma olanlar |
| --- | --- |
| `sinema/paris-texas-bir-yalnizlik-resmi/` | Yazı metni ve yorumları, `puan: 4.5`, "Ry Cooder" cümlesi, alıntı, etiketler. `tmdbId: 655` gerçek filmin kimliğidir ama cache hiç çekilmedi, doğrulanmadı. `kapak.svg`, `col.svg` düz renk yer tutucu görseller. |
| `sinema/uzak-karin-ve-sessizlik/` | Yazı metni, `puan: 4`, `orijinalAd`, etiketler, `kapak.svg`. |
| `basketbol/pick-and-roll-sadeligi/` | Yazı metni, **uydurma istatistikler** (`istatistik`: 64 / %41 / %27 ve gövdedeki "Perde sonrası tercihler (örnek veri)" tablosu: 26 / 17 / 12 / 9), "Not defterimden" alıntısı, `sezon: 2026-27`, `kapak.svg`, `saha-bir.svg`, `saha-iki.svg`. |
| `basketbol/sezon-acilisi-ritim-savasi/` | Yazı metni, `takimlar` (gerçek takım adları, içerik uydurma), `kapak.svg`. |

Hepsinde `tarih` değerleri (2026-08 – 2026-10) de uydurmadır.

## 2. Projeler (`src/content/projeler/`)

> `kelime-avi/` artık yer tutucu değildir: gerçek, oynanabilir oyun `lab/apps/kelime-avi/` içindedir (`lab.gokturkfulser.com/kelime-avi/`); kapak ve ekran görüntüleri o oyundan alınmış PNG'lerdir, `taslak: false`. Aşağıdaki liste kalan yer tutucuları kapsar.

| Klasör | Uydurma olanlar |
| --- | --- |
| `dakika/` | Servis yok. `repo: github.com/gokturkfulser/dakika` (yok), **`demoVideo`: MDN'in `flower.mp4` örnek videosu** (konuyla ilgisiz), metin, `kapak.svg`. |
| `salon-rehberi/` | Site yok. `url: gokturkfulser.github.io/salon-rehberi/` (yok), `repo` (yok), metin, `kapak.svg`. |
| `eski-portfoy/` | `url: gokturkfulser.github.io/` (belirsiz), metin, `kapak.svg`. |

## 3. Sayfa metinleri ve tasarım yer tutucuları

| Dosya | Durum |
| --- | --- |
| `src/pages/hakkimda.astro` | Biyografi metni uydurmadır; yalnızca `SHOW_DRAFTS=true` iken görünür. Production'da "Bu sayfa hazırlanıyor" yazar. Gerçek metin yazılınca `SHOW_DRAFTS` koşulu kaldırılmalı. |
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

İçerik hiç yokken sayfalar şöyle davranır: ana sayfa "Henüz yazı yok" ve projeler/hakkımda bağlantıları, `/sinema/` ve `/basketbol/` bölüm başlığı + "Bu bölümde henüz yazı yok", `/projeler/` "Henüz proje yok", hakkımda "Bu sayfa hazırlanıyor"; RSS'ler öğesiz, sitemap yalnızca 6 sabit sayfa, arama yalnızca hakkımda'yı indeksler. `etiketler/` ve `projeler/tur/` sayfaları üretilmez.
