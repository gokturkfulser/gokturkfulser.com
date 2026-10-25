# site/ → Cloudflare Workers Builds kurulumu

Hedef: `gokturkfulser-site` Worker'ı, bu repodan (`gokturkfulser/gokturkfulser.com`, private) her `main` push'unda `gokturkfulser.com`'a yayımlanır; diğer dallar preview build'i alır. Bu dosyadaki her değer dashboard'a olduğu gibi girilir.

> Not: Aynı repoya ikinci Worker (`gokturkfulser-lab`) ayrıca bağlanır; adımlar aynıdır, değerler [lab/DEPLOY.md](../lab/DEPLOY.md)'dedir.

## 1. Repo bağlama

1. dash.cloudflare.com → **Workers & Pages** → **Create application** → **Import a repository** (Connect to Git) → **GitHub**.
2. GitHub'da **Cloudflare Workers & Pages** uygulaması yüklenirken **Only select repositories** seçin ve yalnızca **`gokturkfulser/gokturkfulser.com`** işaretleyin (**All repositories** seçmeyin). Sonradan değiştirmek: GitHub → Settings → Applications → Cloudflare Workers & Pages → Configure.
3. Repoyu seçin, **Next**.
4. **Project name: `gokturkfulser-site`**. Bu ad `site/wrangler.jsonc` içindeki `name` ile birebir aynı olmalı; farklıysa build `wrangler deploy` aşamasında uyarı/hata verir.
5. **Production branch: `main`**.

## 2. Kurulum ekranındaki alanlar (Settings → Build)

Kurulum ekranında **Build command**, **Deploy command** ve **Preview command** alanları vardır.

