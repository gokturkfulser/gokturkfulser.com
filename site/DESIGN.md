# site/DESIGN.md — "Karanlık salonda basılı sayfa"

Bu dosya bağlayıcıdır. Yön: **koyu salon** (sinematik tam genişlik görüntü, jenerik düzeni) içinde **kâğıt bandı** (okuma alanı basılı sayfa: çerçeve, çift çizgi, künye). Sinema turkuaz, basketbol turuncu. Başlıkta Cormorant (yalnızca koyu bantta ve ≥ 24 px), geri kalan her yerde Hanken Grotesk. Token'lar `src/styles/tokens.css`'te, fontlar `astro.config.mjs` → `fonts`'ta; bu dosyadaki değer değişmeden orada değişmez.

Site okuma ağırlıklı ve iki dilli (İngilizce varsayılan, Türkçe `/tr/`): ilk iş yazıyı rahat okutmak, ikinci iş projeleri öne çıkarmaktır.

İçindekiler: Ortak sistem · Fontlar ve ölçek · Renkler ve kontrast · Medya kuralı · Hero ve koyu bant okunabilirliği · Sayfalar · Hareket · Link · Yasaklar · Erişilebilirlik · Kalıcı bölümler · Geçmiş.

---

## Ortak sistem

### Bilgi mimarisi

| Adres | İçerik |
| --- | --- |
| `/` | Kapak (tam ekran sahne, ad, "kapak satırları": öne çıkan yazı ve proje) · projeler (dikey çerçeveler) · yazılar (öne çıkan yazı tam genişlik sahne + yan kartlar) · kısaca · sayılar (yazı ve proje; sıfır olan gösterilmez, en az iki sayı yoksa şerit çizilmez) · son izlediklerim (yavaş akan afiş bandı, varsa) · footer |
| `/yazilar/` (en: `/writing/`; tr: `/tr/yazilar/`), `…/sinema/` (en: `/writing/cinema/`), `…/basketbol/` (en: `/writing/basketball/`) | Manşet (en yeni yazı, tam genişlik görüntü üstünde sayfa başlığı) · JS'siz sekmeler (her biri kendi URL'i), arama girişi (`/search/?q=`, `/tr/arama/?q=`), etiket süzgeci · bölüm girişleri (Sinema turkuaz, Basketbol turuncu çizgili) · yıllara göre yazı satırları; iki dilin yazıları da listelenir, sayfanın dilinde olmayanlar küçük dil etiketi taşır |
| `/writing/<slug>/` · `/tr/yazilar/<slug>/` | Her yazı yalnızca kendi dilinin ağacında yaşar; slug dil başına tekil (iki koleksiyon arasında da). Eski Türkçe kök adresler ve `/sinema/**`, `/basketbol/**`, `/en/**` → `public/_redirects` ile 301 |
| `/projects/`, `/projects/type/<type>/` · `/tr/projeler/`, `/tr/projeler/tur/<tur>/` | Dev proje dizini (hover önizlemeli), arşiv en sonda sade |
| `/projects/<slug>/` · `/tr/projeler/<slug>/` | **Vaka çalışması düzeni, tüm projelerin varsayılanı** (slug iki dilde aynı) |
| `/about/` · `/tr/hakkimda/` | Sayfanın kendisi özgeçmiş (`src/content/ozgecmis.yaml`); `taslak: true` iken production'da "hazırlanıyor" |

Nav: **Ana sayfa · Yazılar · Projeler · Hakkımda** (dile göre: Home · Writing · Projects · About) + **EN / TR dil anahtarı** + arama simgesi (nav bağlantıları ve dil düğmesi her durumda görünür; mobilde "Menü" düğmesinin yanında). Dil anahtarı tek bir `<a>`dır (gezinme bağlantısı; `role="switch"` değil): tek ince çerçeveli hap, içinde EN ve TR yan yana, aktif dilin altında dolgulu "başparmak" (aktif etiket başparmak üstünde koyu, pasif soluk). Hover/odakta başparmak diğer dile doğru hafifçe esner (`scaleX(1.14)`); başparmağın sabit `view-transition-name: dil-kaydirak`'i sayesinde sayfa değişirken yeni konumuna kayar (cross-document View Transitions, saf CSS; desteklemeyen tarayıcıda animasyonsuz çalışır). `aria-label` hedef dilde ("Türkçe'ye geç" / "Switch to English"), `hreflang` ve `lang` hedef dildedir; görünür hap 36 px, tıklanabilir alan pseudo-öğeyle 44 px, odak halkası 3 px; `prefers-reduced-motion`'da esneme ve kayma yoktur. Dokunma hedefleri ≥ 44 px. Üst çubuk her zaman koyudur ve sayfayla kayar (sabit değil); görselli sayfa başlarında (`<Base bindirme>`) ilk bandın üstüne biner.

### Bantlar ve kenar kuralı

