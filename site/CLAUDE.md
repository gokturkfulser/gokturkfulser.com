# site/ — gokturkfulser.com ana sitesi

Kök [CLAUDE.md](../CLAUDE.md) (özellikle "Adlar" bölümü) bu klasör için de geçerlidir.

## Stack ve versiyonlar

- Astro 7 (`^7.4`), `@astrojs/mdx` 8 (peer'leri `@astrojs/markdown-remark` ve `@astrojs/markdown-satteri` açıkça bağımlılıktır; Markdown/MDX varsayılan işlemcisi Sätteri), `@astrojs/sitemap`, `@astrojs/rss`
- `compressHTML` Astro 7 varsayılanında (`'jsx'`) bırakıldı: JSX gibi, etiketler arasındaki satır sonu boşlukları atılır ama aynı satırdaki/metin içindeki boşluklar korunur. Bu yüzden bitişik satır içi öğeler arasında boşluk gerekiyorsa şablonda açıkça yazılır (`{' '}` ya da aynı satırda metin); yeni satıra bölünmüş `<span>` önceki metne yapışır.
- TypeScript strict (`astro/tsconfigs/strict`), `@astrojs/check`
- Zod 4: `z` her zaman `astro/zod`'dan içe aktarılır (`astro:content`'ten değil)
- pnpm workspace paketi adı `site`; Node ve pnpm sürümleri kökte sabit (kök CLAUDE.md "Sürümler"): Node 24.21.0 (`.nvmrc`), pnpm 11.1.2 (`packageManager`)
- Birim testi: `vitest` (devDependency, yalnızca `src/lib/*.test.ts`; Astro'ya bağlı olmayan saf fonksiyonlar)
- Görseller `astro:assets` + `sharp` (açıkça bağımlılık; kaldırılmamalı)
- Fontlar Astro Fonts API ile (`astro.config.mjs` → `fonts`, `<Font />` Base.astro'da); `latin` + `latin-ext` subset zorunlu; web fontu için paket eklenmez. `@fontsource/cormorant` ve `@fontsource/hanken-grotesk` (statik woff) yalnızca OG görseli üretimi için devDependency'dir (Satori woff2 okuyamaz)
- Türkçe 404: Workers "en yakın 404.html"i arar; Astro iç içe 404'ü `tr/404/index.html` yazar, `scripts/sitemap-hreflang.mjs` onu `tr/404.html`'e taşır (404 sayfalarında canonical yok, `noindex`).
- Deploy: Cloudflare Workers static assets, Worker `gokturkfulser-site` → gokturkfulser.com (`wrangler.jsonc`: assets `./dist`, `not_found_handling: 404-page`)

## Kurallar

- **Saf statik, adapter yok.** `output` varsayılan (`static`) kalır; `@astrojs/cloudflare` veya başka adapter, SSR, `prerender = false`, sunucu endpoint'i (istek anında çalışan) eklenmez. Endpoint'ler (RSS, robots) yalnızca build'de üretilir.
- `trailingSlash: 'always'`, `build.format: 'directory'` — Workers'ın `auto-trailing-slash` davranışıyla uyumlu; değiştirmeyin.
- Yapılandırma konusunda şüphede astro-docs ve cloudflare-docs MCP'lerine bakılır.

## İçerik

- Koleksiyonlar `src/content.config.ts`'te: `sinema`, `basketbol`, `projeler` (ortak alanlar: `<slug>/proje.yaml`), `projeMetinleri` (dile bağlı metinler: `<slug>/metin.tr.mdx`, `metin.en.mdx`), tek kayıtlı `ozgecmis` (`src/content/ozgecmis.yaml` düz bir belgedir; yükleyici `yaml` paketiyle tek kayda sarar, kimlik `ozgecmis`; `/about/` ve `/tr/hakkimda/` sayfalarının kendisi özgeçmiştir) ve `hakkimda` (kapak metni `hakkimda.<dil>.md`). Metin alanları `{ en, tr }` iki dilli (`yerel()`, `i18n/index.ts`); sayfa kendi dilini gösterir, boşsa diğerine düşer. `deneyim[].roller` listesi, rolde isteğe bağlı `not`, `bitis: null` = devam ediyor; `ozet` boşsa render edilmez; `projeler[].slug` site içi proje sayfalarına bağlanır (taslak olan atlanır); `duraklar[].href` bir bölüm anahtarıdır (`projeler|yazilar|hakkimda`), adresi dile göre üretilir. Hakkımda "önce hikâye, sonra özgeçmiş" düzenindedir (ayrıntı DESIGN.md "Sayfalar"): özgeçmişin tamamı kapalı `<details>` içindedir ve yalnızca o basılır (A4, `.yeni-sayfa` kırılımı); `kisa`, `duraklar`, `sayilar`, `su_siralar`, beceri `cumle` alanları iki dilde. **Yazılar** (sinema + basketbol): her yazı kendi dilinin adres ağacında yaşar (`/writing/<slug>/`, `/tr/yazilar/<slug>/`); frontmatter'da `dil: 'tr' | 'en'` (varsayılan `tr`) ve isteğe bağlı `ceviri: <diğer dildeki yazının slug'ı>`; çeviri ayrı klasör ve ayrı slugtır. Slug'lar dil başına iki koleksiyon arasında tekildir (`sinema`/`cinema`, `basketbol`/`basketball` ayrılmış adlardır; çakışma build'i durdurur). Eski adresler (`/yazilar/**`, `/sinema/**`, `/basketbol/**`, `/en/**`…) `public/_redirects` ile tek adımda 301. Yazılarda `oneCikan: true` ana sayfada (sayfanın dilindeki yazılardan) öne çıkarır; hiçbiri işaretli değilse en yeniler. Sinema yazısında `kapak` isteğe bağlıdır: yoksa TMDB backdrop'u (`film.tmdbId` + `pnpm site:tmdb`, iki dilde başlık/tür çeker) 2,39:1 kapak olur. Her içerik kendi klasöründe: `src/content/<koleksiyon>/<slug>/index.mdx` + görselleri (`kapak: ./kapak.jpg`).
- Entry id'si klasör adından üretilir (`slugify`). Klasör adını zaten transliterasyonlu yazın.
- `taslak: true` içerikler (yazılar **ve projeler**) production build'de hiçbir yerde bulunmaz: sayfa, liste, RSS, sitemap, OG görseli, Pagefind dizini ve kapak/MDX görselleri dahil. Üç katman: (1) `src/lib/taslak-loader.ts` `taslak: true` klasörlerini dosya sisteminden bulup `glob()` desenine olumsuzlama (`!klasor/index.mdx`) olarak verir; yalnızca belgelenmiş API (content store'a dokunulmaz), taslak dosyası hiç yüklenmediği için görselleri de dist'e girmez, (2) `src/lib/content.ts` yardımcıları ayrıca filtreler, (3) sayfalarda `getCollection(...)` doğrudan çağrılmaz. `SHOW_DRAFTS=true` ile build edilen preview'da hepsi görünür; `noindex` meta'sı ve `Disallow: /` robots.txt'si otomatik gelir. Production'da hiç içerik yokken bile sayfalar bozulmaz ("Henüz yazı yok" gibi boş durumlar).
- `ozgecmis.yaml` da `taslak: true` iken production'da `/hakkimda/` "Bu sayfa hazırlanıyor" durumunda kalır (nav bağlantısı görünür); `SHOW_DRAFTS=true`'da özgeçmiş görünür. Gerçek veri girilince `taslak` satırı silinir.
- Bugünkü örnek içeriklerin tamamı uydurmadır ve `taslak: true`'dur; listesi ve gerçeğe çevirme adımları `site/YER-TUTUCULAR.md`'dedir. Yeni gerçek içerik `taslak: false` ile eklenir; yer tutucular silinir.
- Kapak/görsel `alt=""` (süs) kullanılır, çünkü yanında başlık metni vardır. Anlam taşıyan görsel eklenirse gerçek `alt` yazılır.

