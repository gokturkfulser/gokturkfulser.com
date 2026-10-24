# site/ — gokturkfulser.com ana sitesi

Kök [CLAUDE.md](../CLAUDE.md) (özellikle "Adlar" bölümü) bu klasör için de geçerlidir.

## Stack ve versiyonlar

- Astro 7 (`^7.4`), `@astrojs/mdx` 8 (peer'leri `@astrojs/markdown-remark` ve `@astrojs/markdown-satteri` açıkça bağımlılıktır; Markdown/MDX varsayılan işlemcisi Sätteri), `@astrojs/sitemap`, `@astrojs/rss`
- `compressHTML` Astro 7 varsayılanında (`'jsx'`) bırakıldı: JSX gibi, etiketler arasındaki satır sonu boşlukları atılır ama aynı satırdaki/metin içindeki boşluklar korunur. Bu yüzden bitişik satır içi öğeler arasında boşluk gerekiyorsa şablonda açıkça yazılır (`{' '}` ya da aynı satırda metin); yeni satıra bölünmüş `<span>` önceki metne yapışır.
- TypeScript strict (`astro/tsconfigs/strict`), `@astrojs/check`
- Zod 4: `z` her zaman `astro/zod`'dan içe aktarılır (`astro:content`'ten değil)
- pnpm workspace paketi adı `site`; Node ve pnpm sürümleri kökte sabit (kök CLAUDE.md "Sürümler"): Node 24.21.0 (`.nvmrc`), pnpm 11.1.2 (`packageManager`)
- Görseller `astro:assets` + `sharp` (açıkça bağımlılık; kaldırılmamalı)
- Fontlar Astro Fonts API ile (`astro.config.mjs` → `fonts`, `<Font />` Base.astro'da); `latin` + `latin-ext` subset zorunlu; web fontu için paket eklenmez. `@fontsource/*` (statik woff) yalnızca OG görseli üretimi için devDependency'dir (Satori woff2 okuyamaz)
- Deploy: Cloudflare Workers static assets, Worker `gokturkfulser-site` → gokturkfulser.com (`wrangler.jsonc`: assets `./dist`, `not_found_handling: 404-page`)

## Kurallar

- **Saf statik, adapter yok.** `output` varsayılan (`static`) kalır; `@astrojs/cloudflare` veya başka adapter, SSR, `prerender = false`, sunucu endpoint'i (istek anında çalışan) eklenmez. Endpoint'ler (RSS, robots) yalnızca build'de üretilir.
- `trailingSlash: 'always'`, `build.format: 'directory'` — Workers'ın `auto-trailing-slash` davranışıyla uyumlu; değiştirmeyin.
- Yapılandırma konusunda şüphede astro-docs ve cloudflare-docs MCP'lerine bakılır.

## İçerik

- Koleksiyonlar `src/content.config.ts`'te: `sinema`, `basketbol`, `projeler`. Her içerik kendi klasöründe: `src/content/<koleksiyon>/<slug>/index.mdx` + görselleri (`kapak: ./kapak.jpg`).
- Entry id'si klasör adından üretilir (`slugify`). Klasör adını zaten transliterasyonlu yazın.
- `taslak: true` içerikler (yazılar **ve projeler**) production build'de hiçbir yerde bulunmaz: sayfa, liste, RSS, sitemap, OG görseli, Pagefind dizini ve kapak/MDX görselleri dahil. Üç katman: (1) `src/lib/taslak-loader.ts` `taslak: true` klasörlerini dosya sisteminden bulup `glob()` desenine olumsuzlama (`!klasor/index.mdx`) olarak verir; yalnızca belgelenmiş API (content store'a dokunulmaz), taslak dosyası hiç yüklenmediği için görselleri de dist'e girmez, (2) `src/lib/content.ts` yardımcıları ayrıca filtreler, (3) sayfalarda `getCollection(...)` doğrudan çağrılmaz. `SHOW_DRAFTS=true` ile build edilen preview'da hepsi görünür; `noindex` meta'sı ve `Disallow: /` robots.txt'si otomatik gelir. Production'da hiç içerik yokken bile sayfalar bozulmaz ("Henüz yazı yok" gibi boş durumlar).
- Bugünkü örnek içeriklerin tamamı uydurmadır ve `taslak: true`'dur; listesi ve gerçeğe çevirme adımları `site/YER-TUTUCULAR.md`'dedir. Yeni gerçek içerik `taslak: false` ile eklenir; yer tutucular silinir.
- Kapak/görsel `alt=""` (süs) kullanılır, çünkü yanında başlık metni vardır. Anlam taşıyan görsel eklenirse gerçek `alt` yazılır.

## Türkçe kuralları

