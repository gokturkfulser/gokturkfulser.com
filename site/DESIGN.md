# site/DESIGN.md — "Gece seansı"

Bu dosya bağlayıcıdır. Seçilen yön: **Yön 1 "Gece seansı"**: koyu bantlar sinema salonu, açık bantlar parke; sinema turkuaz, basketbol turuncu vurgu; dev, sıkı aralıklı başlıklar; tek tip link stili. Eski "Teal & Orange" yönü ve değerlendirilen ikinci yön ("Sahada") kaldırıldı. Token'lar `src/styles/tokens.css`'te, fontlar `astro.config.mjs` → `fonts`'ta; bu dosyadaki değer değişmeden orada değişmez.

Site okuma ağırlıklı ve Türkçe: ilk iş yazıyı rahat okutmak, ikinci iş projeleri öne çıkarmaktır.

İçindekiler: Neden Yön 1 · Referans analizi · Ortak sistem · Yön 1 (renk, font, ölçek, bant ritmi, medya, link, hareket) · Hero · Yasaklar · Erişilebilirlik · Kalıcı bölümler · Önizleme.

---

## Neden Yön 1

Koyu/açık bant dönüşümü sinema salonu ile okuma masası arasındaki ritmi sayfanın kendisine taşıyor; sinema ve basketbol aynı sistemde iki vurgu olarak yaşıyor (turkuaz/turuncu, her ikisi de iki bantta ayrı tonla kontrast ≥ 4,5:1). Tek ton + gren + vinyet medya kuralı TMDB backdrop'larında (sinema kareleri) en güçlü sonucu veriyor; yer tutucular ve görselsiz yedek kapaklar da aynı dilde kalıyor. Dev başlık + sıkı harf aralığı referansın "tipografi taşır" ilkesini bizim fontumuzla ve kendi (serif gövde, iki vurgu) kimliğimizle uyguluyor. Ayrıntılı karşılaştırma önceki sürümlerde yapıldı; yeniden açılmaz.

---

## Referans analizi