## Top 10 verisi ("İnsan highlight makarası")

NBA Top 10 gecelerinin verisinden sezonluk puan tablosu. Veri `top10` koleksiyonudur (`src/content/top10/<sezon>/<YYYY-AA-GG>.yaml`, ör. `2026-27/2026-11-01.yaml`); hesap saf fonksiyonlardır (`src/lib/top10.ts`, testi `top10.test.ts`); veriyi `src/lib/content.ts` → `top10Geceleri(sezon?)` getirir (sayfada/bileşende `getCollection` doğrudan çağrılmaz). Yazı `basketbol/insan-highlight-makarasi` (tr) ve `basketbol/human-highlight-reel` (en; çeviri ayrı klasör ve slugtır, `index.en.mdx` değil: yükleyici yalnızca `*/index.{md,mdx}` okur).

- **Şema** (`content.config.ts`): gece düzeyinde `tarih` (maçların ABD gecesi, videonun başlığındaki tarih), `video` (https, youtube.com ya da nba.com), `tur: 'top10' | 'top5'` (varsayılan `top10`), `kaynak: 'gemini' | 'elle'` (varsayılan `elle`), `taslak` (varsayılan `false`), `oyunlar[]`. Oyun satırı: `sira`, `eylem?`, `etiketler?`, `aciklama?`, `rakip?` (üstüne smaç basılan/bloklanan; puan almaz), `katkilar` (1–3 öğe: `{ oyuncu, takim (3 büyük harf), rol, pay? }`). Satırlar katıdır: kaldırılan eski alanlar (oyun satırında `oyuncu`, `takim`, `asist`) ya da bilinmeyen anahtarlar build'i durdurur.
- **Sabit listeler tek dosyada:** `src/lib/top10-sozluk.ts` eylem (`smac, alley_oop, blok, top_calma, pas, ucluk, turnike, orta_mesafe, diger`), etiket (`poster, chase_down_blok, son_saniye, mac_kazandiran, and_one, yari_saha_ve_otesi, bacak_arasi, sirt_arkasi, bakmadan, crossover, putback, tip_in, hizli_hucum, windmill, ters, tek_el, kendine_alley_oop`) ve rol (`bitiren, pasor, bloklayan, top_calan, diger`) anahtarlarını ve tr/en görünen adlarını taşır; şema, bileşenler ve ileride Gemini betiği bunu kullanır. Bu anahtarlar `i18n/tr.ts` / `en.ts`'e **yazılmaz**. Listede olmayan değer build'i durdurur.
- **Pay kuralları (build'i durdurur):** pay hiçbir katkıda yoksa eşit bölüşüm (2 kişi 50/50, 3 kişi 34/33/33, fazlalık ilk katkıya). Bazılarında var bazılarında yoksa hata. Pay varsa toplam 100 ve bölüşüm şunlardan biri: `[100]`, `[50,50]`, `[70,30]`, `[30,70]`, `[34,33,33]` ve `[50,25,25]` (her sırayla). Aynı oyunda aynı oyuncu iki kez katkı sahibi olamaz.
- **Diğer doğrulamalar (build'i durdurur):** `sira` değerleri tekil, 1..N aralığında (N: top10 → 10, top5 → 5), eksik sıra yok; dosya adındaki tarih ile `tarih` aynı gün (yükleyicinin `generateId`'sinde) ve sezon klasörü ardışık yıllar (`2026-27`); aynı güne iki gece yazılamaz. Oyuncu kimliği `slugify(oyuncu)`'dur; slug'ları farklı ama çok benzeyen adlar (düzenleme uzaklığı ≤ 1, her iki slug ≥ 8 karakterse ≤ 2) build günlüğüne `[uyarı] top10: …` olarak yazılır, build durmaz. Tarama tüm katkılardaki ve `rakip` alanındaki adları kapsar.
- **Puan kuralı:** oyun puanı = 11 − sıra (top5 gecesinde de; 1. sıra her zaman 10); katkı puanı = oyun puanı × pay / 100. İç hesap tam sayıdır (1 puan = 100 birim, `puanBirim`); kayan nokta yalnızca gösterimde. Ekranda en çok tek ondalık, yerel biçimle (`ondalikYaz`: tr "4,5", en "4.5"; tam sayıysa ondalık yok; sıralama gösterilen değere değil tam sayı birime bakar, bu yüzden iki satırın aynı görünüp farklı sıralanması mümkündür). Tablo: oyuncu, son takım (en yeni katkısındaki; aynı gecede birden çok katkıda o gecenin en iyi sıralı oyunu), toplam puan, kaç gece (herhangi bir katkısı olan), kaç kez 1 numara (1 numaralı oyunun her katkı sahibi sayılır). Eşitlikte sırasıyla: daha çok 1 numara, daha çok gece, daha yeni son görünme, ad. Lider geçmişi her geceden sonra lideri hesaplar ve yalnızca liderin değiştiği geceleri (ilk gece dahil) döndürür. Asist diye ayrı bir kavram yoktur: pasın payı `pasor` rolüyle katkı olarak yazılır.
- **Yeni gece ekleme:** (1) tarihi ABD gecesi olarak belirle; dosyayı `src/content/top10/<sezon>/<YYYY-AA-GG>.yaml` adıyla oluştur (yeni sezonda klasör de yeni: `2027-28`); (2) `tarih`, `video`, gerekirse `tur: top5`, `kaynak`, sonra her sıra için bir oyun yaz: `eylem`/`etiketler` sabit listeden, `katkilar` içinde her katkı sahibi `oyuncu`, `takim`, `rol` ile (iki-üç kişilik oyunda payı elle vermek istemiyorsan hiç yazma, eşit bölünür); `taslak` yazılmaz; (3) `pnpm --filter site build`: doğrulama hataları ve yazım uyarıları burada çıkar; (4) uyarı varsa adı düzelt; (5) tabloyu `pnpm site:dev` ile gözle kontrol et. Sayfadaki bileşenler yeni geceyi kendiliğinden alır, yazıya dokunmak gerekmez.
- **MDX bileşenleri** (import gerekmez): `<Top10Siralama />` (gerçek `<table>`, `<caption>`, `th scope`), `<Top10SonGece />` (her oyunda eylem, katkı sahipleri kişi başı puanla, etiketler, açıklama, rakip; videoya düz metin bağlantı, iframe yok), `<Top10Liderler />`, `<Top10Guncelleme />` (en yeni gecenin tarihi). Hepsi `sezon="2026-27"` alır; verilmezse en yeni sezon. Gece verisi yokken `Top10Bos` boş durumu çıkar (guncelleme hiçbir şey çizmez). Arayüz metinleri `i18n` → `top10` anahtarlarında (iki dilde), eylem/etiket/rol adları yalnızca `top10-sozluk.ts`'te. Kâğıt bandında küçük metin yalnızca `--murekkep` (turuncu metin 5,05:1, 7:1'e yetmez); turuncu yalnızca çizgi/işaret. Bileşen sınıfları yazıdaki genel sınıflarla (`.etiketler`…) çakışmamalı (`.oyun-etiketleri`). Mobilde tablo sayfayı kaydırmaz, gerekirse kendi kabında kayar.
- **Taslak:** örnek gece dosyaları `taslak: true`'dur ve production'da yüklenmez (yükleyici deseni `taslakDosyaDesenleri`, `top10Geceleri` süzgeci, yazı da taslak). Gerçek veri girilince örnek dosyalar silinir (`YER-TUTUCULAR.md`).
- **Testler:** `pnpm --filter site test` (vitest). Puan, paylar (tek kişi, 50/50, 70/30, üçlü eşit bölüşüm ve yuvarlama, birikimde kayan nokta), pay hataları (eksik, yanlış toplam, izinsiz bölüşüm, çift oyuncu), aynı oyuncunun aynı gecede tek başına ve paylı oyunu, top5, eşitlik kırıcıları, boş sezon, ondalıklı lider geçmişi, sıra/dosya/video doğrulaması ve yazım benzerliği (katkı + rakip) kapsanır.

