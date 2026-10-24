# site/ → Cloudflare Workers Builds kurulumu

Hedef: `gokturkfulser-site` Worker'ı, bu repodan (`gokturkfulser/gokturkfulser.com`, private) her `main` push'unda `gokturkfulser.com`'a yayımlanır; diğer dallar preview build'i alır. Bu dosyadaki her değer dashboard'a olduğu gibi girilir.

> Not: Aynı repoya ikinci Worker (`gokturkfulser-lab`) ayrıca bağlanır; adımlar aynıdır, yalnızca ad, komutlar ve watch path'ler `lab/` için değişir (lab görevinde yazılır).

## 1. Repo bağlama

1. dash.cloudflare.com → **Workers & Pages** → **Create application** → **Import a repository** (Connect to Git) → **GitHub**.
2. GitHub'da **Cloudflare Workers & Pages** uygulaması yüklenirken **Only select repositories** seçin ve yalnızca **`gokturkfulser/gokturkfulser.com`** işaretleyin (**All repositories** seçmeyin). Sonradan değiştirmek: GitHub → Settings → Applications → Cloudflare Workers & Pages → Configure.
3. Repoyu seçin, **Next**.
4. **Project name: `gokturkfulser-site`**. Bu ad `site/wrangler.jsonc` içindeki `name` ile birebir aynı olmalı; farklıysa build `wrangler deploy` aşamasında uyarı/hata verir.
5. **Production branch: `main`**.

## 2. Build ayarları (Settings → Build)

