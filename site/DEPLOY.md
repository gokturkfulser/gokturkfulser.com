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

Tarayıcı konsolunda ana sayfa, bir yazı, `/search/` ve `/tr/arama/` ve oyunlu proje sayfasında CSP ihlali olmamalı (yerelde `wrangler dev` ile aynı denendi).

## 8. Bilmeniz gerekenler

- **`_headers` / `_redirects`** (Workers static assets, dokümandan): en fazla 100 header kuralı, satır başına 2.000 karakter; `_redirects` en çok 2.000 statik + 100 dinamik. Her dosya en fazla 25 MiB; Free planda sürüm başına 20.000 dosya (Paid 100.000). Redirect'ler header'lardan önce uygulanır; ikisi de yalnızca statik asset yanıtlarına işler (Worker kodunun yanıtlarına değil, bu sitede Worker kodu yok). Aynı header birden çok kuralla eşleşirse değerler **virgülle birleşir**, ezilmez: bu yüzden `Cache-Control` `/*` altına konmadı. Şu an 4 kural var.
- **CSP iki yerden gelir:** her HTML'de Astro'nun `<meta http-equiv="content-security-policy">` etiketi (script/style hash'leri + `directives`), ve `public/_headers`'ta yalnızca `frame-ancestors 'none'` (meta'da çalışmaz). İkisi birlikte uygulanır ve kesişir; header'da başka direktif olmadığı için çakışma yoktur. `_headers`'a başka CSP direktifi eklemeyin; ekleyecekseniz `astro.config.mjs` → `security.csp.directives`'e ekleyin.
- **`lab` Worker'ının tarafı:** `frame-src https://lab.gokturkfulser.com` bu sitede izinli; lab de `lab/public/_headers` ile `frame-ancestors 'self' https://gokturkfulser.com` gönderir, yani karşılıklı izin kurulu. Yerelde iki production build'i birlikte servis edip (`wrangler dev`) `kelime-avi` iframe'inin açıldığı, başka origin'den çerçevelemenin engellendiği doğrulandı.
- **Yeni harici kaynak** (ör. başka bir gömülü video sitesi, harici görsel, harici `.mp4`) CSP'ye `astro.config.mjs`'ten eklenmeden çalışmaz. Şu an izinliler: `static.cloudflareinsights.com` (script), `cloudflareinsights.com` (connect), `lab.gokturkfulser.com`, `www.youtube-nocookie.com`, `player.vimeo.com` (frame). Demo videoları kendi sitenizden (`media-src 'self'`) servis edilmelidir.
- **Pagefind** WebAssembly çalıştırır; `'wasm-unsafe-eval'` yalnızca `/search/` ve `/tr/arama/` sayfasının CSP'sine eklenir (`components/sayfa/Arama.astro`, `Astro.csp.insertScriptResource`).

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

## 10. Top 10 günlük otomasyonu (İnsan highlight makarası)

`.github/workflows/site-top10.yml` günde iki kez (**10:00 ve 16:00 İstanbul**; GitHub cron'u UTC olduğundan `0 7 * * *` ve `0 13 * * *`) NBA resmi YouTube kanalının son videolarına bakar. "NBA's Top 10 (ya da 5) Plays of the Night | <tarih>" başlıklı ve son 3 ABD gecesine denk gelen videolar için, dosyası yoksa Gemini'ye videonun resmi YouTube adresini verip `site/src/content/top10/<sezon>/<tarih>.yaml` dosyasını üretir, sitenin kendi içerik şemasıyla doğrular ve **doğrudan `main`'e commit'ler (PR yok)**. Bot yalnızca `site/src/content/top10/**` yazar. Mantık: `site/scripts/top10/`; kurallar: `site/CLAUDE.md` "Top 10 verisi".

### Gereken iki sır (Settings → Secrets and variables → Actions → New repository secret)

| Ad | Nereden |
| --- | --- |
| `YOUTUBE_API_KEY` | Google Cloud'da YouTube Data API v3 anahtarı (aşağıda) |
| `GEMINI_API_KEY` | Google AI Studio |
| `GEMINI_MODEL` (isteğe bağlı, **Variables** sekmesi) | Model kimliği; tanımlı değilse betiğin varsayılanı (`scripts/top10/ayarlar.ts`) |

Anahtarlar repoya, loga ve step summary'ye girmez; yerelde denemek için `site/.env`'e yazın (`.env.example` şablonu).

### YouTube Data API anahtarı (Google Cloud)

Kaynak: YouTube Data API "Getting started" ve Google Cloud "API keys" dokümanları.

1. Google Cloud Console'da bir proje seçin, **Enabled APIs** sayfasında **YouTube Data API v3**'ün açık olduğunu doğrulayın; değilse **API Library**'den etkinleştirin.
2. [Credentials sayfası](https://console.cloud.google.com/apis/credentials) → **Create credentials** → **API key**. Konsol en az bir kısıtlama ister; **Create** ile anahtar dizesini kopyalayın ve güvenli saklayın.
3. Anahtarın adına tıklayın → **API restrictions** → **Restrict key** → yalnızca **YouTube Data API v3**'ü seçin → **Save**. (Doküman kısıtlanmamış anahtarları güvensiz sayar.)
4. **Application restrictions** için GitHub'ın hosted runner'ları sabit IP'ye sahip olmadığından IP kısıtlaması uygun değildir; yalnızca API kısıtlaması kullanın. Anahtarı GitHub'da `YOUTUBE_API_KEY` secret'ı olarak kaydedin.
5. Kota: bu iş `playlistItems.list` kullanır (çağrı başına 1 birim; `search.list` 100 birim olurdu). Çalıştırma başına birkaç sayfa okunur, günlük varsayılan 10.000 birimin çok altındadır.

Gemini anahtarı: aistudio.google.com/apikey → **Create API key**. Anahtar ücretlendirmeye bağlı olabilir; Google Cloud'da faturalandırma uyarısı kurmanız önerilir (AI Studio dokümanı).

### Geçmiş geceleri toplu doldurma (yerelde)

Sezon başından beri eksik geceleri doldurmak için workflow kullanılmaz (günlük iş yalnızca son 3 geceye bakar); yerelde `site/.env` anahtarlarıyla: `pnpm --filter site top10 --otomatik --baslangic 2026-10-20 --bitis 2026-10-31` (bitiş verilmezse dün; en çok 31 gün). Betik oynatma listesini gerektiği kadar sayfalar, her gece için normal kuralları (oylama, doğrulamalar, kilitler) uygular, başarısız geceyi atlayıp devam eder ve sonda başarılı/başarısız/video yok listesi, sayfa sayısı ve YouTube kotasını yazar. Aynı komutu tekrar çalıştırmak yalnızca dosyası olmayan geceleri (başarısızları) işler. Üretilen `inceleme: bekliyor` dosyalarını gözden geçirip commit'leyin. Her gece oylama sayısı kadar Gemini çağrısı yaptığından büyük aralıklarda token maliyeti yüksektir; ilk denemede `--kuru` ya da kısa aralık kullanın.

### Doğruluk ayarları ve maliyet

Workflow her geceyi **3 kez** bağımsız işler ve satır satır çoğunluk oylaması yapar (`--oylama`, varsayılan 3); bu, tek çalıştırmaya göre yaklaşık 3 kat Gemini token'ı demektir. Video girdisi varsayılan olarak **yüksek çözünürlükte** gider (yaklaşık 3 kat daha fazla video token'ı); düşürmek için Settings → Secrets and variables → Actions → **Variables** sekmesinde `GEMINI_COZUNURLUK` tanımlayın (`low` gibi; boşsa `high`). Token harcaması step summary'de çağrı başına ve toplam olarak görünür; video başına üst sınırı aşan çağrı için uyarı çıkar. Oy birliği olmayan satırlar YAML yorumunda ve özetteki "Kontrol edilecek satırlar"da oy oranı ve alternatifleriyle listelenir.

### Model

Varsayılan model `gemini-3.8-flash`'tır (`scripts/top10/ayarlar.ts`). GitHub'da **Settings → Secrets and variables → Actions → Variables** sekmesindeki `GEMINI_MODEL` repository variable'ıyla değiştirilebilir (boşsa varsayılan). Model Google tarafından kaldırılır ya da adı değişirse çalıştırma `404`/`400` hatasıyla **kırmızı biter** (hiçbir gece dosyası yazılmaz, commit olmaz); `GEMINI_MODEL` değişkenini yeni model kimliğiyle güncelleyip workflow'u yeniden çalıştırın. Hangi model sürümünün kullanıldığı her çalıştırmanın step summary başında yazar.

### Oyuncu adları

Model aynı oyuncuyu farklı yazabilir ("Brayden Burries" / "Braden Burries"). Betik yalnızca sözlükteki takma adları ve normalleştirilmiş tam adı aynı olanları aynı kişi sayar; aynı takımda aynı soyadlı ama farklı ön adlı adayları (Jaylin / Jalen Williams gibi) ayrı bırakır ve step summary'de "benzer ad, aynı kişi mi? X / Y; aynıysa sözlüğe ekle, farklıysa yoksay" uyarısı verir; aynı kişiyse `site/src/content/top10/oyuncu-adlari.yaml`'a elle ekleyin (`Kanonik Ad: [Takma Ad]`). Sözlük çakışmaları (bir takma adın iki kanonik ada bağlanması vb.) hem betiği (çıkış 2) hem site build'ini durdurur.

### Workflow'u elle çalıştırma

**Actions → site-top10 → Run workflow** (`main`):

- Girdiler boşsa son 3 gece taranır (zamanlanmış çalıştırmayla aynı).
- `tarih` (YYYY-AA-GG, ABD gecesi) tek gece üretir; videoyu NBA kanalından bulur. İsteğe bağlı `url` o gece için video adresidir.
- `onayla` (virgülle ayrılmış tarihler, ör. `2026-10-20, 2026-10-21`) **yalnızca onaylar**: Gemini/YouTube çağrılmaz, anahtar gerekmez; verilen her gecenin dosyasında yalnızca `inceleme: bekliyor` satırı `onaylandi` olur ve `top10: onay <tarihler>` iletisiyle commit'lenir. Dosyası olmayan, zaten onaylı ya da `kaynak: elle` olan tarih step summary'de bilgi olarak yazılır (iş kırmızı bitmez); geçersiz tarih biçimi ya da `tarih`/`url`/`uzerine_yaz` ile birlikte kullanım hata verir (çıkış 2). Hangi gecelerin onaylanabileceğine kontrol sayfasından bakın (aşağıda).
- `uzerine_yaz` yalnızca bu elle çalıştırmada vardır: `kaynak: gemini` ve `inceleme: bekliyor` olan dosyayı yeniden üretir. Elle yazılmış ya da `inceleme: onaylandi` dosyaya hiçbir durumda dokunulmaz.

### İlk çalıştırmadan önce / sırasında kontrol edilecekler

1. **Örnek veri yok:** uydurma örnek gece dosyaları kaldırıldı (`YER-TUTUCULAR.md` bölüm 6); bot yalnızca gerçek geceleri yazar. `src/content/top10/oyuncu-adlari.yaml` sözlüğünü siz düzenlersiniz (bot yazmaz; workflow yalnızca `top10/<sezon>/<tarih>.yaml` gece dosyalarını commit'ler).
2. Önce `tarih` girdisiyle tek bir gece deneyin; Actions günlüğünde ve **step summary**'de gecenin sıralamasına, orta/düşük güvenli satırlara ve video bağlantısına bakın. Doğru model kimliğinin çalıştığını (hata `404`/`400` ise `GEMINI_MODEL` değişkenini düzeltin) ilk çalıştırmada görürsünüz.
3. Commit'in `main`'de `top10: <tarihler> (gemini)` iletisiyle ve `github-actions[bot]` yazarıyla göründüğünü doğrulayın. Dosya `inceleme: bekliyor` olduğundan sayfada gecenin altında "Bu gecenin verisi otomatik çıkarıldı, henüz kontrol edilmedi." notu çıkar.
4. **Cloudflare build history:** Workers Builds `main`'e her push'ta (bot dahil) build alır; `gokturkfulser-site` → **Deployments → View build history**'de bot commit'inin build tetiklediğini doğrulayın. Build watch paths `site/*` içerdiğinden `site/src/content/top10/**` değişikliği build'i çalıştırır (bölüm 3).
5. **`GITHUB_TOKEN` ile yapılan push başka GitHub workflow'larını tetiklemez** (GitHub dokümanı: "other `GITHUB_TOKEN`-triggered events do not create workflow runs at all"). Yani bot commit'i için `site.yml` (check/test/build) çalışmaz; beklenen davranıştır. Doğrulama zaten workflow içinde yapılır (birim testleri + `astro sync` ile içerik şeması). Cloudflare'in build'i GitHub Actions'tan bağımsızdır, o yüzden çalışır.
6. Zamanlanmış çalıştırmalar yoğun saatlerde gecikebilir ya da nadiren atlanabilir; günde iki çalıştırma bu yüzdendir. Eksik kalan gece bir sonraki çalıştırmada (3 gün içinde) yakalanır.

### Yanlış bir geceyi yeniden ürettirme

Bot bir geceyi bir kez üretir ve `inceleme: bekliyor` olduğu sürece tekrar dokunmaz. Model yanlış çıkardıysa: **Actions → site-top10 → Run workflow** (`main`) → `tarih` (YYYY-AA-GG), `url` (o gecenin YouTube adresi) ve **`uzerine_yaz` kutusunu işaretleyin**. Betik `--tarih ... --url ... --uzerine-yaz` ile yalnızca o geceyi yeniden üretir ve yeni dosyayı commit'ler. Adres yalnızca youtube.com/watch?v=<kimlik>, youtu.be/<kimlik> ya da youtube.com/shorts/<kimlik> olmalıdır; geçersiz adres hiçbir API çağrılmadan hata verir. Video herkese açık olmalı ve başlığı "Top 10/5 Plays of the Night" kalıbına uymalıdır (aksi hâlde Gemini çağrılmaz). Kutu işaretli değilse bekleyen dosya olduğu gibi kalır (özette "dokunulmadı… yeniden üretmek için uzerine_yaz" yazar). `kaynak: elle` ya da `inceleme: onaylandi` dosyaya bu yolla da dokunulmaz; önce dosyayı düzenleyin ya da silin. İstem metnini `site/scripts/top10/istem.md`'den değiştirip aynı yolla deneyebilirsiniz; yerelde önce `pnpm site:top10 <tarih> <url> --kuru --tekrar 2` ile (dosya yazmaz) iki çalıştırmanın tutarlılığına bakın.

### Bir geceyi düzeltme

Dosyayı açın (`site/src/content/top10/<sezon>/<tarih>.yaml`), oyuncu/takım/rol/eylem/pay değerlerini düzeltin ve `inceleme: bekliyor` satırını `inceleme: onaylandi` yapın. Bot onaylı dosyaya bir daha dokunmaz; sayfadaki not kalkar. Dosyayı baştan ürettirmek isterseniz (henüz onaylamadıysanız) Actions'tan `tarih` + `uzerine_yaz` ile çalıştırın.

### Kontrol sayfası ve önizleme (`top10-kontrol` dalı)

Bekleyen (`inceleme: bekliyor`) gecelerin bakılacak satırlarını mobilde rahat görmek için **`/kontrol/top10/`** sayfası vardır. Sayfa yalnızca `SHOW_DRAFTS=true` build'inde üretilir; production'da (main) yoktur. Workflow her çalıştırmanın sonunda main'in ucunu **`top10-kontrol`** dalına gönderir (yalnızca main'in aynası; force push yalnızca bu dala). Cloudflare Workers Builds main dışı dalları önizleme olarak derler ve `scripts/workers-build.mjs` bu dalda `SHOW_DRAFTS=true` yapar; böylece sayfa güncel veriyle önizlemede görünür. Akış: bot commit atar (üretim ya da onay) → aynı commit `top10-kontrol` dalına gider → Cloudflare dalı derler → önizleme adresinde sayfayı açıp satırlara bakarsınız → onaylamak için Actions → site-top10 → Run workflow → `onayla` alanına tarihleri yazarsınız.

**Önizleme adresi (dokümandan):** `https://top10-kontrol-gokturkfulser-site.<alt-alan>.workers.dev/kontrol/top10/`. Cloudflare "Previews → URLs": workers.dev önizleme adresi `<önizleme-adı>-<worker-adı>.<alt-alan>.workers.dev`, önizleme adı varsayılan olarak Git dalının adıdır; Worker adı `gokturkfulser-site`. `<alt-alan>` hesabınızın workers.dev alt alanıdır (Workers & Pages → Worker → Settings → Domains & Routes ya da dashboard'daki workers.dev alt alanı); repodan bilinmez, bu yüzden yukarıda yer tutucudur. Adres, push'tan sonra da aynı kalır ("always serves the latest deployment"). Sayfanın en altında da aynı biçim yazar.

**Kaynaklar (okundu):** developers.cloudflare.com/workers/ci-cd/builds/build-branches/ ("Configure preview builds": Settings → Build → Branch control → Enable Preview Builds; main dışı her dal push'unda build komutu + Preview komutu, varsayılan `npx wrangler preview`), /workers/previews/ ("URLs" tablosu), /workers/previews/custom-domains/ (workers.dev önizlemelerine `X-Robots-Tag: noindex` otomatik eklenir; özel alan adında eklenmez), /workers/ci-cd/builds/configuration/ (Workers Builds `WORKERS_CI_BRANCH` gibi varsayılan ortam değişkenlerini build'e enjekte eder), /workers/ci-cd/builds/api-reference/ (Preview'lerin kendi build değişkenleri vardır: `previews_base_config.environment_variables`), changelog 2026-09-22 "Worker Previews". GitHub: docs.github.com "Events that trigger workflows" (GITHUB_TOKEN ile yapılan push başka workflow tetiklemez) ve `git push --force` açık refspec'i.

**Doğrulanamayanlar ve ilk çalıştırmada kontrol edilecekler** (kurulum yapıldı, ama bunlar dokümanda kesin değildi ya da hesabınıza bağlı):

1. **Preview builds açık mı?** Settings → Build → Branch control → **Enable Preview Builds**. Varsayılanını doküman yeni Worker'lar için açık gibi anlatıyor; eski bir bağlantıysa "Set up Worker Previews" bannerıyla tek yönlü geçiş gerekebilir (geri alınamaz; Preview komutu `npx wrangler preview` olur). Doğrulayın.
2. **`SHOW_DRAFTS` önizlemede gerçekten `true` mu?** `workers-build.mjs` bunu dal adından (`WORKERS_CI_BRANCH`) türetir; doküman değişkenin build'e enjekte edildiğini yazıyor ama **önizleme build'lerinde de aynı olduğunu açıkça söylemiyor**. İlk `top10-kontrol` build logunda `workers-build: dal=top10-kontrol SHOW_DRAFTS=true` satırını arayın; `dal=(yerel)` ya da `SHOW_DRAFTS=false` ise Preview build değişkenlerine `SHOW_DRAFTS=true` ekleyin (önizlemelerin build değişkenleri production'dan ayrıdır; `TMDB_API_KEY`/`LETTERBOXD_RSS` de oraya eklenmedikçe önizleme afişsiz/şeritsiz derlenir, build yine başarılıdır).
3. **workers.dev Preview URL'si açık mı?** Wrangler dokümanına göre `preview_urls` yazılmazsa başlangıç değeri `workers_dev`'e bağlıdır; `wrangler.jsonc`'da bu ayar yoktur (bu görevde değiştirilmedi). Worker → Domains & Routes → Worker URL altında **Preview** açık olmalı; kapalıysa `wrangler.jsonc`'a `"preview_urls": true` eklemek ayrı bir değişikliktir.
4. **Önizleme herkese açık:** adresi bilen herkes görür (taslak içerikler ve kontrol verisi dahil); arama motorlarına karşı `noindex` var (header + meta), erişim için gerekirse Cloudflare Access ile korunabilir (doküman: workers/previews/custom-domains → "Protect Preview content").
5. **Build watch paths:** bölüm 3'teki `site/*` kuralı önizleme build'lerine de uygulanıyorsa ve bot'un `top10-kontrol` push'u (main'dekiyle aynı commit) "değişen dosya" üretmiyorsa Cloudflare build'i atlayabilir. İlk push'tan sonra Deployments → View build history'de `top10-kontrol` build'inin tetiklendiğini doğrulayın; tetiklenmediyse önizleme için watch path kısıtını kaldırın.
6. **Force push izni:** `GITHUB_TOKEN` (`contents: write`) ile `top10-kontrol` dalına force push, dalda koruma kuralı yoksa çalışır. `.github/workflows/**` dosyalarını içeren commit'lerin yeni dala itilmesinde `workflows` izni istenip istenmediği dokümandan doğrulanamadı (commit'ler zaten main'de olduğundan beklenmez); adım `refusing to allow a GitHub App to create or update workflow` hatası verirse bildirin. İlk çalıştırmada adımın yeşil bittiğini ve GitHub'da `top10-kontrol` dalının main ile aynı commit'te olduğunu kontrol edin.
7. **actionlint** bu ortamda çalıştırılamadı (kurulu değil); workflow'un YAML yapısı ve `run` bloklarının bash sözdizimi (`bash -n`) ayrıca denendi. `infra.yml` zaten tüm workflow'ları actionlint'ler; ilk push'ta orada da denetlenir.
