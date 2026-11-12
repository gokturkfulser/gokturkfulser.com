# gokturkfulser.com monoreposu

Kişisel sitenin monoreposu. Alt klasörlerin içeriği ayrı görevlerle doldurulur.

## Adlar

Sonraki tüm görevler adları buradan okur; başka yerde sabit kodlamak yerine bu bölüme uyulur.

- marka: gokturkfulser
- domain: gokturkfulser.com
- github repo: gokturkfulser.com (private)
- github kullanıcı: gokturkfulser
- Worker'lar:
  - gokturkfulser-site → gokturkfulser.com
  - gokturkfulser-lab → lab.gokturkfulser.com
  - nba-daily-top10-control → nba-daily-top10-control.gokturkfulser.com (Cloudflare Access arkasında; yalnızca sahibi)
- servis image'ları: `ghcr.io/gokturkfulser/gokturkfulser-<app>`, adresleri `<app>.gokturkfulser.com`
- tunnel: gokturkfulser-vps
- yedek bucket: gokturkfulser-backup

## Repo yapısı

| Klasör | Amaç | Deploy |
| --- | --- | --- |
| `site/` | Ana site (Astro) | Cloudflare Worker `gokturkfulser-site` → gokturkfulser.com |
| `lab/` | Lab sitesi/Worker'ı | Cloudflare Worker `gokturkfulser-lab` → lab.gokturkfulser.com |
| `lab/apps/` | Lab'ın alt uygulamaları (her biri ayrı pnpm paketi) | `lab` ile birlikte |
| `kontrol/` | Top 10 özel düzenleyici (ayrı Worker; gece dosyalarını telefondan da düzenleyip onaylar, GitHub contents API ile `main`'e commit eder) | Cloudflare Worker `nba-daily-top10-control` → nba-daily-top10-control.gokturkfulser.com (Access arkasında); kurulum `kontrol/DEPLOY.md` |
| `services/` | VPS'te konteyner olarak çalışan servisler | Image `ghcr.io/gokturkfulser/gokturkfulser-<app>`, `<app>.gokturkfulser.com` (tunnel `gokturkfulser-vps` üzerinden) |
| `infra/` | VPS altyapısı (compose, script'ler, yedekleme) | VPS; yedekler `gokturkfulser-backup` bucket'ına |
| `infra/templates/` | Yeni servis için şablonlar | — |

`kontrol/` klasörü "klasör adı Worker adının son parçası" düzeninin istisnasıdır: dışarıya görünen Worker/alan adı (`nba-daily-top10-control`) ile repo içi klasör adı bilerek ayrı tutuldu.

pnpm workspace: `site`, `lab`, `lab/apps/*`, `kontrol`. Kök `package.json` kısayolları: `site:dev`, `site:build`, `lab:dev` (`pnpm lab:dev [slug]`), `lab:build`, `lab:new` (`pnpm lab:new <slug>`); `kontrol:dev` (sahte GitHub + `wrangler dev`), `kontrol:build`, `kontrol:test`; `infra:up`, `infra:down`, `infra:logs`, `infra:check` (yerel Docker; ayrıntı `infra/CLAUDE.md`); `service:new` (`pnpm service:new <ad>`: `infra/templates/fastapi-service` şablonundan `services/<ad>/`, `infra/apps/<ad>/compose.yml` ve `.github/workflows/service-<ad>.yml` üretir).

CI: `.github/workflows/site-top10.yml` (günde iki kez 12:00/16:00 İstanbul + elle; YouTube'dan yeni Top 10 videosunu bulup Gemini ile `site/src/content/top10/<sezon>/<tarih>.yaml` üretir, doğrular ve doğrudan `main`'e commit'ler; **bot `main`'e yalnızca `site/src/content/top10/**` veri dosyalarını commit'ler**, başka dosya değişirse commit etmez ve hata verir; `workflow_dispatch` `onayla` girdisi (virgülle ayrılmış tarihler) yalnızca `inceleme: bekliyor` → `onaylandi` yapar (commit `top10: onay <tarihler>`, Gemini/YouTube çağrısı yok); her çalıştırmanın sonunda main'in ucunu **`top10-kontrol` dalına** da gönderir (bu dal yalnızca main'in aynasıdır, force push yalnızca bu dala; Cloudflare önizlemesinde `/kontrol/top10/` kontrol sayfası görünür); gece dosyasında `elle_duzenlendi: true` varsa (yalnızca `kontrol/` düzenleyicisi yazar) bot o dosyaya `uzerine_yaz` dahil hiçbir koşulda dokunmaz; düzenleyici `main`'e doğrudan, fine-grained PAT ile (yalnızca bu repo, Contents: Read and write) `top10: elle düzenleme <tarih>` / `top10: onay <tarih>` / `top10: ad sözlüğü` commit'leri atar; `contents: write`; sırlar `YOUTUBE_API_KEY`, `GEMINI_API_KEY`; ayrıntı `site/DEPLOY.md` bölüm 10). `.github/workflows/{site,lab,infra}.yml` yalnızca kendi klasörlerindeki ve kendi workflow dosyalarındaki değişikliklerde çalışır (istisna: `infra.yml` `.github/workflows/**` değişince de çalışır, çünkü tüm workflow'ları actionlint'ler); her servis için `service-<app>.yml` yalnızca `services/<app>/**` ve kendi dosyasında çalışır (image: PR'da amd64, main'de amd64+arm64 → GHCR; deploy yalnızca `vars.DEPLOY_TARGET == 'vps'`).

## Kurallar

- Site içeriği ve arayüzü iki dilli: İngilizce (varsayılan, kökte) ve Türkçe (`/tr/`); kurallar `site/CLAUDE.md` "Dil (i18n) kuralları". `lab` ve `citiesofanatolia` Türkçe kalır.
- Geliştirme ortamı Windows + PowerShell; script'ler buna uygun olmalı. Linux'ta çalışacak dosyalar (bash, compose, `infra/**`) LF satır sonuyla yazılır (`.gitattributes` zorlar).
- Git işlemlerine (add, commit, push, stash, checkout, branch) dokunulmaz; bunları kullanıcı yapar.
- Astro konularında astro-docs MCP'si, Cloudflare/Wrangler konularında cloudflare-docs MCP'si ve Cloudflare skill'leri kullanılır; eğitim verisindeki bilgiye güvenilmez.
- Bir alt klasörde çalışırken o klasörün CLAUDE.md'si de bağlayıcıdır.
- Gizli bilgiler asla repo'ya girmez; yalnızca `.env.example` şablonları eklenir.

## Sürümler

Tek kaynak: Node için kökteki `.nvmrc`, pnpm için kök `package.json`'daki `packageManager`. Başka yerde sürüm yazılmaz; GitHub Actions `setup-node`'da `node-version-file: .nvmrc`, `pnpm/action-setup` `packageManager`'ı okur.

- **Node 24.21.0** (Active LTS). Gerekçe: site Astro 7'de (`node >=22.23.4` ister, 24.21.0 karşılar); Cloudflare Workers Builds varsayılanı Node 24 (14 Ekim 2026 itibarıyla 24.21.0), yani yerelde, CI'da ve Cloudflare'de aynı büyük/küçük sürüm çalışır; 22 Maintenance LTS'e düştü. Windows'taki build çökmesi (`UV_HANDLE_CLOSING`, yalnızca yerel Windows; Linux CI ve Workers Builds etkilenmez) sürüm seçimini belirlemedi: 22.23.4, 24.15.0, 24.21.0 ve 24.22.1 ile build denendi, çökme yeniden üretilemedi.
- **pnpm 11.1.2** (`packageManager`). pnpm 12 çıkmış durumda; geçiş ayrı bir görevdir.
- `engines`: `node >=24.21.0 <25`, `pnpm >=11.1.2 <12`. Yerel Node daha eskiyse pnpm "Unsupported engine" uyarısı verir.
- **Cloudflare Workers Builds:** Node sürümü `.nvmrc`'den okunur (dokümana göre `NODE_VERSION` ortam değişkeni, `.nvmrc` ve `.node-version` desteklenir). Ek ayar şart değil; isteniyorsa build değişkeni olarak `NODE_VERSION = 24.21.0` eklenir (Workers → Settings → Build → Build variables). pnpm sürümü `packageManager`'dan gelir.
- Sürüm yükseltirken önce `.nvmrc`, sonra `packageManager`/`engines`; workflow'lara dokunmak gerekmez.
