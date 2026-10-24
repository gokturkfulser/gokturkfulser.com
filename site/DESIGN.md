# site/DESIGN.md — Teal & Orange

Bu dosya bağlayıcıdır. Seçilen yön: **Teal & Orange**. Sinemanın turkuaz-turuncu renk grade'i ve basketbol topunun turuncusu. Sinema içerikleri turkuaz, basketbol içerikleri turuncu; zemin nötr. Site okuma ağırlıklı ve Türkçe; ilk iş yazıyı rahat okutmak, ikinci iş projeleri öne çıkarmaktır.

Token'lar `src/styles/tokens.css` içindedir; bu dosyadaki değer değişmeden orada değişmez.

## Renkler

| Ad | Açık | Koyu | Rol |
| --- | --- | --- | --- |
| Zemin | `#F4F6F8` | `#0F1317` | sayfa zemini |
| Mürekkep | `#16191F` | `#E9EDF1` | ana metin |
| Turkuaz | `#0E5E66` | `#0E5E66` | sinema alanları ve dolguları |
| Turuncu | `#E2661A` | `#E2661A` | basketbol alanları ve dolguları |
| Yüzey | `#FFFFFF` | `#171D23` | proje vitrini, tablo zemini |
| Soluk | `#4A5360` | `#A3AEBA` | tarih, özet, ikincil metin |

Türetilmiş tonlar (zemin üstünde metin ya da işaret olarak): turkuaz-metin `#0E5E66` / `#5CC3CC`; turuncu-metin `#A8430A` / `#FF9A63`. Alan içi metin sabittir: turkuaz alanda beyaz, turuncu alanda mürekkep `#16191F`.

- Açık/koyu mod yalnızca `prefers-color-scheme` ile; tema anahtarı yok.
- Turkuaz ve turuncu **alanlar** iki modda da aynıdır; değişen yalnızca nötr kısımlar ve zemin üstündeki metin tonlarıdır.
- `#E2661A` zemin üstünde metin olarak **kullanılmaz** (3,15:1); yalnızca dolgu ve kalın bant.
- Bir bölüm bilgisi yalnızca renkle verilmez; adı da düz yazıyla yazılır.
- Dünya seçimi `data-dunya="sinema|basketbol"` ile yapılır; bileşenler `--dunya`, `--dunya-metin`, `--dunya-bant`, `--dunya-alan-metin` değişkenlerini okur.

## Fontlar