- `<html lang="tr">`.
- Tarihler `Intl.DateTimeFormat('tr-TR')` ile (`src/lib/format.ts`); elle ay adı yazılmaz.
- Slug'larda transliterasyon: ı→i, İ→i, ğ→g, ş→s, ç→c, ö→o, ü→u (`src/lib/slug.ts`). Etiket URL'leri de aynı fonksiyondan geçer.
- İçerik ve arayüz metinleri Türkçe; kod tanımlayıcıları da bu repoda Türkçe alan adlarını (`baslik`, `ozet`, `taslak`…) izler.

## Performans bütçesi

- Yazı sayfalarında **sıfır client JS** (JSON-LD `<script type="application/ld+json">` veridir, sayılmaz). Tek istisnalar: `/arama/` (Pagefind, yalnızca o sayfada yüklenir) ve gömülü oyun/uygulama bulunan proje sayfası (`OyunKutusu`, paketlenmiş ~1 KB betik; `is:inline` değil, CSP hash'i için). `CF_ANALYTICS_TOKEN` tanımlıysa her sayfaya Cloudflare beacon'ı eklenir; üretimde tanımlamak bu bütçeyi bilerek bozar. Yazı/proje detay sayfalarına `<script>`, `client:*` adası, `ClientRouter` (JS tabanlı view transitions) ve prefetch eklenmez; geçişler yalnızca CSS `@view-transition` ile. Build sonrası kontrol: `ld+json` dışındaki `<script>` yalnızca `/arama/` ve gömülü oyun sayfasında olmalı.
- Lighthouse 100 (performans, erişilebilirlik, en iyi uygulamalar, SEO).
- LCP < 1.5 sn: kapak görseli `loading="eager" fetchpriority="high"`, boyutları belirli; web font eklenirse `font-display: swap` + preload.
- Sayfa içi görseller `astro:assets` ile; sabit `width`/`height` ile CLS önlenir.

## Erişilebilirlik tabanı

- Görünür klavye odağı (`:focus-visible`, `base.css`); kaldırılmaz, yalnızca iyileştirilir.
- `prefers-reduced-motion: reduce` saygı görür; her animasyon/geçiş bunun altında kapatılabilir olmalı.
- Renk kontrastı WCAG AA (metin 4.5:1, büyük metin ve UI bileşenleri 3:1). Token değiştirirken kontrol edilir.
- Semantik HTML, tek `h1`, "İçeriğe geç" bağlantısı, `aria-current` ile geçerli sayfa.

## Tasarım

Tasarım kararlarında `site/DESIGN.md` bağlayıcıdır (seçilen yön: Teal & Orange). Renk, font ve ölçü token'ları `src/styles/tokens.css`'te; stiller bu değişkenleri kullanır, sabit renk/boşluk yazılmaz. DESIGN.md'deki "Yasaklar" listesi her görevde uygulanır. Yazı gövdesi `.metin` sınıfıyla (`prose.css`) ve `data-dunya="sinema|basketbol"` altında kurulur; MDX içinde `src/components/mdx/` bileşenleri import'suz kullanılır.

Sayfa geçişleri yalnızca CSS `@view-transition`; `ClientRouter`/JS eklenmez. Yeni sayfa tipi bitince Playwright ile masaüstü (1440) ve mobil (390) ekran görüntüsü alınır, DESIGN.md'ye göre eleştirilir; klavyeyle Tab sırası ve kontrast kontrol edilir. Lazy görseller için ekran görüntüsünden önce `img.loading='eager'` yapılır.

## CSP ve güvenlik header'ları

- `unsafe-inline` yok. `astro.config.mjs` → `security.csp`: Astro her HTML'ye hash'li `<meta http-equiv="content-security-policy">` koyar (paketlenmiş `<script>`/`<style>` otomatik hash'lenir). Yeni satır içi betik için **`is:inline` kullanılmaz** (hash'lenmez, bloklanır); normal `<script>` yazılır. `application/ld+json` veri bloğudur, CSP'ye tabi değildir.
- `<meta>` `frame-ancestors`'ı desteklemez: o direktif yalnızca `public/_headers`'tadır (`frame-ancestors 'none'`). `_headers`'a başka CSP direktifi eklenmez; header ve meta kesişir, başka direktif eklemek sessizce daraltır. Diğer her direktif `security.csp.directives`'tedir.
- Harici kaynak (script/frame/img/connect) eklemeden önce CSP'ye eklenir. Sayfaya özel izin `Astro.csp?.insertScriptResource(...)` ile (örnek: `arama.astro` → `'wasm-unsafe-eval'`, Pagefind WebAssembly).
- `_headers`'ta aynı header birden fazla kuralla eşleşirse değerler birleşir; `Cache-Control` bu yüzden `/*` altında değil (`/_astro/*` immutable, HTML için `/` ve `/*/`).
- Kontrol: `SHOW_DRAFTS=true pnpm --filter site build` + `pnpm --filter site exec wrangler dev` (`_headers` yalnızca burada/Workers'ta uygulanır, `astro preview`'da değil), Playwright ile `securitypolicyviolation` olayı dinlenir; ana sayfa, yazı, `/arama/` (arama yapılarak), oyunlu proje sayfası. Build sonrası production dist'e geri dönülür.
- Deploy: `DEPLOY.md` (dashboard değerleri), yayın öncesi `LAUNCH.md`. Workers Builds için build komutu `pnpm --filter site build:workers` (`SHOW_DRAFTS` daldan türetilir).

## Her görev sonunda

```powershell
pnpm --filter site build
pnpm --filter site check   # astro check
```

İkisi de hatasız geçmeden görev bitmiş sayılmaz. Gerekirse `pnpm --filter site exec wrangler deploy --dry-run` ile Worker yapılandırması doğrulanır.

## Ekran görüntüleri

Playwright ekran görüntüleri ve MCP çıktıları yalnızca yerel kanıttır: `site/ekran-goruntuleri/` ve `.playwright-mcp/` `.gitignore`'dadır; `public/` dışında oldukları için `dist/`'e de girmez (her build sonrası `find site/dist -iname "*ekran*"` boş olmalı). Bundan sonraki görüntüler de buraya kaydedilir.

## Ortam değişkenleri

- `SHOW_DRAFTS` (boolean, varsayılan `false`): yalnızca preview build'lerinde `true`. Şablon: `.env.example`. Gerçek `.env` repo'ya girmez.

## Özellikler ve çalışma kuralları

- **TMDB:** `pnpm site:tmdb` (kökten) `scripts/tmdb-fetch.ts`'i çalıştırır; `film.tmdbId`'li sinema yazıları için künye ve afişi `src/data/tmdb-cache.json` ve `src/data/tmdb/afis/` içine yazar. Cache'te olan yeniden çekilmez (`--yenile` ile hepsi). Build API'yi **asla** çağırmaz; yalnızca cache'i okur. Anahtar `TMDB_API_KEY` (site/.env); repo'ya girmez. Footer'daki TMDB atıf cümlesi kaldırılmaz. TMDB logosu: dosyayı `site/public/tmdb-logo.svg` (ya da `tmdb-logo.png`) olarak koyun; varsa footer'da atıf metninin solunda 14 px yükseklikte görünür, yoksa yalnızca metin atfı kalır (kod değişmez). Logo bu sitenin kendi başlığından belirgin olmamalı.
- **OG görselleri:** `src/pages/og/[bolum]/[slug].png.ts` + `src/lib/og.ts` (Satori + resvg). Renk/font DESIGN.md token'larıyla aynı. Türkçe için latin ve latin-ext fontları ayrı aile adıyla (`… Ext`) verilir; aynı adla iki font verilirse ğ ş tofuya düşer. Yeni OG tasarımı eklenince ğ ş ı İ içeren bir başlıkla PNG gözle kontrol edilir.
- **Arama:** build `astro build && pagefind --site dist` çalıştırır. Yalnızca `data-pagefind-body` taşıyan sayfalar indekslenir (yazı, proje, hakkımda). Arama arayüzü `/arama/` sayfasıdır; `dev`'de dizin yoktur, `pnpm build` + `astro preview` ile denenir.
- **Structured data:** `src/lib/jsonld.ts`. Her yazıda Article; `puan`'ı olan sinema yazısında ayrıca Review (itemReviewed: Movie).
- **Okuma süresi:** `src/lib/okuma-suresi.ts` (180 kelime/dk, görsel/tablo başına +8 sn).
- **Letterboxd şeridi:** `LETTERBOXD_RSS` tanımlıysa build'de çekilir; tanımsız ya da hatalıysa şerit hiç render edilmez. İstek `node:http(s)` ile atılır: Windows + Node 24'te global `fetch` (undici) Astro build'inin çıkışında `UV_HANDLE_CLOSING` ile çöküp `&& pagefind` adımını atlatıyordu. Build sırasında `fetch` kullanılmaz. (Çökme bu makinede yalnızca Letterboxd çağrısı eklendiğinde görüldü; sonradan aynı `fetch` kalıbını Node 24.15.0, 24.22.1 ve 22.23.4'te tek başına yeniden üretemedik. Kesin tetikleyici bilinmiyor; `node:http(s)` önlemi bu yüzden duruyor.)
- **Projeler:** süzgeç JS'siz, her tür kendi sayfası (`/projeler/tur/<tur>/`); `tur` adlı bir proje slug'ı kullanılmaz. Sıra: arşiv en sonda, sonra `oneCikan`, `sira`, ad. `durum: yakinda` projelerde canlı/mağaza bağlantısı ve gömülü oyun gösterilmez; net "Yakında" notu çıkar, `demoVideo` varsa kapak yerine öne çıkar. `embedUrl`'li projede `OyunKutusu`: tıklanmadan iframe ve istek yok; sandbox `allow-scripts allow-same-origin allow-pointer-lock`.
- **Ortam değişkenleri:** `SHOW_DRAFTS`, `TMDB_API_KEY`, `LETTERBOXD_RSS`, `CF_ANALYTICS_TOKEN` (hepsi `.env.example`'da).