Kaynak: mertkayacs.com (1440 ve 390 px; ana sayfa, `/work/`, `/about/`). Ekran görüntüleri: `site/ekran-goruntuleri/referans/` (yerel kanıt; repo'ya girmez). Ölçümler tarayıcıdan okunan hesaplanmış stillerdir. **Referanstan görsel, metin, logo, portre, ikon, font dosyası ya da kod alınmadı; layout klonlanmadı.** Aşağıda yalnızca *neden iyi çalıştığı* ve alınan *ilke* yazılır.

| Konu | Referansta ölçülen | Neden işe yarıyor | Bizde alınan ilke |
| --- | --- | --- | --- |
| **Tip ölçeği** | Tek aile (Inter Tight), 17 px gövde. Bölüm başlığı 98 px (satır 0,94), hero 130 px (0,88), proje adı 68 px, kart başlığı 34 px (1,08), ara başlık 27–48 px. Mobilde 62 / 44 / 31 px. | Gövde ile başlık arasında 6× fark: hiyerarşi renkle değil boyutla kurulur. Aileler değişmez, yalnızca boyut ve ağırlık değişir. | Başlık/gövde oranı ≥ 5×; başlıklar mobilde de dev kalır (hero 62 px). |
| **Harf aralığı** | Başlıklarda −0,06 em (hero −0,065, ara başlık −0,035, küçük −0,025). Ağırlık 650–720. Gövde 0. | Boyut büyüdükçe aralık orantılı sıkışır; başlıklar tek parça blok gibi okunur. | Aralık boyutla ölçeklenir: dev −0,055…−0,06 em, orta −0,04…−0,05, küçük −0,03 em, gövde 0. |
| **Bant ritmi** | Koyu `#0B0B0F` → açık gri `#F5F5F7` → koyu → (açık/koyu ikili satırlar) → koyu → açık → koyu footer. Tam genişlik, dümdüz renk; geçişte gradient yok. | Ritim bölümü ayırır; kart, çerçeve, gölge gerekmez. Koyu bant "sahne", açık bant "okuma". | İki ton katı sırayla dönüşür (var olan bölümlere göre hesaplanır, boş bölüm ritmi kaydırmaz). |
| **Bölüm boşlukları** | Bant üst/alt 96 px (mobil 56); proje satırı 28; sayfa girişi 124/48. İçerik 1248 px, kenar 16–24 px. | Boşluk büyüktür ama tek ölçeğe oturur. | Bant boşluğu tek token `--bant`; proje bantları ve sayfa başı ondan türer. |
| **Medya oranları ve köşeler** | Hero proje görseli 2,31:1; iş kartları 2:1; proje ikilisi 4:3. Köşe: görselin kendisi 0, kart 20 px (1 px çerçeve + yumuşak gölge). | Az sayıda oran, hepsi aynı "elden". | Oranlar sabit listeye indi (Medya kuralı); köşe tek token. |
| **Nav davranışı** | `position: fixed`, 60 px, `rgba(11,11,15,.78)` + `backdrop-filter: saturate(1.8) blur(20px)`; açık sayfalarda da koyu. Mobilde "Menü" düğmesi (JS). | Nav içerikle yarışmaz; altındaki bant rengi bulanıklıkla sızar. | Sticky, yarı saydam, bulanık, her sayfada koyu; mobilde JS'siz `<details>` "Menü". |
| **Link stili** | Koyu bantta `#2997FF`, açık bantta `#0066CC`; sonunda "›". Metin içinde altı çizili; çizgi 0,2 sn geçişle değişir. | Tek vurgu rengi yalnızca linke ayrıldığı için "tıklanır" anında okunur. | Tek tip link; vurgu çizgisi (Apple mavisi ve "›" **alınmadı**). |
| **Hareket** | Tek eğri `cubic-bezier(.22,1,.36,1)`; link çizgisi 0,2 sn, kart hover 0,28 sn, eskizlerde scroll ile açılış (JS). | Tek eğri tüm hareketleri aynı "ele" bağlar; hareket azdır. | Tek eğri token'ı; yalnızca link çizgisi, medya yakınlaşması ve hero başlığının ilk girişi. Scroll animasyonu **alınmadı**. |

Referanstan **bilerek alınmayanlar:** gravür portre stili, Apple mavisi, "›" oku, Inter Tight, ortalı hero, bölüm adları, ikon seti, görseller, **portre fotoğrafı fikri** (sitede portre yok).

---

## Ortak sistem

### Bilgi mimarisi

| Adres | İçerik |
| --- | --- |
| `/` | Hero (ad, tek cümle, görsel taraf) · yazılar (en çok 3, `oneCikan` ya da en yeniler) · projeler (biri büyük vitrin, kalanlar iki sütun) · kısaca · sayılar (yalnızca yazı ve proje; sıfır olan gösterilmez, en az iki sayı yoksa şerit çizilmez) · son izlediklerim (varsa) · zengin footer |
| `/yazilar/`, `/yazilar/sinema/`, `/yazilar/basketbol/` | JS'siz sekmeler (her biri kendi URL'i); etiket süzgeci; yıllara göre gruplama; arama girişi (`/arama/?q=`) |
| `/yazilar/<slug>/` | Tüm yazılar tek adres uzayında; slug'lar iki koleksiyon arasında tekil. Eski `/sinema/**`, `/basketbol/**` → `public/_redirects` ile 301 |
| `/projeler/`, `/projeler/<slug>/`, `/projeler/tur/<tur>/`, `/hakkimda/` | Aynı kaldı; hakkımda'da isteğe bağlı deneyim zaman çizelgesi |

Nav: **Ana sayfa · Yazılar · Projeler · Hakkımda** + arama simgesi. Dokunma hedefleri ≥ 44 px.

### Bant sistemi ve kenar kuralı