- Her sayfa **bantlardan** oluşur: `<section class="bant bant--koyu|acik">` içinde `.kap`. Bant tam genişliktir, dümdüz renktir, dikey boşluğu `--bant` tokenıdır; sayfa başı bandı `.bant--basi`.
- **Koyu bant** (`:root` değerleri) sinema salonudur: kapak, yazı kapakları, manşet, bölüm girişleri, proje dizini, vaka üstü, footer. **Kâğıt bandı** (`.bant--acik`) basılı sayfadır: yazı gövdesi, vaka modülleri, özgeçmiş. Koyu ↔ kâğıt geçişi **sert bant değişimidir**; aralarında gradient yoktur.
- Token adları iki bantta aynıdır, değerleri değişir (`--zemin`, `--murekkep`, `--soluk`, `--yuzey`, `--cizgi`, `--turkuaz-metin`, `--turuncu-metin`, `--font-bas`, `--bas-agirlik`). Bileşenler yalnızca bu adları kullanır; bant tonunu bilmezler.
- **Kâğıt bandı baskı detayları** (bilgi taşır, süs değil): 1 px **çerçeve** (bandın içinde 0,55 rem içeride) ve üstte **çift çizgi** (bölüm başlangıcı); künye kenar notu 3 px dünya renkli üst çizgiyle başlar.
- **Kenar kuralı:** `* { margin: 0 }` ve `body { margin: 0 }`; `html` ve `body` zemini koyu bant rengi (`--perde`). Hiçbir bant, `main` ya da sarmalayıcı yatay kenar boşluğu/dolgusu taşımaz; kenar boşluğu yalnızca `.kap` içindedir. Kontrol: her sayfa tipinde `header, main > *, footer` kutularının sol/sağ kenarı viewport'a eşit olmalı.
- **Sol dikey ray yok.** Denendi (nokta, dikey ad, bölüm adı); içeriği daraltıyor ve bilgi taşımıyordu, kaldırıldı. İçerik tam genişliğe yayılır.
- Aynı tonda iki bant yan yana gelirse 1 px `--cizgi` ile ayrılır.

---

## Fontlar ve ölçek

Astro Fonts API, `latin` + `latin-ext` (kendi domain'imizden; harici CDN yok). **Türkçe glifler gerçek tarayıcı render'ı ile doğrulandı** (`ĞÜŞİÖÇ ğüşıöç`, `İstanbul Işık Öğrenci`, `“Çağdaş sinema” — ‘gün’ 4,5 / 5`, başlık ve gövde tofusuz; `ğ ş İ` latin-ext, `ı ç ö ü` latin). OG görselleri için `@fontsource/cormorant` ve `@fontsource/hanken-grotesk` (statik woff; Satori woff2 okumaz; latin ve latin-ext ayrı aile adıyla).

- **Cormorant** (500–600), `--font-serif-yigin`: dev başlıklar, kart/sahne başlıkları, lede, jenerik değerleri, skorbord ve sayı rakamları.
- **Hanken Grotesk** (400–700, değişken), `--font-metin-yigin` = `--font-baslik-yigin`: gövde, nav, meta, etiket, künye, kâğıt yüzeylerdeki **bütün** başlıklar.

**Font kuralı (bağlayıcı):** Cormorant **yalnızca koyu bantta ve ≥ 24 px (1,5 rem)** kullanılır. Kâğıt yüzeylerde ve ≤ 24 px her yerde Hanken Grotesk. **İki serif aile yoktur** (Bodoni, Fraunces, Newsreader vb. yok). Uygulama: `--font-bas` koyu bantta Cormorant, `.bant--acik` içinde Hanken'dir; `h1–h3` ve `.lede` `--font-bas`'ı okur. Doğrulama: tüm sayfalarda her metin düğümünün hesaplanmış `font-family`/`font-size` değeri taranır; Cormorant < 24 px ya da kâğıt bandında Cormorant çıkarsa kural ihlalidir.

| Rol | Boyut | Aile / ağırlık | Satır | Aralık |
| --- | --- | --- | --- | --- |
| Hero ad (`dev`) | `clamp(4.2rem, .5rem + 14.5vw, 17rem)` | Cormorant 500 | 0,84 | −0,04 em |
| Sayfa başlığı (`h1`) | `clamp(3.25rem, 1rem + 9.5vw, 9.5rem)` | Cormorant 500 (kâğıtta Hanken 650) | 0,9 | −0,03 em |
| Bölüm başlığı (`h2`) | `clamp(2.5rem, 1.2rem + 5vw, 6rem)` | Cormorant 500 | 0,96 | −0,02 em |
| Kart/sahne başlığı (`h3`) | `clamp(1.625rem, 1.1rem + 1.7vw, 2.5rem)` | Cormorant 500 (kâğıtta Hanken 650) | 1,08 | −0,015 em |
| Lede | `clamp(1.5rem, 1.1rem + 1vw, 1.75rem)` | Cormorant 400 (kâğıtta Hanken) | 1,25 | −0,01 em |
| Yazı gövdesi | 1,1875 rem (19 px), kâğıt | Hanken 400 | 1,7 | 0 |
| Koyu bantta gövde/özet | **≥ 16 px** | Hanken 400 | 1,5 | 0 |
| Meta (tarih, okuma süresi, etiket, künye) | **≥ 14 px** | Hanken 500–600 | 1,45 | 0 |
| Nav bağlantıları | 16 px (en az 15) | Hanken 500 | — | 0 |
| Sayılar | `clamp(3.75rem, 1rem + 10vw, 9.5rem)` | Cormorant 500 | 0,9 | −0,03 em |

Başlıkta `hyphens: manual`, gövdede `hyphens: auto` (`lang="tr"`); `text-wrap: balance` başlıklarda, `pretty` paragraflarda. **Büyük İ'nin noktası** ve `g j y` kuyrukları kırpılmaz (`.satir` kutusu `padding-block`/negatif `margin-block` ile; büyük başlıktan sonra gelen `lede`'ye ek üst boşluk). Gövde satırı en çok ~66 karakter.

