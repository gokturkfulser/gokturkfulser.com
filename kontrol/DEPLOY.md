# kontrol/ → Cloudflare Workers Builds, Access ve GitHub kurulumu

Hedef: `nba-daily-top10-control` Worker'ı bu repodan (`gokturkfulser/gokturkfulser.com`, private) her `main` push'unda **nba-daily-top10-control.gokturkfulser.com**'a yayımlanır; adres **Cloudflare Access** arkasındadır ve yalnızca sizin e-postanıza izin verir. Uygulama, gece dosyalarını ve ad sözlüğünü GitHub contents API ile `main`'e commit eder; site her zamanki gibi Workers Builds ile yayınlanır. Yöntem [site/DEPLOY.md](../site/DEPLOY.md) ile aynıdır (ikinci/üçüncü Worker olarak aynı repoya bağlanır). Her değer dashboard'a olduğu gibi girilir.

> Kaynaklar (okundu): developers.cloudflare.com → Workers: `ci-cd/builds/advanced-setups` (monorepo, root directory, watch paths), `ci-cd/builds/configuration` (Build/Deploy/Preview command; `wrangler.jsonc`'daki "custom builds" Workers Builds'te uygulanmaz), `static-assets/binding` (`assets.binding`, `run_worker_first`), `configuration/secrets` (secret ve `.dev.vars`), `configuration/cloudflare-access`, `wrangler/configuration`; Zero Trust: `cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json` (JWT doğrulama: başlık, açık anahtar adresi, AUD, `iss`), `tutorials/ai-wrapper-tenant-control` (Worker'ı custom domain + Access ile koruma adımları), `access-controls/applications/http-apps/self-hosted-public-app`. GitHub: docs.github.com → REST `repos/contents` (GET/PUT, `sha`, `branch`, 1 MB sınırı), "Permissions required for fine-grained personal access tokens" (Contents: write / read), "Managing your personal access tokens" (fine-grained token oluşturma).

## Mimari (kısaca)

- **Klasör `kontrol/`** (repo kökünde, kendi `wrangler.jsonc`, ayrı Worker): her dağıtılabilir birim kendi klasöründedir (`site/` → `gokturkfulser-site`, `lab/` → `gokturkfulser-lab`); `kontrol/` bu düzenin istisnasıdır, Worker adı `nba-daily-top10-control`. `site/` içine konmadı: ana sitenin Worker'ı, CSP'si, sıfır-JS kuralı ve watch path'leri değişmesin; `lab/` içine konmadı: lab statik mini sitelerdir.
- Şema, pay kuralları, ad sözlüğü mantığı ve "bakılacak satır" kuralı `site/src/lib/` içinden **paylaşılır** (kopyalanmaz); renkler `site/src/styles/tokens.css`'ten her build'de `public/stil.css`'e birleştirilir.
- Her istek (statik varlıklar dahil, `run_worker_first: true`) önce **Access JWT doğrulamasından** geçer (`src/erisim.ts`); GitHub'a yalnızca iki beyaz listeli yol türü ile erişilir (`src/yollar.ts`): gece dosyaları (`site/src/content/top10/<sezon>/<YYYY-AA-GG>.yaml`) ve `site/src/content/top10/oyuncu-adlari.yaml`; yazma yalnızca bu ikisine. Geceler listesi için ek olarak yalnızca `site/src/content/top10` ve sezon klasörlerinin dizin listesi okunur (yazma yok). Repo ve dal sabittir (`gokturkfulser/gokturkfulser.com`, `main`).
- `workers_dev` ve `preview_urls` kapalıdır; yalnızca custom domain vardır.

## 1. GitHub: fine-grained token

Kaynak: GitHub Docs "Managing your personal access tokens".

1. GitHub → profil resmi → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. **Token name:** `nba-daily-top10-control`. **Expiration:** bir süre seçin (süre dolunca editör GitHub hatası verir; yenileyip secret'ı güncelleyin).
3. **Resource owner:** `gokturkfulser` (repo sahibi hesap).
4. **Repository access:** **Only select repositories** → yalnızca **`gokturkfulser/gokturkfulser.com`**.
5. **Permissions → Repository permissions:** yalnızca **Contents: Read and write**. Başka izin vermeyin (Workflows, Pull requests vb. yok; editör yalnızca YAML veri dosyalarına yazar). Metadata (salt okunur) GitHub'ın zorunlu eklediği izindir; eklenirse kalsın.
6. **Generate token** → değeri kopyalayın (bir daha gösterilmez). Repo'ya, sohbete ya da `.env` dosyasına yazmayın; yalnızca 3. adımdaki Worker secret'ına girilir.
7. **Dal koruması:** `main`'de "Require a pull request" gibi bir kural varsa PAT ile doğrudan commit reddedilir (editör "GitHub hatası" gösterir); kural yoksa (bugünkü bot da main'e doğrudan yazıyor) bir şey yapmayın.

Token sizin hesabınızla commit atar (commit yazarı siz). PAT ile atılan push, `GITHUB_TOKEN`'dan farklı olarak **diğer GitHub workflow'larını da tetikler** (`site.yml` gibi) ve Cloudflare'in Workers Builds'ini de tetikler.

## 2. Cloudflare: Worker projesi (Workers Builds)

Kaynak: Workers Builds "Advanced setups → Monorepos" ve "Configuration".

1. dash.cloudflare.com → **Workers & Pages** → **Create application** → **Import a repository** → GitHub → **`gokturkfulser/gokturkfulser.com`** (GitHub uygulaması bu repo için zaten yüklü; yeni izin istemez).
2. **Project name: `nba-daily-top10-control`** (`kontrol/wrangler.jsonc` → `name` ile birebir aynı olmalı). **Production branch: `main`.**
3. Ayarlar (Settings → Build):

| Alan | Değer |
| --- | --- |
| Root directory | *(boş bırakın; `pnpm install` kökten çalışır)* |
| Build command | `pnpm --filter kontrol build` |
| Deploy command | `pnpm --filter kontrol exec wrangler deploy` |
| Preview command | *(kullanılmaz; aşağıya bakın)* |
| Enable Preview Builds (Branch control) | **kapalı** |

- Build command önce statik varlıkları üretir (`public/`: `stil.css`, `uygulama.js`, yazı tipleri), sonra tip kontrolü ve birim testlerini çalıştırır; biri başarısızsa deploy yapılmaz. (Cloudflare dokümanı Workers Builds'in `wrangler.jsonc`'daki "custom builds" ayarını uygulamadığını yazar; bu yüzden varlıklar Build command içinde üretilir.)
- Preview kapalıdır çünkü `workers_dev` ve `preview_urls` kapalıdır; önizleme adresi yoktur.
- Node ve pnpm sürümleri kökteki `.nvmrc` ve `package.json` `packageManager` alanından gelir.

4. **Build watch paths** (Settings → Build → Build watch paths): varsayılan `*` kalıbını **silin**, sonra ekleyin:

```
kontrol/*
site/src/lib/*
site/src/i18n/*
site/src/styles/tokens.css
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
.nvmrc
```

Gerekçe: Worker paketi `kontrol/` ile birlikte `site/src/lib/` (şema, pay kuralları, ad sözlüğü, bakılacak satır) ve onların içe aktardığı `site/src/i18n/` dosyalarını, ayrıca `tokens.css`'i kullanır. Botun gece commit'leri (`site/src/content/top10/**`) bu yollara değmez, yani veri güncellemeleri editörü yeniden derlemez. Tersine ana site (`gokturkfulser-site`) watch path'i `site/*` olduğundan `kontrol/` değişiklikleri ana sitenin build'ini tetiklemez; `site/src/lib` değişince ikisi de derlenir. **Sınama:** yalnızca `lab/` altında bir dosya değiştirip push edin: ne `gokturkfulser-site` ne `nba-daily-top10-control` build almamalı.

## 3. Worker secret'ları ve ortam

Kaynak: Workers "Secrets" sayfası (secret'lar `wrangler secret put` ile ya da dashboard'dan; `vars` içine sır yazılmaz).

İlk deploy'dan sonra (Worker oluşur; secret'lar tanımsızken uygulama her isteğe **403** verir, yani kapalı başlar) şu dört değeri **secret** olarak ekleyin: dashboard → `nba-daily-top10-control` → **Settings → Variables and Secrets** (runtime; "Build variables" değil) → tür **Secret**; ya da CLI: `pnpm --filter kontrol exec wrangler secret put <AD>`.