Monorepo yöntemi: **Root directory boş (repo kökü)**. Lockfile (`pnpm-lock.yaml`) ve `pnpm-workspace.yaml` kökte olduğu için `pnpm install` kökten çalışır; paket `--filter site` ile seçilir. (Cloudflare dokümanı root directory'yi "build ve deploy komutlarının çalıştığı yer, Wrangler config'in bulunduğu klasör" olarak anlatıyor ama bağımlılık kurulumunun nerede çalıştığını açıklamıyor; kökten çalıştırmak bu belirsizliği ortadan kaldırır.)

| Alan | Değer |
| --- | --- |
| Root directory | *(boş bırakın)* |
| Build command | `pnpm --filter site build:workers` |
| Deploy command | `pnpm --filter site exec wrangler deploy` |
| Preview command | `pnpm --filter site exec wrangler preview` |
| Enable Preview Builds (Branch control) | işaretli |
| API token | varsayılan (Cloudflare'in otomatik oluşturduğu) |

Neden böyle:

- Varsayılan deploy komutu `npx wrangler deploy` kökte çalışır ve `wrangler` kök `package.json`'da olmadığı için bulunamaz. `pnpm --filter site exec` komutu `site/` içinde, `site/package.json`'daki Wrangler sürümüyle çalıştırır; `wrangler.jsonc`'deki `./dist` o dosyaya göre çözülür.
- `build:workers` (`site/scripts/workers-build.mjs`) `pnpm build`'i (`astro build && pagefind --site dist`) çalıştırır ve `WORKERS_CI_BRANCH` değişkenine bakar: dal `main` değilse `SHOW_DRAFTS=true`, `main` ise `false` yapar. Yani preview'da taslaklar görünür ve `noindex` + `Disallow: /` otomatik gelir; production'da hiçbir taslak çıkmaz.
- **Preview command** için varsayılan `npx wrangler preview`'dır; kökte `wrangler` bulunmadığı için aynı `pnpm --filter site exec` ön ekiyle yazılır. Wrangler bu komutu tanımazsa (eski sürüm) yerine `pnpm --filter site exec wrangler versions upload` kullanın. Bu repodaki Wrangler 4.152 ikisini de tanıyor (yerelde doğrulandı).

## 3. Build watch paths (Settings → Build → Build watch paths)

**Cloudflare'in varsayılan include kalıbı `*`'dır (her push build tetikler). Önce onu silin**; aksi halde aşağıdaki kısıtlama hiçbir işe yaramaz, çünkü `*` her şeyle eşleşir.

**Include paths** (varsayılan `*` silindikten sonra, (her biri ayrı satır/giriş):

```
site/*
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
.nvmrc
```

**Exclude paths:** boş.

Dokümana göre: `*` sıfır veya daha fazla karakterle eşleşir ve kuralın başında/sonunda ya da tek başına kullanılabilir; önce exclude'lara bakılır, kalan yollar include'larla karşılaştırılır, hiçbiri eşleşmezse build atlanır. `site/*` alt klasörlerdeki dosyaları da kapsar (`*` yol ayracıyla sınırlı değildir). Dokümanda, root directory boşken yolların repo köküne göre olduğu açıkça yazmıyor; örnekleri (`project-a/*`) repo köküne göre. Kurduktan sonra sınayın: yalnızca `lab/` altında bir dosya değiştirip push edin, `gokturkfulser-site` için build **tetiklenmemeli**.

Zorunlu build durumları: değişiklik içermeyen push, 3.000+ dosya veya 20+ commit'lik push yol eşleşmesine bakılmadan build alır.

## 4. Build variables and secrets (Settings → Build → Variables and secrets)

Değişkenler **Settings → Build → Variables and secrets** bölümüne girilir. Bunlar **build değişkenleri**: site statik olduğu için değerler build sırasında HTML'e gömülür. **Settings → Variables & Secrets** (runtime) bölümüne girilen değerler build sırasında görünmez ve bu sitede işe yaramaz (Worker kodu yok); oraya bir şey girmeyin.

| Ad | Değer | Zorunlu mu |
| --- | --- | --- |
| `NODE_VERSION` | `24.21.0` | Hayır. Node sürümü kökteki `.nvmrc`'den okunur (kök CLAUDE.md "Sürümler"); yine de eklemek istenirse tek kaynak ile aynı değer. |
| `CF_ANALYTICS_TOKEN` | Cloudflare Web Analytics site token'ı | İsteğe bağlı. Tanımlıysa her sayfaya beacon eklenir; tanımsızsa hiç eklenmez. |
| `LETTERBOXD_RSS` | `https://letterboxd.com/<kullanici>/rss/` | İsteğe bağlı. Tanımsızsa ana sayfadaki "Son izlediklerim" şeridi çizilmez. |
| `TMDB_API_KEY` | TMDB v4 "API Read Access Token" (ya da v3 anahtarı) | İsteğe bağlı. Şeridin afişlerini her build'de TMDB'den indirir. **Secret** olarak girin (Type: Secret). Yoksa ya da TMDB'ye ulaşılamazsa build yine başarılı olur, şerit afişsiz (yalnızca metin) çizilir. |

`CF_ANALYTICS_TOKEN` nasıl alınır: dash → **Analytics & Logs → Web Analytics → Add a site** → hostname `gokturkfulser.com`; verilen snippet'teki `"token"` değeri. Çift sayımı önlemek için bu sayfa kendi script'imizi gömdüğünden, aynı site için otomatik (edge) enjeksiyon açıksa kapalı tutun.

**`SHOW_DRAFTS` tanımlamayın.** Preview'da `true` olması isteniyordu; Cloudflare dokümanı production ve preview build değişkenlerinin ayrı ayrı girilebildiğini belirtmiyor (Worker Previews ayarları yalnızca çalışma zamanını kapsıyor). Bu yüzden değer daldan türetilir (bkz. bölüm 2). Dashboard'da preview için ayrı build değişkeni alanı görürseniz oraya `SHOW_DRAFTS=true` eklemek de zararsızdır, `build:workers` zaten aynı sonucu verir.

**TMDB iki ayrı yoldan kullanılır:**

- Sinema yazılarının künyesi, afişi ve backdrop'u `pnpm site:tmdb` ile yerelde çekilir, `src/data/tmdb/` altına yazılır ve repoya girer (build bu veriyi okur; anahtar gerekmez).
- "Son izlediklerim" afişleri her build'in başında `pnpm --filter site afisler` ile (`site/scripts/letterboxd-afis.ts`, `build` betiği zaten çalıştırır) `TMDB_API_KEY` ve `LETTERBOXD_RSS` build değişkenleriyle indirilir; `src/data/letterboxd/` `.gitignore`'dadır, repoya girmez. Bu yüzden Workers Builds'te `TMDB_API_KEY`'in tanımlı olması gerekir (aksi hâlde şerit afişsiz çizilir). GitHub Actions'taki `site.yml` kalite build'leri anahtarsız çalışır ve afişsiz şerit üretir; sorun değildir.

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
- **`lab` Worker'ının tarafı:** `frame-src https://lab.gokturkfulser.com` bu sitede izinli; lab de `lab/public/_headers` ile `frame-ancestors 'self' https://gokturkfulser.com` gönderir, yani karşılıklı izin kurulu. Yerelde iki production build'i birlikte servis edip (`wrangler dev`) `kelime-avi` iframe'inin açıldığı, başka origin'den çerçevelemenin engellendiği doğrulandı.
- **Yeni harici kaynak** (ör. başka bir gömülü video sitesi, harici görsel, harici `.mp4`) CSP'ye `astro.config.mjs`'ten eklenmeden çalışmaz. Şu an izinliler: `static.cloudflareinsights.com` (script), `cloudflareinsights.com` (connect), `lab.gokturkfulser.com`, `www.youtube-nocookie.com`, `player.vimeo.com` (frame). Demo videoları kendi sitenizden (`media-src 'self'`) servis edilmelidir.
- **Pagefind** WebAssembly çalıştırır; `'wasm-unsafe-eval'` yalnızca `/arama/` sayfasının CSP'sine eklenir (`src/pages/arama.astro`, `Astro.csp.insertScriptResource`).

## 9. Günlük otomatik build (son izlediklerim güncel kalsın)

Site statik olduğundan "Son izlediklerim" şeridi yalnızca build anında güncellenir. Yeni film izleyip hiçbir şey push etmesenizde şerit tazelensin diye her gün bir build tetiklenir.

**Yol: Workers Builds Deploy Hook + GitHub Actions cron.** Cloudflare dokümanına göre (Workers → CI/CD → Builds → Deploy Hooks, 1 Nisan 2026 changelog'u) bir Deploy Hook, belirli bir dala bağlı benzersiz bir URL'dir; `POST` atınca Worker o daldan build edip deploy eder. Ayrı bir API token gerekmez: URL'nin kendisi gizlidir. (Alternatif olan Builds API `POST /builds/triggers/{trigger_uuid}/builds` kullanıcı kapsamlı bir API token, hesap kimliği ve trigger UUID ister; daha çok sır ve daha çok adım demektir, bu yüzden seçilmedi.) Hook'lar dakikada Worker başına 10, hesap başına 100 build ile sınırlıdır; hook birden fazla tetiklenirse ilk build başlamadan gelen fazlalıklar otomatik atlanır.

### Cloudflare'de yapmanız gerekenler

1. dash.cloudflare.com → **Workers & Pages** → `gokturkfulser-site` → **Settings → Builds → Deploy Hooks**.
2. **Create deploy hook** → ad: `gunluk-yenileme`, **branch: `main`** → oluşturun.
3. Çıkan URL'yi kopyalayın (`https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/<ID>`). Bu URL bir sırdır; sohbete, repoya, issue'ya yazmayın. Sızarsa hook'u silip yenisini oluşturun.
4. Aynı sayfada (Settings → Build → Variables and secrets) `TMDB_API_KEY` (Secret) ve `LETTERBOXD_RSS` değişkenlerinin tanımlı olduğunu doğrulayın (bölüm 4).

### GitHub'da yapmanız gerekenler

1. GitHub → `gokturkfulser/gokturkfulser.com` → **Settings → Secrets and variables → Actions → New repository secret**.
2. Name: `CF_DEPLOY_HOOK_URL`, Secret: 3. adımdaki URL.
3. Workflow dosyası `.github/workflows/site-gunluk-build.yml` repoda hazırdır: her gün **04:00 İstanbul** (`cron: '0 1 * * *'`; GitHub cron'u UTC çalışır, İstanbul UTC+3 olduğundan 01:00 UTC) hook'a `POST` atar. Repoya commit atmaz (`permissions: {}`), kod çekmez. **Actions → site-gunluk-build → Run workflow** ile elle de çalıştırılabilir.

### Doğrulama

- Actions'ta workflow'u elle çalıştırın: adım yeşil olmalı. Sonra Cloudflare → `gokturkfulser-site` → **Deployments → View build history**: build'in kaynağında Deploy Hook adı (`gunluk-yenileme`) görünür.
- Build günlüğünde `letterboxd-afis: N/M afiş indirildi.` satırını arayın.

### Bilinmeyenler (dokümanda yok, ilk çalıştırmada kontrol edin)

- Deploy Hook ile tetiklenen build'in **Build watch paths** kuralından muaf olup olmadığı dokümanda yazmıyor; yol kuralları dosya değişikliğine baktığı için hook build'inin çalışması beklenir. İlk elle çalıştırmada build history'de "Skipped" görürseniz watch paths'e `site/*` zaten ekli olduğundan bunu bildirin.
- GitHub zamanlanmış workflow'ları yoğun saatlerde birkaç dakika gecikebilir; 60 gün hiç etkinlik olmayan **public** repolarda otomatik durdurulur (bu repo private).