---

## Renkler ve kontrast

| Ad | Hex | Rol |
| --- | --- | --- |
| Perde (koyu bant) | `#0B0C0E` | koyu bant, footer, nav, `html`/`body` zemini |
| Perde-2 | `#131417` | koyu yüzey (medya zemini) |
| Kâğıt | `#F1EEE7` | kâğıt bandı zemini |
| Kâğıt-2 | `#E8E4DA` | kâğıt yüzeyi |
| Metin, koyu bant | `#ECE8E1` | ana metin; lede `#E4DFD6`; meta `#D3CDC2` |
| Soluk, koyu bant | `#C9C3B8` | ikincil metin |
| Metin, kâğıt | `#15171A` | ana metin; lede `#2A2D31` |
| Soluk, kâğıt | `#565A5E` | ikincil metin |
| Turkuaz, koyu / kâğıt | `#4FD1D9` / `#0A6670` | sinema vurgusu (metin, çizgi); alan dolgusu `#0E5E66` |
| Turuncu, koyu / kâğıt | `#FF8A3D` / `#B23E08` | basketbol vurgusu (metin); alan dolgusu `#E2661A` yalnızca dolgu |
| Çizgi | `#34353A` (koyu) / `#C4C0B4` (kâğıt) | ayraç |

Mod anahtarı yok: iki ton aynı sayfada yaşar; `prefers-color-scheme` etkisizdir. Dünya seçimi `data-dunya="sinema|basketbol|proje"` ile yapılır (`--dunya*`, `--vurgu`); vurgu bant tonuna göre çözülür. **Kâğıt bandı dünyanın içindeyse** (`article[data-dunya] .bant--acik`) dünya değişkenleri kâğıt değerleriyle yeniden hesaplanır (`tokens.css`: `[data-dunya='sinema'], [data-dunya='sinema'] .bant--acik` ve `basketbol` için aynısı); aksi halde ata öğedeki koyu bant sonucu miras kalır ve `.bant--acik`'in kendi (turkuaz) varsayılanı dünya rengini ezerdi (basketbol yazılarının kâğıt bandı turkuaz çıkardı). Bileşenler `data-dunya` kabı koymaz. Proje sayfaları bu yeniden hesaba bilerek girmez (görünümleri korunur).

| Çift | Oran |
| --- | --- |
| Koyu: metin `#ECE8E1` / perde | 16,02 |
| Koyu: soluk `#C9C3B8` / perde | 11,16 |
| Koyu: meta `#D3CDC2` / perde | 12,38 |
| Koyu: lede `#E4DFD6` / perde | 14,75 |
| Koyu: turkuaz `#4FD1D9` / perde | 10,67 |
| Koyu: turuncu `#FF8A3D` / perde | 8,34 |
| Kâğıt: metin `#15171A` / kâğıt | 15,50 |
| Kâğıt: soluk `#565A5E` / kâğıt | 6,00 |
| Kâğıt: turkuaz `#0A6670` / kâğıt | 5,76 |
| Kâğıt: turuncu `#B23E08` / kâğıt | 5,05 |
| Kâğıt: turuncu dolgu `#E2661A` / kâğıt | 2,95 → **metin değil, yalnızca dolgu** |

Görselin üstüne binen metinde (hero, sahne, yazı kapağı) kontrast düz renk çiftinden değil **gerçek ekran görüntüsünden** ölçülür (aşağıda).

---

## Medya kuralı (tek işleme kuralı)

Kaynağı ne olursa olsun (TMDB backdrop, afiş, kendi kapağı, ekran görüntüsü, proje görseli, görselsiz yedek kapak) her görsel **aynı kalıptan** geçer: `src/components/Medya.astro` + `src/styles/medya.css`. Overlay'ler pseudo-element'tir; görsele, `alt`'a, lazy yüklemeye ve `astro:assets`'e dokunmaz. MDX'teki `Gorsel`/`IkiGorsel` de `Medya` kullanır (ham `<Image>` yok; proje sayfasının ekran görüntüleri galerisi dikey ekran görüntüsü olduğu için kırpılmaz, tek istisnadır).

1. **Oran** — `data-oran`: `kapak` 2,39:1 (mobil 16:9) · `vitrin` 16:10 · `proje` 4:3 · `afis` 2:3 · `kare` 1:1; `object-fit: cover`.
2. **Köşe** — `--medya-kose: 0` (dergi/baskı: keskin köşe).
3. **Renk işlemesi** — `saturate(.88) contrast(1.05) brightness(.97)` + turkuaz `soft-light` tonu (`#0E5E66`, güç .2).
4. **Gren** — SVG `feTurbulence` (data URI; CSP `img-src data:` izinli), `overlay`, güç **.08**.
5. **Vinyet** — kenar kararması; güç koyu bantta .40, kâğıtta .30; afişte yok.
6. **Hareket** — hover'da içerik 1,025 yakınlaşır (0,5 sn); **`.ac` sınıfı** taşıyan görsel kaydırınca açılır (bkz. Hareket).
7. **TMDB backdrop** — `tmdb-fetch.ts` afişin yanında `w1280` backdrop'u da çeker; sinema yazısında `kapak` yoksa backdrop `kapak` oranında kapaktır. **Proje görselleri `proje` (4:3)** basılır (ekran görüntüsü kırpılınca arayüz kesilir).