- Her sayfa **bantlardan** oluşur: `<section class="bant bant--koyu|acik">` içinde `.kap`. Bant tam genişliktir, dümdüz renktir, dikey boşluğu `--bant` tokenıdır; sayfa başı bandı `.bant--basi` (nav'ın altında, daha az üst boşluk).
- Token adları iki bantta aynıdır, değerleri değişir: `:root` koyu bandın, `.bant--acik` açık bandın değerlerini taşır (`--zemin`, `--murekkep`, `--soluk`, `--yuzey`, `--cizgi`, `--turkuaz-metin`, `--turuncu-metin`). Bileşenler yalnızca bu adları kullanır; bant tonunu bilmezler.
- **Kenar kuralı:** `* { margin: 0 }` ve `body { margin: 0 }`; `html` ve `body` zemini koyu bant rengi (`--perde`), kaydırma çubuğu `scrollbar-color: #4b5663 #0a0d12`. Hiçbir bant, `main` ya da sarmalayıcı yatay kenar boşluğu/dolgusu taşımaz; kenar boşluğu yalnızca `.kap` içindedir. Böylece açık bantlar viewport'un iki kenarına değer, kaydırma çubuğu dışında kenarda şerit kalmaz. (Eski hata: `body` varsayılan 8 px kenar boşluğunu koruyordu ve koyu zemin açık bandın iki yanında görünüyordu.) Kontrol: her sayfa tipinde `header, main > *, footer` kutularının sol/sağ kenarı viewport'a eşit olmalı, ekran görüntüsünün ilk/son sütunu iç sütunla aynı renk olmalı.
- Aynı tonda iki bant yan yana gelirse 1 px `--cizgi` ile ayrılır.

### Medya kuralı (tek işleme kuralı)

Kaynağı ne olursa olsun (TMDB backdrop, TMDB afişi, kendi kapağı, ekran görüntüsü, proje görseli, görselsiz yedek kapak) her görsel **aynı kalıptan** geçer: `src/components/Medya.astro` + `src/styles/medya.css`. Overlay'ler pseudo-element'tir; görsele, `alt`'a, lazy yüklemeye ve `astro:assets`'e dokunmaz.

1. **Oran** — `data-oran`: `kapak` 2,39:1 (mobil 16:9) · `vitrin` 16:10 · `proje` 4:3 · `afis` 2:3 · `kare` 1:1. Görsel `object-fit: cover`; kırpma merkezde.
2. **Köşe** — tek token `--medya-kose: 6px`. Yalnızca tam genişlik kapakta 0.
3. **Renk işlemesi** — `saturate(.88) contrast(1.05) brightness(.97)` + turkuaz `soft-light` tonu (`#0E5E66`, güç .2).
4. **Gren** — SVG `feTurbulence` (data URI; CSP `img-src data:` izinli), `overlay`, güç .14.
5. **Vinyet** — kenar kararması `radial-gradient`; güç koyu bantta .40, açık bantta .30; afişte yok.
6. **Hareket** — hover'da içerik 1,025 yakınlaşır (0,5 sn, tek eğri); `prefers-reduced-motion`'da kapalı.
7. **Ekran görüntüsü/arayüz kapakları (istisna gerekmedi)** — Kural koyu/açık görseli ayırt etmez; ton ve vinyet `soft-light` olduğundan açık bir ekran görüntüsü de koyu bir fotoğraf da okunur kalır, bu yüzden renk işlemesi için istisna yoktur. Kelime Avı kapağında görülen "koyu boş panel" iki ayrı şeyin karışımıydı: (a) görsel lazy yüklenirken kalıbın `--yuzey` zemini görünür (tam sayfa ekran görüntüsü almadan önce sayfa sonuna kadar kaydırıp görsellerin yüklenmesi beklenmeli); (b) 4:3 arayüz görüntüsü 16:10'a kırpılınca karolar ve klavye kesiliyordu. Çözüm orandır, filtre değil: **proje görselleri `proje` (4:3) basılır** (ana sayfa büyük vitrini görsel + metin iki sütun; `/projeler/` satırı ve proje sayfası aynı oran); `vitrin` 16:10 yazı kartlarında kalır.
8. **TMDB backdrop** — `tmdb-fetch.ts` afişin yanında `w1280` backdrop'u da çeker (`src/data/tmdb/arkaplan/`; `surum: 2` ile eski kayıtlar bir kez yenilenir). Sinema yazısında `kapak` yoksa backdrop `kapak` oranında kapaktır.

> Gradient yasağı (#6) ile ilişkisi: vinyet ve hero SVG sahnesindeki ışık/derinlik **görüntü işlemesi/illüstrasyondur**, süs değil; yalnızca `.medya-kalip` ve hero görselinin içinde kullanılır, arka plan, başlık ya da düğme süsü olarak asla.

### Görselsiz yedek kapak

Kapağı olmayan yazılar için (`KapakYedek.astro`; statik inline SVG, JS yok, `.medya-kalip` kalıbından geçer, 2,39:1; kart/liste küçük resimlerinde aynı bileşen 16:10'a kırpılır):

- **Basketbol (turuncu varyant):** koyu zemin üstünde saha çizgileri (orta çember, orta çizgi, üçlük çizgisi, boyalı alan) turuncu `#FF7A2F`; büyük tipografik öğe `sezon`, yoksa `istatistik[0]` değeri, yoksa yayın yılı.
- **Sinema (turkuaz varyant):** sol altta projektör, sağa açılan düz renkli üç ışık kaması (turkuaz, kademeli opaklık) ve toz; alt/üst kenarda film delikleri; büyük tipografik öğe film yılı.
- Yedek **süstür**: yazının başlığı ve künyesi zaten başlıkta bulunur, bu yüzden SVG `aria-hidden`'dır.
- Sıra: kendi `kapak` → TMDB backdrop (yalnızca sinema) → yedek.

### Sekmeler, etiketler, bölüm başlıkları

- **Sekmeler** (`.sekmeler`, yazılar ve projeler): tek satır, `flex-wrap: nowrap`, dar ekranda yatay kayar (`overflow-x: auto`, kaydırma çubuğu gizli, bağlantılar klavyeyle odaklanır ve odak görünür kalır); mobilde boyut `1.25rem`'e iner, kenar boşluğundan taşarak kaydırılabilir olduğu belli olur. Geçerli sekme 3 px vurgu çizgisi + tam metin rengi; diğerleri `--soluk`.
- **Etiketler** (`.etiketler`, `.etiket-listesi`): gövdeden bir basamak küçük (`0.875rem`), `--soluk`; link çizgisi dinlenme hâlinde saydam, yalnızca hover/odakta vurgu çizgisi çıkar ve metin `--murekkep`'e döner.
- Bölüm başlığı satırı (`.bas-satiri`): başlık solda, "Tüm …" bağlantısı sağda.

### Ortak tip kuralları

- Başlıkta `hyphens: manual`, gövdede `hyphens: auto` (`lang="tr"`); `text-wrap: balance` başlıklarda, `pretty` paragraflarda.
- **Başlık satır aralığı ≥ 0,96** ve yalnızca iki satırlı dev ad/başlıkta; büyük **İ**'nin noktası üst satıra değmesin. `ĞÜŞİÖÇ`, `İstanbul` gerçek render ile doğrulandı.
- Gövde satırı en çok 68 karakter (yazı kolonu 46 rem).

---

## Yön 1 — "Gece seansı"

### Renkler (`tokens.css`)

| Ad | Hex | Rol |
| --- | --- | --- |
| Perde (koyu bant) | `#0A0D12` | koyu bant zemini, footer, nav (`html`/`body` zemini) |
| Perde-2 | `#121820` | koyu yüzey (medya zemini, bilet) |
| Parke (açık bant) | `#E8E7E2` | açık bant zemini (soğutulmuş meşe; krem/toprak **değil**) |
| Parke-2 | `#F3F2EE` | açık yüzey |
| Metin, koyu bant | `#EEF1F4` | ana metin; lede `#C4CCD5` |
| Soluk, koyu bant | `#9AA5B1` | ikincil metin |
| Metin, açık bant | `#12161C` | ana metin; lede `#3A434D` |
| Soluk, açık bant | `#4B5560` | ikincil metin |
| Turkuaz, koyu bant | `#3FC8CF` | sinema vurgusu (metin, çizgi, nokta) |
| Turkuaz, açık bant | `#0E5E66` | sinema vurgusu (metin); alan dolgusu da `#0E5E66` |
| Turuncu, koyu bant | `#FF7A2F` | basketbol vurgusu |
| Turuncu, açık bant | `#A8430A` | basketbol vurgusu (metin); dolgu `#E2661A` yalnızca dolgu için |
| Çizgi | `#27303B` (koyu) / `#CBC9C0` (açık) | ayraç |

Mod anahtarı yok: yön iki tonu aynı sayfada taşır; `prefers-color-scheme` etkisizdir (`color-scheme`, koyu bantta `dark`, açık bantta `light`).

Dünya seçimi `data-dunya="sinema|basketbol|proje"` ile yapılır; bileşenler `--dunya`, `--dunya-metin`, `--dunya-bant`, `--dunya-alan-metin`, `--vurgu` değişkenlerini okur; hepsi bant tonuna göre çözülür.

### Fontlar

Astro Fonts API, `latin` + `latin-ext` (kendi domain'imizden; harici CDN yok). **Türkçe glifler gerçek tarayıcı render'ı ile doğrulandı**: `ĞÜŞİÖÇ ğüşıöç`, `İstanbul Işık Öğrenci`, `“Çağdaş sinema” — ‘gün’ 4,5 / 5 …` (başlık ve gövde, italik dahil) tofusuz; `ğ ş İ` latin-ext, `ı ç ö ü` latin alt kümesindedir (`fontTools` ile de doğrulandı). OG görselleri için `@fontsource/bricolage-grotesque` ve `@fontsource/newsreader` (statik woff; Satori woff2 okumaz; latin ve latin-ext ayrı aile adıyla).

- **Bricolage Grotesque** (500–800, değişken), `--font-baslik`: başlıklar, nav, etiket, künye, skor. Referansın nötr, kapalı grotesk duruşundan çok daha karakterli.
- **Newsreader** (400–700 + italik), `--font-metin`: yazı gövdesi (serif; uzun okuma için).

### Tip ölçeği ve harf aralıkları

| Rol | Boyut | Ağırlık | Satır | Aralık |
| --- | --- | --- | --- | --- |
| Hero ad (`dev`) | `clamp(4rem, .5rem + 14.5vw, 13rem)` | 800 | 0,96 | −0,058 em |
| Sayfa başlığı (`h1`) | `clamp(3.5rem, 1rem + 11vw, 10rem)` | 800 | 0,98 | −0,055 em |
| Bölüm başlığı (`h2`) | `clamp(2.75rem, 1.2rem + 6vw, 7rem)` | 800 | 1,0 | −0,05 em |
| Kart başlığı (`h3`) | `clamp(1.625rem, 1.1rem + 1.7vw, 2.5rem)` | 700 | 1,08 | −0,03 em |
| Lede | `clamp(1.25rem, 1rem + 1vw, 1.875rem)` | 400 | 1,32 | −0,02 em |
| Yazı gövdesi | 1,3125 rem (21 px) Newsreader | 400 | 1,65 | 0 |
| Küçük (tarih, etiket) | 0,875–0,9375 rem Bricolage | 500 | 1,45 | +0,005 em |
| Sayılar | `clamp(3.75rem, 1rem + 10vw, 9.5rem)` | 800 | 0,92 | −0,06 em |

### Bant ritmi

Ana sayfa: **koyu** hero → **açık** yazılar → **koyu** projeler → **açık** kısaca (yalnızca `KISACA_METNI` doluysa) → **koyu** sayılar → **açık** son izlediklerim → **koyu** footer (var olan bölümlere göre dönüşüm hesaplanır). İç sayfalar koyu sayfa başı bandıyla açılır, açık liste/gövde bandıyla devam eder. Yazı sayfası: koyu tam genişlik kapak (köşe 0) → koyu jenerik (ortalı başlık, künye, afiş) → açık gövde; basketbol yazısı: koyu başlık + skorbord → koyu inset kapak → açık gövde. Projeler listesi: koyu başlık → her proje için dönüşümlü açık/koyu bant → arşiv.

### Link stili (tek tip)

Her bağlantı: metin rengi, **vurgu renkli alt çizgi** (1,5 px, `text-underline-offset: .22em`), hover/odakta 3 px; vurgu rengi bağlamdan gelir (`--vurgu`: dünya ya da bantın turkuazı). İstisna kural değil, aynı stilin dinlenme hâli: menü, marka, başlık, sekme ve etiket bağlantılarında çizgi dinlenmede saydamdır; hover, odak ve `aria-current`'te aynı çizgi çıkar. "→" ve "›" yok.

### Hareket

Tek eğri `cubic-bezier(.22,1,.36,1)`: link çizgisi 0,2 sn, medya yakınlaşması 0,5 sn, hero adı ilk yüklemede 0,9 sn yukarıdan gelir (tek giriş animasyonu). Sayfa geçişleri yalnızca CSS `@view-transition`. Scroll animasyonu, parallax, kayarak gelen bölüm yok. `prefers-reduced-motion: reduce` hepsini kapatır.

---

## Hero

Hero: koyu bant; solda ad (`dev`, iki satır), varsa tek cümle (lede) ve iki bağlantı ("Yazılara git", "Projelere git"); sağda **SVG sahne, ad bloğuyla aynı yükseklikte** (grid `align-items: stretch`). Mobilde sahne adın üstünde, tam genişlikte. **Portre fotoğrafı yok.**

Sahne (`HeroSahne.astro`) her zaman aynıdır: projektör ışığının basketbol sahasının orta çemberine düştüğü inline SVG; turkuaz ışık, turuncu saha çizgileri; yumuşak ışık, toz, gren, derinlik. Harici görsel ve JS yok, `aria-hidden`. Build gününe göre ışığın yönü, açısı ve toz dağılımı değişir (aynı gün aynı çıktı). "Son seans" paneli ve bilet/skorbord seçenekleri denendi, elendi.

Lede isteğe bağlıdır: `src/lib/site.ts` içindeki `HERO_CUMLESI` boşken hiç render edilmez (boş paragraf ya da boşluk kalmaz), doldurulunca kendiliğinden görünür. Aynı şekilde `KISACA_METNI` boşken "Kısaca" bölümü hiç yoktur ve bant ritmi kalan bölümlere göre yeniden hesaplanır (arka arkaya iki aynı ton gelmez).

---

## Yasaklar

1. Krem zemin + kiremit/toprak rengi vurgu. *(Parke soğutulmuş nötr gridir `#E8E7E2`; vurgular turkuaz/turuncu, toprak tonu yok.)*
2. Siyah zemin + tek neon renk. *(Sayfanın tamamı siyah değildir: koyu ve açık bantlar dönüşür ve iki ayrı vurgu rolü vardır.)*
3. Gazete stili kıl çizgiler ve sıfır radius. *(1 px çizgi yalnızca liste/bant ayracıdır, dekor değil; sıfır radius yalnızca tam genişlik kapakta, medya ve düğmede köşe tokendir.)*
4. Aynı yuvarlak kartlardan oluşan grid. *(Kart yok: proje ve yazılar tam genişlik bant ya da satır; vitrinlerde biri büyük, diğerleri küçük.)*
5. Her şeyin altında aynı gri gölge. *(Gölge yok.)*
6. Gradient süsler (placeholder görseller de düz renk). *(Gradient yalnızca **görüntü işlemesi/illüstrasyon** olarak serbesttir: medya vinyeti ve hero SVG sahnesi; arka plan, başlık, düğme süsü olarak yasaktır. Yer tutucu görseller düz renkli kalır.)*
7. Başlık üstünde büyük harf etiketler.
8. "A · B · C" meta satırları (meta bilgisi ayrı satır, `dl` ya da ayrı öğe olarak verilir).
9. Buton ve link sonlarında "→" (referansın "›" oku da dahil).
10. Küçük etiketlerde monospace.
11. İçerik sıra değilse 01/02/03 numaralandırma.
12. Başlıkta tek kelimeyi farklı renk veya italik yapmak.
13. Her bölüme kayarak gelen animasyon.
14. Medya kuralından geçmemiş ham görsel (oran, köşe, işleme, gren dışında kalmış görsel).
15. İkinci bir link stili; vurgu rengini bağlantı dışında metin vurgusu için kullanmak.
16. Referanstan türeyen unsurlar: gravür portre, Apple mavisi, Inter Tight, ortalı hero kompozisyonu birebir.
17. Bir bandın yatay kenar boşluğu/dolgusu taşıması ya da `body`'de varsayılan kenar boşluğu bırakmak (bkz. Kenar kuralı).

---

## Erişilebilirlik tabanı (tasarımla ilgili kısım)

- Görünür klavye odağı: 3 px halka, vurgu renginde (bant tonuna göre kontrast ≥ 3:1).
- İlk Tab "İçeriğe geç" bağlantısını gösterir; sıra mantıklı: marka, menü, arama, sayfa içeriği, footer. Mobil menü `<details>`: klavye (Enter/Space) ve ekran okuyucuyla doğal çalışır. Sekmeler yatay kaydırılır ama her bağlantı odaklanabilir.
- Metin kontrastı ≥ 4,5:1 (büyük metin ≥ 3:1); UI ≥ 3:1. Dokunma hedefleri ≥ 44 px.
- `prefers-reduced-motion: reduce` tüm geçiş ve animasyonları kapatır.
- Süs görseller `alt=""`; görselsiz yedek kapak ve hero SVG'si `aria-hidden`.

### Kontrast ölçümleri (WCAG, hesaplanmış)

| Çift | Oran |
| --- | --- |
| Koyu: metin `#EEF1F4` / `#0A0D12` | 17,16 |
| Koyu: soluk `#9AA5B1` / perde | 7,78 |
| Koyu: lede `#C4CCD5` / perde | 11,99 |
| Koyu: turkuaz `#3FC8CF` / perde | 9,61 |
| Koyu: turuncu `#FF7A2F` / perde | 7,48 |
| Açık: ink `#12161C` / parke `#E8E7E2` | 14,66 |
| Açık: soluk `#4B5560` / parke | 6,13 |
| Açık: turkuaz `#0E5E66` / parke | 6,03 |
| Açık: turuncu-metin `#A8430A` / parke | 4,88 |
| Açık: turuncu dolgu `#E2661A` / parke | 2,76 → **metin değil, yalnızca dolgu** |

Ek olarak 15 sayfa tipi × 2 görünüm (1440, 390) için hesaplanmış stillerden otomatik taranan her metin düğümü (etkin arka plan katmanlanarak) eşiğin üstünde çıktı.

---

## Kalıcı bölümler (yönden bağımsız)

### MDX bileşenleri

`render(entry)` ile birlikte `<Content components={mdxBilesenleri} />` verilir (`src/components/mdx/`); yazıda import gerekmez. Görseller `./dosya.jpg` ile içe aktarılır.

| Bileşen | Kullanım |
| --- | --- |
| `Alinti` | `<Alinti kaynak="…">metin</Alinti>`; düz `> alıntı` aynı görünür |
| `Gorsel` | `<Gorsel src={foto} alt="…" altyazi="…" />` |
| `IkiGorsel` | `<IkiGorsel sol={a} solAlt="…" sag={b} sagAlt="…" altyazi="…" />`; mobilde alt alta |
| `IstatistikTablosu` | `<IstatistikTablosu baslik="…" sutunlar={[…]} satirlar={[[…]]} />`; `caption`, `scope`, sayılar sağa yaslı, dar ekranda yatay kaydırılır (klavyeyle odaklanabilir) |

Anlam taşıyan görselde gerçek `alt` yazılır; süs görselde (`kapak`, vitrin görseli) `alt=""` kullanılır.

### Projeler

- `/projeler/`: koyu sayfa başı (başlık, lede, tür sekmeleri sayılarıyla), her proje için dönüşümlü açık/koyu bant (görsel, ad, özet, teknoloji, `Tür`/`Durum` `dl`, "Projeyi incele"); arşiv en sonda sade. Sıra: arşiv en sonda; önce `oneCikan`, sonra `sira`.
- `Yakında` projelerde ince not bloğu (turuncu sol çizgi); "Yayında" olmayan şey asla canlı bağlantıyla sunulmaz. `demoVideo` varsa detayda kapak yerine video öne çıkar.
- Gömülü oyun: kapak + büyük "Oyna" düğmesi; tıklanınca sandbox'lı iframe, "Tam ekran" ve "Oyunu kapat" düğmeleri (hap biçimli, 2 px çerçeve).
- Projeler bir dünyaya ait değildir: `data-dunya="proje"` nötr tonlar.

### Arama

`/arama/` ayrı sayfa (nav'da arama simgesi; `/arama/?q=` ile `/yazilar/` arama girişinden gelir); arayüz Pagefind'ın hazır UI'ı, site token'larına CSS değişkenleriyle bağlı, metinler Türkçe; kod yalnızca bu sayfada yüklenir.

### Okuma süresi, TMDB ve künye

- Okuma süresi tarihin altında ayrı satır: "3 dakikalık okuma".
- TMDB verisi varsa sinema jeneriğinde afiş (medya kuralı, 2:3) künyenin soluna gelir; süre ve tür eklenir. Backdrop kapak yedeğidir. Footer'da TMDB atıf cümlesi her sayfada bulunur.

---