Monorepo yöntemi: **Root directory boş (repo kökü)**. Lockfile (`pnpm-lock.yaml`) ve `pnpm-workspace.yaml` kökte olduğu için `pnpm install` kökten çalışır; paket `--filter site` ile seçilir. (Cloudflare dokümanı root directory'yi "build ve deploy komutlarının çalıştığı yer, Wrangler config'in bulunduğu klasör" olarak anlatıyor ama bağımlılık kurulumunun nerede çalıştığını açıklamıyor; kökten çalıştırmak bu belirsizliği ortadan kaldırır.)

| Alan | Değer |
| --- | --- |
| Root directory | *(boş bırakın)* |
| Build command | `pnpm --filter site build:workers` |
| Deploy command | `pnpm --filter site exec wrangler deploy` |
| Non-production branch deploy / Preview command | `pnpm --filter site exec wrangler preview` |
| Enable Preview Builds (Branch control) | işaretli |
| API token | varsayılan (Cloudflare'in otomatik oluşturduğu) |

Neden böyle:

- Varsayılan deploy komutu `npx wrangler deploy` kökte çalışır ve `wrangler` kök `package.json`'da olmadığı için bulunamaz. `pnpm --filter site exec` komutu `site/` içinde, `site/package.json`'daki Wrangler sürümüyle çalıştırır; `wrangler.jsonc`'deki `./dist` o dosyaya göre çözülür.
- `build:workers` (`site/scripts/workers-build.mjs`) `pnpm build`'i (`astro build && pagefind --site dist`) çalıştırır ve `WORKERS_CI_BRANCH` değişkenine bakar: dal `main` değilse `SHOW_DRAFTS=true`, `main` ise `false` yapar. Yani preview'da taslaklar görünür ve `noindex` + `Disallow: /` otomatik gelir; production'da hiçbir taslak çıkmaz.
- Önizleme komutu (`wrangler preview`) için de aynı `pnpm --filter site exec` ön eki gerekir, aksi halde kökte `wrangler` bulunamaz.

## 3. Build watch paths (Settings → Build → Build watch paths)

**Include paths** (her biri ayrı satır/giriş):

```
site/*
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
.nvmrc
```

**Exclude paths:** boş.

Dokümana göre: `*` sıfır veya daha fazla karakterle eşleşir ve kuralın başında/sonunda ya da tek başına kullanılabilir; önce exclude'lara bakılır, kalan yollar include'larla karşılaştırılır, hiçbiri eşleşmezse build atlanır. Varsayılan include `*`, yani her push build tetikler. `site/*` alt klasörlerdeki dosyaları da kapsar (`*` yol ayracıyla sınırlı değildir). Dokümanda, root directory boşken yolların repo köküne göre olduğu açıkça yazmıyor; örnekleri (`project-a/*`) repo köküne göre. Kurduktan sonra sınayın: yalnızca `lab/` altında bir dosya değiştirip push edin, `gokturkfulser-site` için build **tetiklenmemeli**.

Zorunlu build durumları: değişiklik içermeyen push, 3.000+ dosya veya 20+ commit'lik push yol eşleşmesine bakılmadan build alır.

## 4. Build variables and secrets (Settings → Build → Variables and secrets)

Bunlar **build değişkenleri**: site statik olduğu için değerler build sırasında HTML'e gömülür; çalışma zamanı (Worker) değişkeni değildir.

| Ad | Değer | Zorunlu mu |
| --- | --- | --- |
| `NODE_VERSION` | `24.21.0` | Hayır. Node sürümü kökteki `.nvmrc`'den okunur (kök CLAUDE.md "Sürümler"); yine de eklemek istenirse tek kaynak ile aynı değer. |
| `CF_ANALYTICS_TOKEN` | Cloudflare Web Analytics site token'ı | İsteğe bağlı. Tanımlıysa her sayfaya beacon eklenir; tanımsızsa hiç eklenmez. |
| `LETTERBOXD_RSS` | `https://letterboxd.com/<kullanici>/rss/` | İsteğe bağlı. Tanımsızsa ana sayfadaki "Son izlediklerim" şeridi çizilmez. |

`CF_ANALYTICS_TOKEN` nasıl alınır: dash → **Analytics & Logs → Web Analytics → Add a site** → hostname `gokturkfulser.com`; verilen snippet'teki `"token"` değeri. Çift sayımı önlemek için bu sayfa kendi script'imizi gömdüğünden, aynı site için otomatik (edge) enjeksiyon açıksa kapalı tutun.

**`SHOW_DRAFTS` tanımlamayın.** Preview'da `true` olması isteniyordu; Cloudflare dokümanı production ve preview build değişkenlerinin ayrı ayrı girilebildiğini belirtmiyor (Worker Previews ayarları yalnızca çalışma zamanını kapsıyor). Bu yüzden değer daldan türetilir (bkz. bölüm 2). Dashboard'da preview için ayrı build değişkeni alanı görürseniz oraya `SHOW_DRAFTS=true` eklemek de zararsızdır, `build:workers` zaten aynı sonucu verir.

`TMDB_API_KEY` build'de **kullanılmaz** (TMDB verisi `pnpm site:tmdb` ile yerelde çekilip `src/data/` altına yazılır, repoya girer); dashboard'a koymayın.

## 5. Custom domain

1. `gokturkfulser-site` → **Settings → Domains & Routes → Add → Custom domain**.
2. `gokturkfulser.com` yazın, onaylayın. Zone Cloudflare'de olmalı; apex'te eski bir A/AAAA/CNAME kaydı varsa Cloudflare üzerine yazmayı önerir, onaylayın.
3. **www:** `www.gokturkfulser.com` → `gokturkfulser.com` yönlendirmesi zaten kurulu, **bu Worker'a ayrıca www eklemeyin**. Sonra kontrol edin: `curl -sI https://www.gokturkfulser.com/` yanıtı `301`/`308` ve `location: https://gokturkfulser.com/` olmalı.
4. İsteğe bağlı: aynı sayfadan `workers.dev` alt alan adını ve preview URL'lerini erişime kapatın ya da yalnızca tarama dışı bırakın (aynı içeriğin ikinci adreste dizinlenmemesi için). Preview'lar zaten `noindex`.

## 6. Search Console

1. search.google.com/search-console → **Add property → Domain** → `gokturkfulser.com`.
2. Verilen **TXT** kaydını Cloudflare DNS'e ekleyin (Name `@`, TTL Auto) → Verify.
3. **Sitemaps** → `https://gokturkfulser.com/sitemap-index.xml` gönderin. (Production'da gerçek içerik olana kadar sitemap yalnızca statik sayfaları listeler.)
4. Yayından sonra **URL inspection** ile ana sayfayı ve ilk yazıyı test edin.

## 7. İlk deploy sonrası doğrulama

```powershell
curl.exe -sI https://gokturkfulser.com/            # content-security-policy: frame-ancestors 'none', referrer-policy, permissions-policy, x-content-type-options, cache-control: max-age=300
curl.exe -sI https://gokturkfulser.com/_astro/<herhangi-bir-dosya>   # cache-control: public, max-age=31536000, immutable
curl.exe -s https://gokturkfulser.com/ | Select-String 'content-security-policy'   # meta etiketi (script-src/style-src hash'leri)
```

Tarayıcı konsolunda ana sayfa, bir yazı, `/arama/` ve oyunlu proje sayfasında CSP ihlali olmamalı (yerelde `wrangler dev` ile aynı denendi).

## 8. Bilmeniz gerekenler

- **`_headers` / `_redirects`** (Workers static assets, dokümandan): en fazla 100 header kuralı, satır başına 2.000 karakter; `_redirects` en çok 2.000 statik + 100 dinamik. Her dosya en fazla 25 MiB; Free planda sürüm başına 20.000 dosya (Paid 100.000). Redirect'ler header'lardan önce uygulanır; ikisi de yalnızca statik asset yanıtlarına işler (Worker kodunun yanıtlarına değil, bu sitede Worker kodu yok). Aynı header birden çok kuralla eşleşirse değerler **virgülle birleşir**, ezilmez: bu yüzden `Cache-Control` `/*` altına konmadı. Şu an 4 kural var.
- **CSP iki yerden gelir:** her HTML'de Astro'nun `<meta http-equiv="content-security-policy">` etiketi (script/style hash'leri + `directives`), ve `public/_headers`'ta yalnızca `frame-ancestors 'none'` (meta'da çalışmaz). İkisi birlikte uygulanır ve kesişir; header'da başka direktif olmadığı için çakışma yoktur. `_headers`'a başka CSP direktifi eklemeyin; ekleyecekseniz `astro.config.mjs` → `security.csp.directives`'e ekleyin.
- **`lab` Worker'ının tarafı:** `frame-src https://lab.gokturkfulser.com` bu sitede izinli; ama lab sayfalarının `gokturkfulser.com` tarafından çerçevelenmesine izin vermesi lab'ın işidir (`Content-Security-Policy: frame-ancestors https://gokturkfulser.com`, `X-Frame-Options: DENY` olmamalı).
- **Yeni harici kaynak** (ör. başka bir gömülü video sitesi, harici görsel, harici `.mp4`) CSP'ye `astro.config.mjs`'ten eklenmeden çalışmaz. Şu an izinliler: `static.cloudflareinsights.com` (script), `cloudflareinsights.com` (connect), `lab.gokturkfulser.com`, `www.youtube-nocookie.com`, `player.vimeo.com` (frame), `*.ltrbxd.com` (img). Demo videoları kendi sitenizden (`media-src 'self'`) servis edilmelidir.
- **Pagefind** WebAssembly çalıştırır; `'wasm-unsafe-eval'` yalnızca `/arama/` sayfasının CSP'sine eklenir (`src/pages/arama.astro`, `Astro.csp.insertScriptResource`).