> Gradient yasağıyla ilişkisi: vinyet, hero sahnesindeki ışık/derinlik ve **görsel üstündeki başlık için koyu karartma (scrim)** görüntü işlemesidir, süs değildir; yalnızca `.medya-kalip`, hero ve görsel sahne/kapak içinde kullanılır; arka plan, başlık ya da düğme süsü olarak asla.

### Görselsiz yedek kapak

Kapağı olmayan yazılar için (`KapakYedek.astro`; statik inline SVG, JS yok, kalıptan geçer): **basketbol** saha çizgileri (turuncu) + sezon/istatistik/yıl; **sinema** projektör ışığı ve film delikleri (turkuaz) + film yılı. Yedek **süstür** (`aria-hidden`). Sıra: kendi `kapak` → TMDB backdrop (yalnızca sinema) → yedek.

---

## Hero ve koyu bant okunabilirliği

**Hero** (`Hero.astro` + `HeroSahne.astro`): tam ekran koyu sahne; ad dergi logosu gibi iki satır (`Göktürk` / `Fulser`), ilk yüklemede satır satır belirir; altında en çok iki **kapak satırı** (öne çıkan yazı: bölüm adı, başlık, tarih ve okuma süresi ayrı satır; öne çıkan proje: ad, özet). Kapak satırları yalnızca içerik varsa çizilir. Adın altındaki cümle `HERO_CUMLESI`, "Kısaca" bölümü `KISACA_METNI` (`src/lib/site.ts`): boşken **hiç render edilmez** (boş paragraf/boşluk kalmaz); "Kısaca" yokken bant ritmi bozulmaz (tüm ana sayfa koyu). Portre fotoğrafı yoktur.

**Sahne:** inline SVG (projektör ışığı basketbol sahasının orta çemberine düşer; turkuaz ışık, turuncu saha çizgileri), harici görsel ve JS yok, `aria-hidden`. Build gününe göre ışığın açısı, orta çember konumu ve toz dağılımı değişir; **ışık her zaman soldan gelir** (ad solda, sahne sağda; mobilde sol üstten hizalı kırpıldığı için lamba kadrajda kalır). **Işık hüzmesi canlı kalır.**

Okunabilirlik kuralları (ölçülüp ayarlandı; uygulamada aynen korunur):