## Dil (i18n) kuralları

- İngilizce varsayılan ve kökte, Türkçe `/tr/` altında (Astro `i18n`, `prefixDefaultLocale: false`); yol parçaları dile göre yerelleşir ve `src/i18n/yollar.ts`'ten üretilir. Tarayıcı diline göre otomatik yönlendirme yoktur. Ayrıntılı kurallar DESIGN.md "Çok dillilik".
- **Arayüz metni** tek yerde: `src/i18n/tr.ts` ve `src/i18n/en.ts` (aynı anahtarlar; eksik/fazla anahtar tür denetimini ve build'i durdurur). Yeni metin eklerken **iki sözlüğe de** yazılır; bileşende sabit metin yok. Dil `dilAl(Astro)`'dan gelir.
- `<html lang>`, tarih/sayı/puan/liste biçimi (`Intl`, `AYAR[dil].intl`), `hyphens` (`html[data-tire]`) ve slug transliterasyonu (tr: ı→i, İ→i, ğ→g, ş→s, ç→c, ö→o, ü→u) `src/i18n/index.ts`'teki tek locale parametresinden gelir. Elle ay adı yazılmaz.
- **Yeni yazı:** `dil` alanı yazılır (`tr` varsayılan). **Yeni proje:** `proje.yaml` + `metin.tr.mdx` + `metin.en.mdx` (biri eksikse diğer dile düşer, sayfada not çıkar).
- Kod tanımlayıcıları Türkçe alan adlarını (`baslik`, `ozet`, `taslak`…) izler. `lab.gokturkfulser.com` ve `citiesofanatolia.gokturkfulser.com` Türkçe kalır.

## Performans bütçesi

- Yazı sayfalarında **sıfır client JS** (JSON-LD `<script type="application/ld+json">` veridir, sayılmaz). Tek istisnalar: `/search/` ve `/tr/arama/` (Pagefind, yalnızca o sayfada yüklenir; dizin `<html lang>`'a göre dil başına ayrılır; diğer dil `mergeIndex` ile düşük ağırlıkla birleştirilir, bu yüzden build `pagefind`'ı iki kez çalıştırır: `dist/pagefind` ve `dist/pagefind-b`), gömülü oyun/uygulama bulunan proje sayfası (`OyunKutusu`, paketlenmiş ~1 KB betik; `is:inline` değil, CSP hash'i için) ve özgeçmiş gösterilen `/about/` ve `/tr/hakkimda/` ("Özgeçmişi PDF olarak indir" düğmesi ve yazdırma için `<details>` açma, küçük paketlenmiş betik). `CF_ANALYTICS_TOKEN` tanımlıysa her sayfaya Cloudflare beacon'ı eklenir; üretimde tanımlamak bu bütçeyi bilerek bozar. Yazı/proje detay sayfalarına `<script>`, `client:*` adası, `ClientRouter` (JS tabanlı view transitions) ve prefetch eklenmez; geçişler yalnızca CSS `@view-transition` ile. Build sonrası kontrol: `ld+json` dışındaki `<script>` yalnızca arama sayfaları, gömülü oyun sayfası (iki dilde) ve (özgeçmiş görünürken) hakkımda sayfalarında olmalı.
- Lighthouse 100 (performans, erişilebilirlik, en iyi uygulamalar, SEO).
- LCP < 1.5 sn: kapak görseli `loading="eager" fetchpriority="high"`, boyutları belirli; web font eklenirse `font-display: swap` + preload.
- Sayfa içi görseller `astro:assets` ile; sabit `width`/`height` ile CLS önlenir.

## Erişilebilirlik tabanı

- Görünür klavye odağı (`:focus-visible`, `base.css`); kaldırılmaz, yalnızca iyileştirilir.
- `prefers-reduced-motion: reduce` saygı görür; her animasyon/geçiş bunun altında kapatılabilir olmalı.
- Renk kontrastı WCAG AA (metin 4.5:1, büyük metin ve UI bileşenleri 3:1). Token değiştirirken kontrol edilir.
- Semantik HTML, tek `h1`, "İçeriğe geç" bağlantısı, `aria-current` ile geçerli sayfa.

## Tasarım

Tasarım kararlarında `site/DESIGN.md` bağlayıcıdır (yön: **"Karanlık salonda basılı sayfa"**: koyu bantlar sinema salonu, kâğıt bantları okuma yüzeyi; turkuaz sinema, turuncu basketbol; Cormorant yalnızca koyu bantta ve ≥ 24 px, her yerde Hanken Grotesk, iki serif aile yok). Renk, font ve ölçü token'ları `src/styles/tokens.css`'te; stiller bu değişkenleri kullanır, sabit renk/boşluk yazılmaz. Sayfalar **bantlardan** kurulur (`<section class="bant bant--koyu|acik">` + `.kap`; `acik` = kâğıt bandı); bant ve `body` yatay kenar boşluğu taşımaz (DESIGN.md "Kenar kuralı"). Sol dikey ray yoktur. Tüm görseller `Medya.astro` + `styles/medya.css` (tek işleme kuralı) üzerinden basılır, kapaksız yazılar `KapakYedek.astro` ile (`YaziKapagi.astro` ikisini seçer); ham `<Image>` ile görsel basılmaz (proje sayfasının dikey ekran görüntüsü galerisi istisnadır). Sitede portre fotoğrafı yoktur.

**Hero:** her zaman `Hero.astro` + `HeroSahne.astro` (inline SVG, build gününe göre varyasyon; gren SVG'de değil CSS katmanında). Adın altındaki cümle ve ana sayfadaki "Kısaca" bölümü `src/lib/site.ts`'teki `HERO_CUMLESI` / `KISACA_METNI` (`{ en, tr }`) ile gelir; ilgili dilde boşsa hiç render edilmez. Hero'daki metin kontrastı **gerçek ekran görüntüsünden** ölçülür (küçük metin ≥ 7:1, büyük ≥ 4,5:1; yöntem DESIGN.md "Hero ve koyu bant okunabilirliği"). Satır içi `style=""` kullanılmaz (CSP engeller).

**Proje sayfası** her proje için vaka çalışması düzenindedir (`components/sayfa/ProjeSayfasi.astro`): Ne/Neden/Nasıl modülleri `vaka.ne|neden|nasil` frontmatter'ından gelir, boşsa modül hiç render edilmez.

Sayfa geçişleri yalnızca CSS `@view-transition`; `ClientRouter`/JS eklenmez. Yeni sayfa tipi bitince Playwright ile masaüstü (1440) ve mobil (390) ekran görüntüsü alınır, DESIGN.md'ye göre eleştirilir; klavyeyle Tab sırası ve kontrast kontrol edilir. Lazy görseller için ekran görüntüsünden önce `img.loading='eager'` yapılır; kaydırınca açılan görseller (`.ac`) ve satır animasyonları için `document.getAnimations().forEach(a => a.cancel())` ile animasyonsuz hâl çekilir (CSP, `addStyleTag` ile satır içi stil eklenmesini engeller).

## CSP ve güvenlik header'ları

- `unsafe-inline` yok. `astro.config.mjs` → `security.csp`: Astro her HTML'ye hash'li `<meta http-equiv="content-security-policy">` koyar (paketlenmiş `<script>`/`<style>` otomatik hash'lenir). Yeni satır içi betik için **`is:inline` kullanılmaz** (hash'lenmez, bloklanır); normal `<script>` yazılır. `application/ld+json` veri bloğudur, CSP'ye tabi değildir.
- `<meta>` `frame-ancestors`'ı desteklemez: o direktif yalnızca `public/_headers`'tadır (`frame-ancestors 'none'`). `_headers`'a başka CSP direktifi eklenmez; header ve meta kesişir, başka direktif eklemek sessizce daraltır. Diğer her direktif `security.csp.directives`'tedir.
- Harici kaynak (script/frame/img/connect) eklemeden önce CSP'ye eklenir. Sayfaya özel izin `Astro.csp?.insertScriptResource(...)` ile (örnek: `arama.astro` → `'wasm-unsafe-eval'`, Pagefind WebAssembly).
- `_headers`'ta aynı header birden fazla kuralla eşleşirse değerler birleşir; `Cache-Control` bu yüzden `/*` altında değil (`/_astro/*` immutable, HTML için `/` ve `/*/`).
- Kontrol: `SHOW_DRAFTS=true pnpm --filter site build` + `pnpm --filter site exec wrangler dev` (`_headers` yalnızca burada/Workers'ta uygulanır, `astro preview`'da değil), Playwright ile `securitypolicyviolation` olayı dinlenir; ana sayfa, yazı, arama sayfası (arama yapılarak; iki dilde), oyunlu proje sayfası. Build sonrası production dist'e geri dönülür.
- Deploy: `DEPLOY.md` (dashboard değerleri), yayın öncesi `LAUNCH.md`. Workers Builds için build komutu `pnpm --filter site build:workers` (`SHOW_DRAFTS` daldan türetilir).

## Her görev sonunda

```powershell
pnpm --filter site build
pnpm --filter site check   # astro check
pnpm --filter site test    # vitest (lib/*.test.ts)
```

Üçü de hatasız geçmeden görev bitmiş sayılmaz. Gerekirse `pnpm --filter site exec wrangler deploy --dry-run` ile Worker yapılandırması doğrulanır.

## Ekran görüntüleri

Playwright ekran görüntüleri ve MCP çıktıları yalnızca yerel kanıttır: `site/ekran-goruntuleri/` ve `.playwright-mcp/` `.gitignore`'dadır; `public/` dışında oldukları için `dist/`'e de girmez (her build sonrası `find site/dist -iname "*ekran*"` boş olmalı). Bundan sonraki görüntüler de buraya kaydedilir.

## Ortam değişkenleri

- `SHOW_DRAFTS` (boolean, varsayılan `false`): yalnızca preview build'lerinde `true`. Şablon: `.env.example`. Gerçek `.env` repo'ya girmez.

## Özellikler ve çalışma kuralları

- **TMDB:** `pnpm site:tmdb` (kökten) `scripts/tmdb-fetch.ts`'i çalıştırır; `film.tmdbId`'li sinema yazıları için künye, afiş ve backdrop'u `src/data/tmdb-cache.json`, `src/data/tmdb/afis/` ve `src/data/tmdb/arkaplan/` içine yazar. Cache'te `surum: 2` olan yeniden çekilmez (`--yenile` ile hepsi; backdrop öncesi kayıtlar bir kez yenilenir). Astro build'i API'yi **asla** çağırmaz; yalnızca cache'i okur (yalnızca Letterboxd şeridinin afişleri ayrı bir ön adımla indirilir, aşağıya bakın). Anahtar `TMDB_API_KEY` (site/.env); repo'ya girmez. Footer'daki TMDB atıf cümlesi kaldırılmaz. TMDB logosu: dosyayı `site/public/tmdb-logo.svg` (ya da `tmdb-logo.png`) olarak koyun; varsa footer'da atıf metninin solunda 14 px yükseklikte görünür, yoksa yalnızca metin atfı kalır (kod değişmez). Logo bu sitenin kendi başlığından belirgin olmamalı.
- **OG görselleri:** `src/pages/og/[bolum]/[slug].png.ts` + `src/lib/og.ts` (Satori + resvg). Renk/font DESIGN.md token'larıyla aynı. Türkçe için latin ve latin-ext fontları ayrı aile adıyla (`… Ext`) verilir; aynı adla iki font verilirse ğ ş tofuya düşer. Yeni OG tasarımı eklenince ğ ş ı İ içeren bir başlıkla PNG gözle kontrol edilir.
- **Arama:** build `astro build && pagefind --site dist` çalıştırır. Yalnızca `data-pagefind-body` taşıyan sayfalar indekslenir (yazı, proje, hakkımda). Arama arayüzü `/arama/` sayfasıdır; `dev`'de dizin yoktur, `pnpm build` + `astro preview` ile denenir.
- **Structured data:** `src/lib/jsonld.ts`. Her yazıda Article; `puan`'ı olan sinema yazısında ayrıca Review (itemReviewed: Movie).
- **Okuma süresi:** `src/lib/okuma-suresi.ts` (180 kelime/dk, görsel/tablo başına +8 sn).
- **Letterboxd şeridi:** afişler ziyaretçinin tarayıcısında ltrbxd.com'dan yüklenmez (CSP'de de izin yok). `build` betiği Astro'dan önce `scripts/letterboxd-afis.ts`'i (`pnpm --filter site afisler`) çalıştırır: RSS'teki `tmdb:movieId`'lerin ilk 12'si için TMDB'den afişleri `src/data/letterboxd/afis/<id>.jpg`'ye indirir (`TMDB_API_KEY` + `LETTERBOXD_RSS` build değişkenleri). Klasör `.gitignore`'dadır, repoya **girmez**; `lib/letterboxd-afis.ts` yerelden okur, `SonIzlenenler` `Medya` ile basar. Anahtar yok / TMDB'ye ulaşılamıyor / afiş yok → uyarı yazılır, build başarılı kalır ve o film afişsiz (yalnızca metin) çizilir. TMDB kimliği olmayan RSS öğeleri en baştan atlanır. Sinema yazılarının TMDB verisi bundan ayrıdır ve repoda kalır (`pnpm site:tmdb`). Şerit yalnızca build anında güncellenir: günlük build için `.github/workflows/site-gunluk-build.yml` (Deploy Hook, bkz. DEPLOY.md bölüm 9). `LETTERBOXD_RSS` tanımlıysa build'de çekilir; tanımsız ya da hatalıysa şerit hiç render edilmez. RSS isteği `node:http(s)` ile atılır: Windows + Node 24'te global `fetch` (undici) Astro build'inin çıkışında `UV_HANDLE_CLOSING` ile çöküp `&& pagefind` adımını atlatıyordu; bu yüzden Astro süreci içinde `fetch` kullanılmaz (afiş betiği ayrı bir süreçtir ve `process.exit(0)` ile kapanır). (Çökme bu makinede yalnızca Letterboxd çağrısı eklendiğinde görüldü; kesin tetikleyici bilinmiyor.)
- **Projeler:** süzgeç JS'siz, her tür kendi sayfası (`/projeler/tur/<tur>/`); `tur` adlı bir proje slug'ı kullanılmaz. Sıra: arşiv en sonda, sonra `oneCikan`, `sira`, ad. `/projeler/` dev dizindir; hover önizleme saf CSS'tir ve metne binmez. `durum: yakinda` projelerde canlı/mağaza bağlantısı ve gömülü oyun gösterilmez; net "Yakında" notu çıkar, `demoVideo` varsa kapak yerine öne çıkar. `embedUrl`'li projede `OyunKutusu`: tıklanmadan iframe ve istek yok; sandbox `allow-scripts allow-same-origin allow-pointer-lock`.
- **Ortam değişkenleri:** `SHOW_DRAFTS`, `TMDB_API_KEY`, `LETTERBOXD_RSS`, `CF_ANALYTICS_TOKEN` (hepsi `.env.example`'da).