| Ad | Değer |
| --- | --- |
| `GITHUB_TOKEN_KONTROL` | 1. adımdaki fine-grained token |
| `ACCESS_TEAM_DOMAIN` | `https://<ekip-adı>.cloudflareaccess.com` (şemasız yazılırsa `https://` eklenir) |
| `ACCESS_AUD` | 5. adımdaki Application Audience (AUD) etiketi |
| `ACCESS_IZINLI_EPOSTA` | *(isteğe bağlı ek emniyet)* kendi e-postanız; Access politikasına ek olarak JWT'deki e-posta bununla karşılaştırılır |

`ACCESS_TEAM_DOMAIN` ve `ACCESS_AUD` gizli değildir ama secret olarak girmek, `wrangler deploy`'un dashboard'da girilmiş düz değişkenleri silmesini önler.

## 4. Custom domain `nba-daily-top10-control.gokturkfulser.com`

Kaynak: Workers dokümanı (Domains & Routes) ve [site/DEPLOY.md](../site/DEPLOY.md) bölüm 5 ile aynı yöntem.

1. `nba-daily-top10-control` → **Settings → Domains & Routes → Add → Custom domain** → `nba-daily-top10-control.gokturkfulser.com` (zone `gokturkfulser.com` aynı hesapta olmalı; DNS kaydını Cloudflare kendisi oluşturur).
2. Aynı sayfada **workers.dev** ve **Preview URLs** kapalı olmalı (`wrangler.jsonc` zaten `workers_dev: false`, `preview_urls: false` yazar; dashboard'da kapalı göründüğünü doğrulayın). Access yalnızca custom domain'i korur; Worker ayrıca her istekte JWT'yi doğruladığı için başlıksız gelen her istek yine 403 alır.

## 5. Cloudflare Access uygulaması

Kaynak: Zero Trust dokümanları (Self-hosted application; "Workers → Cloudflare Access" ve "AI wrapper tenant control" öğreticisindeki adımlar). Menü adları dokümanda geçtiği gibidir.

1. Zero Trust açık olmalı (Free planda 50 kullanıcıya kadar; Zero Trust kurulmadıysa dashboard sizi kuruluma yönlendirir).
2. **Zero Trust → Access controls → Applications → Create new application → Self-hosted and private.**
3. Uygulama adı: `Top 10 kontrol`. **Add public hostname** → alan adı olarak `nba-daily-top10-control.gokturkfulser.com` (yol boş: tüm site).
4. **Access policies:** yeni bir **Allow** politikası oluşturun: Include → e-posta seçicisi ile yalnızca **sizin e-posta adresiniz**. (Doküman Access uygulamalarının "varsayılan olarak reddettiğini", bir Allow politikasıyla eşleşmeyen kullanıcının girmediğini yazar. E-posta seçicisinin tam adı — "Emails" mi — dashboard'da seçeneklere bakın; bu görevde yalnızca "Emails ending in" adı dokümanda görüldü. Başka kimseye izin vermeyin.)
5. Kimlik sağlayıcı: varsayılan **One-time PIN** yeterlidir (e-postanıza kod gelir) ya da kullandığınız bir IdP.
6. Kaydedin. Ardından uygulamayı **Edit** → **Additional settings** → **Application Audience (AUD) Tag**'i kopyalayın; bu, 3. adımdaki `ACCESS_AUD` değeridir (AUD uygulamayı silip yeniden oluşturmadıkça değişmez).
7. **Team domain (`ACCESS_TEAM_DOMAIN`):** `https://<ekip-adı>.cloudflareaccess.com`. Ekip adı Zero Trust kurulumunda seçtiğiniz addır; dashboard'daki yeri (Zero Trust → Settings altında) bu görevde doğrulanamadı, orada "team name" alanına bakın.

Worker'ı Access ile korumanın iki yolu vardır: yukarıdaki **hostname tabanlı uygulama** (bu belgenin yolu) ya da Workers → Worker → **Access** sekmesindeki "Protect this Worker behind Access" (doküman: Worker'ın tüm alan adlarını korur). İkisinde de JWT doğrulaması Worker'da yapılır; hostname tabanlı yol seçildi çünkü e-posta politikası ve AUD tek bir uygulamada, adıyla yönetilir.

## 6. İlk kullanım ve doğrulama

1. `https://nba-daily-top10-control.gokturkfulser.com/` → Access giriş sayfası → e-postanıza gelen kodla giriş → geceler listesi açılmalı.
2. Access'siz doğrulama: adrese başlıksız istek (ör. `curl -i https://nba-daily-top10-control.gokturkfulser.com/`) Access'in giriş yönlendirmesini (302) almalı; `workers.dev` adresi yoktur.
3. Bir geceyi açıp küçük bir değişiklik yapın, **Kaydet**: GitHub'da `main`'de `top10: elle düzenleme <tarih>` commit'i (yazar: siz) görünmeli; dosyada `elle_duzenlendi: true`; birkaç dakika içinde `gokturkfulser-site` build'i tetiklenip sitede değişiklik görünmeli.
4. **Kaydet ve onayla** / **Onayla** → `top10: onay <tarih>` commit'i, dosyada `inceleme: onaylandi`.
5. Ad sözlüğü sayfasından bir takma ad ekleyin → `top10: ad sözlüğü` commit'i.

### Doğrulanamayanlar (ilk çalıştırmada bakın)

- **Access JWT'sinin `email` alanı** ve `aud` biçimi: kod `aud`'u dizi ya da metin olarak, `email`'i isteğe bağlı kabul eder; `ACCESS_IZINLI_EPOSTA` verilirse `email` zorunludur. Kod gerçek Access'le denenmedi (testler yerel RSA anahtarı ve sahte sertifika adresi kullanır).
- **GitHub API sürüm başlığı:** `X-GitHub-Api-Version: 2026-03-10` (docs.github.com contents sayfasında listelenen değer; `src/ortam.ts` → `GITHUB_API_SURUMU`). GitHub bu sürümü reddederse sabiti değiştirin.
- **sha çakışmasında GitHub yanıtı:** doküman contents PUT için 409'u tanımlamıyor (yalnızca 200/201/404/422 sayfada). Uygulama hem 409'u hem "sha does not match" iletili 422'yi çakışma sayar, ayrıca PUT'tan önce dosyayı yeniden okuyup sha'yı kendisi karşılaştırır (uyuşmazsa hiç PUT atmaz).
- **Liste sınırı:** geceler listesi en yeni 40 geceyi okur (her biri bir alt istek; Workers ücretsiz planında istek başına 50 alt istek sınırı vardır). Daha eskileri `/gece/YYYY-AA-GG` adresinden açılır.
- **Eşzamanlı yazma:** doküman, contents PUT/DELETE'in aynı anda çalıştırılmaması gerektiğini söyler; editör tek kullanıcılıdır ve her kayıt tek istektir.

## Yerelde geliştirme (Windows + PowerShell)

```powershell
pnpm install
pnpm kontrol:dev          # varlıkları üretir; sahte GitHub (8799) + wrangler dev (8787) birlikte başlar
pnpm kontrol:test         # birim ve uçtan uca testler (ağ yok)
pnpm --filter kontrol check   # tip kontrolü
```

`kontrol:dev`, `kontrol/.dev.vars.example` dosyasını `.dev.vars` olarak kopyalar (repoya girmez). Yerelde Access ve gerçek GitHub **kullanılmaz**: `KONTROL_GELISTIRME="evet"` bayrağı yalnızca isteğin `localhost`/`127.0.0.1`'e geldiği durumda Access doğrulamasını atlar (production alan adında yok sayılır) ve `GITHUB_API_TABANI` yalnızca bu bayrakla geçerlidir; veri `kontrol/.gelistirme-depo/` altındaki sahte depodadır (gerçek veriye dokunulmaz; sıfırlamak için klasörü silin).