- **Gren:** SVG'nin içinde değil, kadrajdan bağımsız sabit piksel boyutlu (220 px karo) CSS katmanıdır; güç ≤ 0,04 (`overlay`). (SVG içinde bırakılırsa kadraj büyüdükçe iri lekeye döner, "çamurlu" görünür.)
- **Toz:** üçte biri kalır (19 parçacık), yarıçap ≤ 1,6 birim, opaklık ≤ 0,45.
- **Karartma (scrim):** nav'ın arkasında üstten, kapak satırlarının arkasında alttan, ad bloğunun arkasında soldan koyulaşır (üç `linear-gradient`; mobilde üst ve alt).
- **Sahne ad bloğunun dışında:** masaüstünde sahne sağ %70'e oturur ve biraz aşağı iner; saha çizgileri adın bittiği yerden sonra başlar. **Mobilde sahne üstte** (nav'ın altında, `top: 5rem`, yükseklik 21 rem); ad ve kapak satırları sahnenin altındaki sakin bölgede; **lamba nav ve markayla çakışmaz** (320, 360, 390, 414 px ölçüldü).
- **Kontrast ölçümü (zorunlu yöntem):** düz renk çifti değil **gerçek ekran görüntüsü**. Metin gizlenip aynı kadraj yeniden çekilir; her metin düğümünün sınır kutusundaki arka plan piksellerinin **en parlak %5'lik dilimi** (kötü durum) metin rengiyle karşılaştırılır. Hedef: küçük metin **≥ 7:1**, büyük metin (≥ 24 px ya da ≥ 18,66 px kalın) **≥ 4,5:1**. Kapalı `<details>` içindeki (görünmeyen) metin ölçüme girmez.
- **Koyu bantta küçük metin tabanı:** gövde/özet ≥ 16 px, meta ≥ 14 px (tarih, okuma süresi, etiket, künye), nav ≥ 15 px; soluk ton koyu bantta `#C9C3B8`.
- **Meta satırları (Yasak #8):** tarih ve okuma süresi **ayrı öğe** (`<span>`/`<time>`); `A · B` gibi noktalı birleştirme yok. Dar yerlerde (kapak satırı) alt alta, geniş yerlerde yan yana akar. Yalnızca `<title>` ve RSS başlığındaki "Yazılar · Sinema" gibi ayırıcılar görünür meta satırı sayılmaz, olduğu gibi kalır.

---

## Sayfalar

- **Ana sayfa = kapak:** Hero → projeler (dikey çerçeveler; çift sıradakiler aşağı kayık, görsel kaydırınca açılır) → yazılar (öne çıkan yazı tam genişlik sahne, altında kartlar) → kısaca (yalnızca metin doluysa) → sayılar → son izlediklerim. Hepsi koyu.
- **/yazilar/:** manşet = en yeni yazı, tam genişlik görüntü; sayfa başlığı ("Yazılar" ya da bölüm adı) görselin üstünde. Sinema ve basketbol iki ayrı bölüm girişi (dev bölüm adı + tek cümle, altında dünyanın renkli çizgisi). JS'siz sekmeler ve etiket süzgeci. Yazısı kalmayan bölüm çizilmez.
- **Yazı sayfası:** koyu tam genişlik kapak (başlık görselin üstünde, karartmalı) → **kâğıt bandı**: künye kenar notu solda, metin ortada (drop cap, büyük alıntı, kenara taşan geniş görsel; alıntı ve geniş görsel sayfa genişliğine yayılır) → koyu **jenerik** (sinema: afiş + film künyesi, jenerik düzeninde; basketbol: skorbord). **Sıfır client JS.**
- **/projeler/:** koyu dev dizin; ad dev serif, yanında özet, tür/durum/teknoloji ve "Oyna/Aç" + "Projeyi incele". Hover/odakta görsel önizleme **kendi şeridinde** açılır (metne binmez; yalnızca `(hover: hover)` ve geniş ekran); dokunmatikte küçük görsel satır içindedir. Arşiv en sonda sade.
- **Proje sayfası (vaka çalışması, varsayılan):** koyu üst (ad, özet, "Oyna/Aç" ve "Yeni sekmede aç") → kâğıt bandında **Swiss modüller** (ortak çizgili, kartsız, köşesiz): oyna/görsel (gömülüyse oyun kutusu), künye, **Ne / Neden / Nasıl** (`vaka.ne`, `vaka.neden`, `vaka.nasil` frontmatter alanları; **boş olan modül hiç render edilmez**), bağlantılar, (varsa) demo videosu ve ekran görüntüleri; altında MDX gövdesi. `yakinda` projede canlı/mağaza bağlantısı ve gömülü oyun gösterilmez, "Yakında" notu çıkar.
- **/hakkimda/ = önce hikâye, sonra özgeçmiş:** koyu **kapak** (kimlik satırı, büyük Cormorant başlık cümlesi, sağ sütunda 2–3 paragraf birinci tekil şahıs metin; `src/content/hakkimda.<dil>.md`, `baslik` + gövde, boşsa bant yok) → kâğıtta **Yol** (deneyim, eğitim ve `duraklar` içindeki `kisa` cümleli duraklar; masaüstünde yatay, mobilde dikey zaman çizelgesi, durak = yıl aralığı + kurum + tek cümle) → koyu **sayılar** (yayındaki proje ve yazı sayısı otomatik, `sayilar` elle; sıfır/boş gösterilmez, en az iki sayı) → koyu **Şu sıralar** (`su_siralar` grupları + küçük, durağan Letterboxd şeridi `SonIzlenenlerKucuk`; boşsa bant yok) → kâğıtta **Araç kutusu** (her grupta bir `cumle`, ilk 6 sakin etiket) ve **Özgeçmişin tamamı**: varsayılan kapalı `<details>` (JS'siz) içinde eski ayrıntılı özgeçmiş (deneyim, projeler, eğitim, beceriler, diller, iletişim). Sol sabit kimlik sütunu ve çizgili bölüm düzeni yoktur. Veri `src/content/ozgecmis.yaml` (Zod şemalı, `{ en, tr }`); sayfa şimdilik `tr`. `taslak: true` iken production'da **"Bu sayfa hazırlanıyor"**; `SHOW_DRAFTS=true`'da görünür. **Baskı:** yalnızca `<details>` içeriği basılır ve açık gelir (`::details-content`; eski tarayıcılar için `beforeprint` betiği): A4, 2 sayfa (1. kimlik, deneyim, projeler, eğitim; 2. beceriler, diller, iletişim; `.yeni-sayfa` kırılımı). Kapak, Yol, sayılar, Şu sıralar, Araç kutusu ve düğme `.yazdirma-gizle` ile gizlidir. "Özgeçmişi PDF olarak indir" tek küçük paketlenmiş betikle `window.print()` çağıran, bağlantı görünümlü düğmedir (yalnızca bu sayfa).

---

## Çok dillilik (i18n)

- **Diller:** İngilizce varsayılan ve kökte (`prefixDefaultLocale: false`), Türkçe `/tr/` altında. Tarayıcı diline göre otomatik yönlendirme **yoktur**. Yol parçaları dile göre yerelleşir (`writing`/`yazilar`, `projects`/`projeler`, `about`/`hakkimda`, `search`/`arama`, `tags`/`etiketler`); adresleri tek yerden `src/i18n/yollar.ts` üretir, sayfa dosyaları `src/pages` (en) ve `src/pages/tr` (tr) altındadır ve ince sarmalayıcıdır (gövde `components/sayfa/` ve `components/`'te).
- **Yeni arayüz metni** her zaman `src/i18n/tr.ts` **ve** `src/i18n/en.ts`'e eklenir (aynı anahtarlar: tür denetimi ve `i18n/index.ts`'teki çalışma zamanı denetimi eksik/fazla anahtarda build'i durdurur). Bileşenlerde sabit metin yazılmaz; sayfanın dili `dilAl(Astro)` ile (Astro'nun `currentLocale`'i) okunur. Tarih, sayı, puan, liste biçimi, `<html lang>`, `hyphens` (`html[data-tire]`) ve slug transliterasyonu `AYAR[dil]`'den gelir.
- **Yeni yazı:** frontmatter'a `dil: 'tr' | 'en'` (varsayılan `tr`) ve varsa karşılığının slug'ı `ceviri: <diğer dildeki yazının slug'ı>` (tek taraftan yazılması yeter, iki yönlü çözülür). Çeviri ayrı klasör ve ayrı slugtır; görsel paylaşımı için `../<öteki-klasör>/görsel.png` içe aktarılabilir.
- **Yeni proje:** `src/content/projeler/<slug>/proje.yaml` (ortak alanlar: görsel, bağlantılar, tür, durum, stack, embedUrl; `icerikDili` oyunun/uygulamanın kendi dili) + **iki** metin dosyası `metin.tr.mdx` ve `metin.en.mdx` (özet, `vaka`, MDX gövdesi). Bir dili eksik proje diğer dile düşer ve proje sayfasında notla belirtilir. Ekran görüntülerinin `alt`/`altyazi` alanları `{ en, tr }`'dir.
- **Dil düğmesi:** (tek `<a>` kaydırmalı anahtar) bulunulan sayfanın diğer dildeki gerçek karşılığına gider; yoksa (ör. yalnızca bir dilde yazılmış yazı) diğer dilin ilgili liste sayfasına. Karşılıklar her sayfada `<Base esdeger yedek>` ile verilir ve hreflang'ı da besler.
- **SEO:** her sayfada `hreflang` alternatifleri (x-default İngilizce), `og:locale` + `og:locale:alternate`, dilin OG görseli (`/og/<dil>/…`), RSS (`/rss.xml` en, `/tr/rss.xml` tr; bölüm feed'leri de): liste sayfalarıyla aynı mantıkta iki dilin yazılarını da içerir, her öğe `dc:language` taşır. Sitemap'e dil alternatifleri build sonrası sayfaların hreflang'ından yazılır (`scripts/sitemap-hreflang.mjs`).
- **Dil etiketi:** liste sayfalarında sayfanın dilinde olmayan yazı küçük bir etiketle ("In Turkish" / "İngilizce") işaretlenir ve kendi adresine bağlanır.
- **Değişmeyenler:** `lab.gokturkfulser.com` ve `citiesofanatolia.gokturkfulser.com` Türkçe kalır; Türkçe oyunlar (Kelime Avı, Perde Perde Anadolu) İngilizce sayfalarda belirtilir.

## Hareket

Tek eğri `cubic-bezier(.22,1,.36,1)`. **Önce saf CSS** (`animation-timeline: view()`, `@starting-style`, View Transitions); desteklemeyen tarayıcıda içerik animasyonsuz ama **eksiksiz** görünür. **Kural:** içeriği ilk durumda gizleyen/kırpan/kaydıran her kural (görsel `clip-path` açılışı ve satır satır başlık) hem `@media (prefers-reduced-motion: no-preference)` hem `@supports (animation-timeline: view())` içindedir; bunların dışında başlangıçta gizli içerik yoktur (yalnızca `(hover: hover)` içindeki hover önizleme bilerek gizlidir). Doğrulama: Firefox (desteksiz), WebKit ve `@supports` sorgusu bozulmuş Chromium ile ana sayfa, `/yazilar/` ve bir yazı açılır; kırpılmış görsel, kaymış başlık satırı ve yüklenmemiş görsel sayısı 0 olmalı. JS yalnızca CSS'in yapamadığı yerde, küçük, yalnızca o sayfada (paketlenmiş `<script>`, `is:inline` değil): `/arama/` (Pagefind), oyunlu proje sayfası (`OyunKutusu`), `/hakkimda/` ("Yazdır / PDF" düğmesi). **Yazı sayfalarında hiç JS yok.** `prefers-reduced-motion: reduce` altında tüm hareket kapalıdır (akış bandı dahil). CSP: `unsafe-inline` yok, satır içi `style=""` yok.

**İzinli** (hepsi bilgiye hizmet eder: neyin önemli olduğunu ya da neyin geldiğini gösterir):

| Hareket | Teknik | Süre / eğri | Not |
| --- | --- | --- | --- |
| Görselin kaydırınca açılması | `.ac` + CSS `animation-timeline: view()` + `clip-path` (`animation-range: entry 0% cover 30–34%`); koyu bantta merkezden büyüyen çerçeve, kâğıtta alttan yukarı silinen | Kaydırmaya bağlı, `linear` | Yalnızca görsellerde; metin bloğuna uygulanmaz. `@supports (animation-timeline: view())` içinde. |
| Dev başlıkların ilk yüklemede satır satır belirmesi | CSS `@keyframes` (`translateY(104%) → 0`, `.satir` kutusu `overflow: hidden`), satır başına 0,14 sn gecikme | 1,3 sn | Yalnızca sayfa başlığı/ad (hero adı, "Yazılar", "Projeler", proje adı, özgeçmiş adı). |
| Sayfa geçişleri | CSS `@view-transition { navigation: auto }`; marka `view-transition-name` | Tarayıcı varsayılanı | JS'siz; `ClientRouter` yok. |
| Projeler listesinde hover'da görsel önizleme | **Saf CSS** `clip-path` (`li:hover`, `:focus-within`) | 0,55 sn | Yalnızca `(hover: hover) and (min-width: 56.25rem)`. |
| Son izlediklerim şeridi | CSS `@keyframes` `translateX(0 → −50%)`; içerik iki kez, ikincisi `aria-hidden` + `inert` | 110 sn, `linear`, sonsuz; hover, klavye odağı ve **görünür "Akışı durdur / Akışı oynat" düğmesi** ile durur (WCAG 2.2.2) | Düğme JS'siz: klavyeyle odaklanan onay kutusu (sabit `aria-label="Afiş akışını durdur"`, işaretli = durdurulmuş) + etiket; `:checked ~ .akis` ile `animation-play-state: paused`, odak halkası görünür. reduced-motion'da bant hiç akmaz, düğme gizlenir, şerit yatay kaydırılabilir, kopya gizli. |

**Yasak:** her bölümün aynı şekilde aşağıdan kayarak/belirerek gelmesi; smooth scroll kütüphaneleri (Lenis vb.) ve scroll hijacking; okumayı bozacak parallax; imleç takibi/fizik animasyonu.

---

## Link (tek tip)

Her bağlantı: metin rengi, **vurgu renkli alt çizgi** (1,5 px, `text-underline-offset: .22em`), hover/odakta 3 px; vurgu rengi bağlamdan gelir (`--vurgu`). İstisna kural değil, aynı stilin dinlenme hâli: menü, marka, başlık, sekme ve etiket bağlantılarında çizgi dinlenmede saydamdır; hover, odak ve `aria-current`'te aynı çizgi çıkar. "→", "↗" ve "›" yok.

---

## Yasaklar

1. Krem zemin + kiremit/toprak rengi vurgu. *(Kâğıt bandı nötr kâğıttır `#F1EEE7`; vurgular turkuaz/turuncu.)*
2. Siyah zemin + tek neon renk. *(Sayfa yalnızca siyah değildir: koyu ve kâğıt bantlar dönüşür, iki ayrı vurgu rolü vardır.)*
3. Gazete stili kıl çizgi **süsü** ve sıfır radius **süsü**. *(İnce çizgi, çift çizgi ve çerçeve baskı detayı olarak izinlidir, **bilgi taşıdığı sürece**: bölüm sınırı, künye. Köşe `--medya-kose: 0` bilinçli bir seçimdir.)*
4. Aynı yuvarlak kartlardan oluşan grid. *(Kart yok: Swiss modüller ortak çizgilidir, satırlar çizgiyle ayrılır; vitrinlerde biri büyük, diğerleri küçük.)*
5. Her şeyin altında aynı gri gölge. *(Gölge yok.)*
6. Gradient süsler. *(Yalnızca görüntü işlemesi/illüstrasyon: medya vinyeti, hero sahnesi ve görsel üstü karartma; arka plan, başlık ya da düğme süsü olarak yasak. Yer tutucu görseller düz renk.)*
7. Başlık üstünde büyük harf süs etiketleri.
8. "A · B · C" meta satırları (meta bilgisi ayrı öğe/satır; tarih ve okuma süresi dahil).
9. Buton ve link sonlarında "→", "↗", "›".
10. Küçük etiketlerde monospace.
11. İçerik sıra değilse 01/02/03 numaralandırma.
12. Başlıkta tek kelimeyi farklı renk veya italik yapmak.
13. Her bölüme aynı şekilde kayarak/belirerek gelen animasyon. *(Görselin kaydırınca `clip-path` ile açılması, başlığın satır satır belirmesi ve listede hover önizleme izinlidir; her biri farklı bir şeyi işaretler ve metin bloklarına uygulanmaz.)*
14. Medya kuralından geçmemiş ham görsel.
15. İkinci bir link stili; vurgu rengini bağlantı dışında metin vurgusu için kullanmak.
16. Referanslardan görsel, metin, portre, font dosyası ya da kod almak; layout klonlamak.
17. Bir bandın yatay kenar boşluğu/dolgusu taşıması ya da `body`'de varsayılan kenar boşluğu bırakmak.
18. Smooth scroll kütüphaneleri (Lenis vb.) ve scroll hijacking.
19. Okumayı bozacak parallax (metin ya da metne bitişik görselin kaydırmayla kayması).
20. İmleç takibi/fizik animasyonu.
21. İki serif aile; Cormorant'ı kâğıt yüzeyde ya da 24 px altında kullanmak.
22. Sol dikey ray ya da benzeri kenar süsü.
23. Hero'da görünür gren dokusu ya da saha çizgisinin adın içinden geçmesi.

---

## Erişilebilirlik tabanı (tasarımla ilgili kısım)

- Görünür klavye odağı: 3 px halka, vurgu renginde (bant tonuna göre kontrast ≥ 3:1).
- İlk Tab "İçeriğe geç" bağlantısını gösterir; sıra mantıklı: marka, menü, arama, sayfa içeriği, footer. Mobil menü `<details>`: klavye ve ekran okuyucuyla doğal çalışır. Sekmeler yatay kaydırılır ama her bağlantı odaklanabilir.
- Metin kontrastı ≥ 4,5:1 (büyük metin ≥ 3:1); hero'da küçük metin ≥ 7:1, büyük ≥ 4,5:1 (ekran görüntüsünden). Dokunma hedefleri ≥ 44 px.
- `prefers-reduced-motion: reduce` tüm geçiş ve animasyonları kapatır.
- Süs görseller `alt=""`; görselsiz yedek kapak ve hero SVG'si `aria-hidden`; akış bandının kopyası `aria-hidden` + `inert`.

---

## Kalıcı bölümler (yönden bağımsız)

### MDX bileşenleri

`render(entry)` ile birlikte `<Content components={mdxBilesenleri} />` verilir (`src/components/mdx/`); yazıda import gerekmez.

| Bileşen | Kullanım |
| --- | --- |
| `Alinti` | `<Alinti kaynak="…">metin</Alinti>`; düz `> alıntı` aynı görünür; yazı sayfasında sayfa genişliğine taşar (Hanken, vurgu renkli çift kenar çizgisi) |
| `Gorsel` | `<Gorsel src={foto} alt="…" altyazi="…" genis />`; `genis` kenara taşan geniş görsel (2,39:1), yoksa metin sütunu (16:10) |
| `IkiGorsel` | `<IkiGorsel sol={a} solAlt="…" sag={b} sagAlt="…" altyazi="…" />`; mobilde alt alta |
| `IstatistikTablosu` | `<IstatistikTablosu baslik="…" sutunlar={[…]} satirlar={[[…]]} />`; `caption`, `scope`, sayılar sağa yaslı, dar ekranda yatay kaydırılır |

Anlam taşıyan görselde gerçek `alt` yazılır; süs görselde (`kapak`, vitrin görseli) `alt=""`.

### Projeler

- Sıra: arşiv en sonda; önce `oneCikan`, sonra `sira`, sonra ad. Projeler bir dünyaya ait değildir: `data-dunya="proje"` nötr tonlar.
- `Yakında` projelerde net "Yakında" notu (turuncu sol çizgi); "Yayında" olmayan şey asla canlı bağlantıyla sunulmaz. `demoVideo` varsa yakındaki projede kapak yerine video öne çıkar.
- **Gömülü oyun/uygulama (`OyunKutusu`):** tıklanmadan iframe ve istek yok; kapak + büyük "Oyna" düğmesi; tıklayınca sandbox'lı iframe (`allow-scripts allow-same-origin allow-pointer-lock`), "Tam ekran" ve "Oyunu kapat" düğmeleri. Harici subdomain'de yayındaki projelerde "Oyna/Aç" bağlantısı dizinde ve proje sayfasında bulunur.

### Arama

`/search/` (en) ve `/tr/arama/` (tr) ayrı sayfa (nav'da arama simgesi; `?q=` ile yazılar listesinin arama girişinden gelir). Arayüz, Pagefind'ın JS API'si üzerine yazılmış küçük kendi arayüzümüzdür (site token'larına bağlı; metinler sayfanın dilinde, sunucudan `data-*` ile; betikte sabit metin yok) — hazır UI `mergeIndex` ile takıldığı için. Pagefind dizini `<html lang>`'a göre dil başına ayrılır; sayfanın dili birincil dizindir, **diğer dilin dizini `mergeIndex` ile 0,4 ağırlıkla birleştirilir** ve o dilin sonuçları küçük dil etiketi taşır ("In Turkish" / "İngilizce"; dil sonucun adres ağacından tanınır). Pagefind birincil dizinle aynı paket yolunu birleştirmeyi atladığı için build iki kez çalışır (`pagefind --site dist` ve `--output-path dist/pagefind-b`). Birleştirme, birincil dizinin wasm'ı yüklenene kadar bekler; wasm ilk aramada yüklendiğinden `mergeIndex`'ten önce birincil dizinde bir ısınma araması yapılır (yoksa sonsuza dek bekler). Kod yalnızca bu sayfada yüklenir.

### Okuma süresi, TMDB ve künye

- Okuma süresi tarihin yanında ayrı öğe: "3 dakikalık okuma".
- TMDB verisi varsa sinema jenerik bandında afiş (medya kuralı, 2:3) künyenin üstünde; süre ve tür eklenir. Backdrop kapak yedeğidir. Footer'da TMDB atıf cümlesi (ve varsa logo) her sayfada bulunur.
- Son izlediklerim: Letterboxd verisi build sırasında alınır; veri yoksa şerit hiç render edilmez.

---

## Geçmiş

Önceki yön **Yön 1 "Gece seansı"** (Bricolage Grotesque + Newsreader, koyu/açık parke bantlar, kart ve kayarak gelen animasyon yok) idi. Editoryal geçişte iki referans (demirciberk.com, damlanuryagdi.com) Playwright ile 1440 ve 390 px'te incelendi; ikisinde de hareket JS'tir (`IntersectionObserver`), kimlik tek güçlü ürün (çizim/portre) + dev tipografidir; **bu sitede görsel, metin, font, kod alınmadı, layout klonlanmadı**; tek kelimeyi italik/renkli yapmak, başlık üstü büyük harf mono etiket ve ok işaretleri bilerek alınmadı. İki yön önizlendi: **A "Baskı"** (kâğıt, Bodoni Moda + Instrument Sans) ve **B "Karanlık oda"** (koyu, Cormorant + Hanken Grotesk); karar **B temel, A'dan kâğıt bandı** (okuma yüzeyi ve özgeçmiş); Bodoni/Instrument bırakıldı (iki serif aile olmasın). Hero'da sol ray, görünür gren ve ad üstünden geçen saha çizgileri okunabilirlik için kaldırıldı. Önizleme klasörü (`tasarim-onizleme/`) silindi; kararların gerekçesi yukarıdaki kurallardadır.