Astro Fonts API ile build'de indirilir, kendi domain'imizden servis edilir (`/_astro/fonts/`). Subset: `latin` + `latin-ext`; Türkçe için ikisi de şarttır (ğ Ğ ş Ş İ `latin-ext`'te). Harici font CDN'i yok.

- **Big Shoulders Display** (700–800), `--font-baslik`: başlıklar, marka, skorbord sayıları, künye puanı. Dar ve yüksek; satır aralığı en az 1,04 (büyük İ'nin noktası üst satıra değmesin).
- **Literata** (400–700, normal + italik), `--font-metin`: gövde metni. Serif olduğu için satır aralığı 1,7.
- Her ikisi `<head>` içinde preload edilir.
- ğ ş ı İ Ö Ü Ç glifleri `fontTools` ile paket dosyalarında ve tarayıcıda gerçek render ile doğrulandı.

## Tip ölçeği

| Rol | Boyut | Font / ağırlık | Satır |
| --- | --- | --- | --- |
| Dev başlık (ana sayfa öne çıkan, bölüm sayfası başlığı) | `clamp(3.25rem, 1.4rem + 6.6vw, 8.5rem)` | Big Shoulders 800 | 1,04 |
| Yazı başlığı (h1) | `clamp(3rem, 1.6rem + 5.4vw, 6.5rem)` | Big Shoulders 800 | 1,04 |
| Ara başlık (h2) | `clamp(2rem, 1.6rem + 1.6vw, 2.75rem)` | Big Shoulders 800 | 1,06 |
| Liste başlığı (h3) | `clamp(1.75rem, 1.4rem + 1.2vw, 2.375rem)` | Big Shoulders 700 | 1,04 |
| Skorbord sayısı | `clamp(3rem, 2rem + 3vw, 5rem)` | Big Shoulders 800 | 0,95 |
| Gövde | 1,1875 rem (19 px) | Literata 400 | 1,7 |
| Özet / lede | 1,3125 rem | Literata 400 | 1,5 |
| Küçük (tarih, etiket, altyazı) | 0,875–0,9375 rem | Literata 400 | 1,5 |

Gövde satırı en fazla `68ch`; `hyphens: auto` (`lang="tr"`). Başlıklarda `hyphens: manual`. Metin sola yaslı; ortalı yalnızca sinema yazısının jenerik bloğu.

## Düzen

```
Ana sayfa
┌──────────────────────────────────────────────────┐
│ Göktürk Fulser              Sinema Basketbol ... │
├──────────────────────────────────────────────────┤
│ DÜZ RENK ALANI (en yeni yazının dünyası)         │
│ Pick and roll’un          ┌──────────────┐       │
│ sadeliği (dev)            │ kapak        │       │
│ özet, tarih, bölüm        └──────────────┘       │
├──────────────────────────────────────────────────┤
│ Önceki yazılar                                   │
│ ▌28 Eylül 2026  Sezon açılışı: Ritim savaşı      │
│ ▌Basketbol      özet                             │
│ ▌14 Eylül 2026  Paris, Texas: ...   (kronolojik) │
├──────────────────────────────────────────────────┤
│ YÜZEY ALANI: Öne çıkan projeler (en çok 2)       │
│ ┌────────────────────┐   ┌──────────────┐        │
│ │ Kelime Avı (büyük) │   │ Dakika       │ aşağı  │
│ └────────────────────┘   └──────────────┘ kayık  │
└──────────────────────────────────────────────────┘

Sinema yazısı
┌──────────────────────────────────────────────────┐
│ [ kapak, tam genişlik, 2,39:1 kırpılmış ]        │
│ TURKUAZ jenerik alanı (ortalı):                  │
│        Paris, Texas: Konuşamayan bir             │
│           adamın yolculuğu                       │
│              Film      │ Paris, Texas            │
│          Yönetmen      │ Wim Wenders             │
│               Yıl      │ 1984                    │
│            Puanım      │ 4,5 / 5                 │
│        özet, tarih                               │
├──────────────────────────────────────────────────┤
│ gövde (68ch, sola yaslı)    MDX bileşenleri      │
│ #etiketler                                       │
└──────────────────────────────────────────────────┘

Basketbol yazısı
┌──────────────────────────────────────────────────┐
│ TURUNCU alan: başlık (dev, sola), özet           │
│ Sezon / Takımlar / Oyuncular (varsa)             │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 64      %41        %27   ← skorbord (frontmatter)│
│ [ kapak 2:1 ]                                    │
│ gövde (68ch)                                     │
└──────────────────────────────────────────────────┘
```

- Kronolojik liste kart grid'i değildir: tarih/bölüm solda, başlık ve özet sağda; satırın dünyası 10 px'lik kalın sol bantla anlaşılır.
- Bölüm sayfaları (`/sinema/`, `/basketbol/`) dünyasının düz renk alanıyla başlar, altında aynı liste satırları gelir.
- Basketbol başlığındaki istatistik satırı `istatistik` frontmatter alanından beslenir (`etiket` + `deger`, en çok 6); alan yoksa satır çizilmez. Sezon/takım/oyuncu bilgisi de aynı şekilde yalnızca varsa görünür.
- Sinema başlığındaki künye: film adı (varsa orijinal adı), yönetmen, yıl, puan (`puan` yoksa satır yok).

## Cesaretin harcandığı tek yer

**Düz renk alanları**: ana sayfada en yeni yazının dünyasına ait dev başlıklı alan, bölüm sayfalarında ve yazı başlıklarında aynı alanlar. Gradient yok, gölge yok; yalnızca düz turkuaz ya da turuncu ve içinde dev Big Shoulders. Geri kalan her şey nötr ve sakin kalır.

## MDX bileşenleri

`render(entry)` ile birlikte `<Content components={mdxBilesenleri} />` verilir (`src/components/mdx/`); yazıda import gerekmez. Görseller `./dosya.jpg` ile içe aktarılır.

| Bileşen | Kullanım |
| --- | --- |
| `Alinti` | `<Alinti kaynak="…">metin</Alinti>`; düz `> alıntı` aynı görünür |
| `Gorsel` | `<Gorsel src={foto} alt="…" altyazi="…" />` |
| `IkiGorsel` | `<IkiGorsel sol={a} solAlt="…" sag={b} sagAlt="…" altyazi="…" />`; mobilde alt alta |
| `IstatistikTablosu` | `<IstatistikTablosu baslik="…" sutunlar={[…]} satirlar={[[…]]} />`; `caption`, `scope`, sayılar sağa yaslı, dar ekranda yatay kaydırılır (klavyeyle odaklanabilir) |

Anlam taşıyan görselde gerçek `alt` yazılır; süs görselde (`kapak`, vitrin görseli) `alt=""` kullanılır.

## Projeler

- `/projeler/` kart grid'i değil, liste: solda görsel (4:3), sağda ad (h2), özet, teknoloji listesi (düz yazı, aralıklı), `Tür` ve `Durum` `dl` olarak. Üstte türe göre süzgeç bağlantıları (sayılarıyla; boş türler görünmez).
- Sıra: arşiv en sonda ve sade (yalnızca ad + özet satırı, görselsiz); önce `oneCikan`, sonra `sira`.
- `Yakında` projelerde liste satırında ve detayda ince bir not bloğu (kalın turuncu sol bant); "Yayında" olmayan şey asla canlı bağlantıyla sunulmaz. `demoVideo` varsa detayda kapak yerine video öne çıkar.
- Gömülü oyun: kapak görseli + büyük "Oyna" bağlantısı; tıklanınca sandbox'lı iframe, "Tam ekran" ve "Oyunu kapat" düğmeleri. Düğmeler 3 px mürekkep çerçeveli, köşesiz; "→" yok.
- Projeler bir dünyaya ait değildir: gövde başlıkları ve bağlantıları nötr (mürekkep) tondadır (`data-dunya="proje"`).

## Arama

`/arama/` ayrı bir sayfadır (menüde "Ara"); arayüz Pagefind'ın hazır UI'ıdır, site token'larına CSS değişkenleriyle bağlanır, metinleri Türkçedir. Arama kodu yalnızca bu sayfada yüklenir; diğer sayfalarda arama için JS yoktur.

## Okuma süresi, TMDB ve künye

- Okuma süresi tarihin altında ayrı satır: "3 dakikalık okuma".
- TMDB verisi varsa sinema jeneriğinde afiş (10 rem, 2:3) künyenin soluna gelir; süre ve tür satırları eklenir. Veri yoksa jenerik aynen eski haliyle çalışır.
- Footer'da TMDB atıf cümlesi her sayfada bulunur.

## Hareket

- Sayfa geçişleri yalnızca **native CSS view transitions** (`@view-transition { navigation: auto }`); JS yok. `prefers-reduced-motion: reduce` altında kapalı.
- Scroll animasyonu, kayarak gelen bölüm, parallax yok. Hover'da yalnızca alt çizgi değişir.

## Yasaklar

1. Krem zemin + kiremit/toprak rengi vurgu.
2. Siyah zemin + tek neon renk.
3. Gazete stili kıl çizgiler ve sıfır radius.
4. Aynı yuvarlak kartlardan oluşan grid.
5. Her şeyin altında aynı gri gölge.
6. Gradient süsler (placeholder görseller de düz renk).
7. Başlık üstünde büyük harf etiketler.
8. "A · B · C" meta satırları (meta bilgisi ayrı satır, `dl` ya da ayrı öğe olarak verilir).
9. Buton ve link sonlarında "→".
10. Küçük etiketlerde monospace.
11. İçerik sıra değilse 01/02/03 numaralandırma.
12. Başlıkta tek kelimeyi farklı renk veya italik yapmak.
13. Her bölüme kayarak gelen animasyon.

## Erişilebilirlik tabanı (tasarımla ilgili kısım)

- Görünür klavye odağı: 3 px halka. Renkli alanların içinde halka alan metni renginde (`.alan-zemin`), çünkü turuncu üstünde turuncu halka 3:1'in altında kalıyordu.
- İlk Tab "İçeriğe geç" bağlantısını gösterir; menü ve satır bağlantıları mantıklı sırada.
- Metin kontrastı ≥ 4,5:1 (iki modda, ana sayfa + iki yazı tipi taranıp ölçüldü); UI öğeleri ≥ 3:1.
- Dokunma hedefleri menüde ≥ 44 px yükseklik; mobilde menü tek satır.

## Kontrast ölçümleri

| Çift | Oran |
| --- | --- |
| Açık: mürekkep / zemin | 16,25 |
| Açık: soluk / zemin | 7,19 |
| Açık: turkuaz-metin / zemin | 6,89 |
| Açık: turuncu-metin / zemin | 5,58 |
| Beyaz / turkuaz alan | 7,47 |
| Mürekkep / turuncu alan | 5,15 |
| Koyu: soluk / zemin | 8,28 |
| Koyu: turkuaz-metin / zemin | 9,00 |
| Koyu: turuncu-metin / zemin | 8,93 |
| Turuncu bant / zemin (UI, açık) | 3,15 |

## Tasarım sürecinde alınan kararlar

- Turuncu metin zeminde 3,15:1 çıktı; metin için ayrı koyu ton, turuncu yalnızca dolgu.
- Bölüm adı başlık üstünde etiket olarak verilmez; renk + kalın sol bant, adı ise tarihin altında düz yazı.
- Ana sayfadaki ilk fikir (yarı yarıya iki alan) yerine, kronolojik liste istendiği için tek alan en yeni yazının dünyasını taşır.
- Sinema başlığında jenerik düzeni ortalı; gövdede ortalama yok.
- Placeholder görseller düz renk; düz `'` yerine ’ kullanılır.
- Renkli alanlarda odak halkası alan metni rengine alındı (ölçülerek bulunan sorun).
