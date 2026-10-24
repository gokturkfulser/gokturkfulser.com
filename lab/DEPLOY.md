# lab/ → Cloudflare Workers Builds kurulumu

Hedef: `gokturkfulser-lab` Worker'ı bu repodan (`gokturkfulser/gokturkfulser.com`, private) her `main` push'unda `lab.gokturkfulser.com`'a yayımlanır; diğer dallar preview build'i alır. Yöntem [site/DEPLOY.md](../site/DEPLOY.md) ile aynıdır; yalnızca ad, komutlar ve watch path'ler `lab` içindir. Her değer dashboard'a olduğu gibi girilir.

## 1. Repo bağlama

1. dash.cloudflare.com → **Workers & Pages** → **Create application** → **Import a repository** (Connect to Git) → **GitHub**.
2. GitHub uygulaması (**Cloudflare Workers & Pages**) bu repo için zaten yüklüyse yeniden izin istemez; yüklüyse **Only select repositories** altında yalnızca **`gokturkfulser/gokturkfulser.com`** işaretli kalmalı (**All repositories** değil). Kontrol: GitHub → Settings → Applications → Cloudflare Workers & Pages → Configure.
3. Repoyu seçin, **Next**.
4. **Project name: `gokturkfulser-lab`**. Bu ad `lab/wrangler.jsonc` içindeki `name` ile birebir aynı olmalı.
5. **Production branch: `main`**.

## 2. Kurulum ekranındaki alanlar

Kurulum ekranında **Build command**, **Deploy command** ve **Preview command** alanları vardır. **Root directory'yi boş bırakın (repo kökü)**: `pnpm-lock.yaml` ve `pnpm-workspace.yaml` kökte olduğu için `pnpm install` kökten çalışır, paket `--filter` ile seçilir.

| Alan | Değer |
| --- | --- |
| Root directory (Advanced) | *(boş bırakın)* |
| Build command | `pnpm --filter lab build` |
| Deploy command | `pnpm --filter lab exec wrangler deploy` |
| Preview command | `pnpm --filter lab exec wrangler preview` |

- **Preview command** için varsayılan `npx wrangler preview`'dır; kökte `wrangler` bulunmadığı için `pnpm --filter lab exec` ön ekiyle yazılır. Wrangler bu komutu tanımazsa (eski sürüm) yerine `pnpm --filter lab exec wrangler versions upload` kullanın. Bu repodaki Wrangler 4.152 ikisini de tanıyor (yerelde doğrulandı).
- Deploy command'ı `pnpm --filter lab exec …` ile `lab/` içinde çalıştırır; `lab/wrangler.jsonc` içindeki `./dist`, o dosyaya göre çözülür.
- **Enable Preview Builds** (Settings → Build → Branch control) işaretli olsun.
- Build command önce `kelime-avi` gibi her app'in testini, tip kontrolünü ve Vite build'ini çalıştırır; sonra hepsini `lab/dist/<slug>/` altında toplar ve liste sayfasını üretir. Bu adım başarısızsa deploy yapılmaz.
- Node sürümü kökteki `.nvmrc`'den, pnpm sürümü kök `package.json` `packageManager` alanından gelir.

## 3. Build watch paths (Settings → Build → Build watch paths)

**Cloudflare'in varsayılan include kalıbı `*`'dır (her push build tetikler). Önce onu silin**; aksi halde aşağıdaki kısıtlama hiçbir işe yaramaz, çünkü `*` her şeyle eşleşir.

**Include paths** (varsayılan `*` silindikten sonra, her biri ayrı giriş):

```
lab/*
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
.nvmrc
```

**Exclude paths:** boş.

Dokümana göre `*` sıfır veya daha fazla karakterle eşleşir ve kuralın başında/sonunda ya da tek başına kullanılabilir; önce exclude'lara bakılır, kalan yollar include'larla karşılaştırılır, hiçbiri eşleşmezse build atlanır. `lab/*` alt klasörleri de kapsar (`lab/apps/…`). Kurduktan sonra sınayın: yalnızca `site/` altında bir dosya değiştirip push edin, `gokturkfulser-lab` için build **tetiklenmemeli**.

Değişiklik içermeyen push, 3.000+ dosya veya 20+ commit'lik push yol eşleşmesine bakılmadan build alır.

## 4. Değişkenler

Bu Worker'ın **hiçbir değişkene ihtiyacı yok**; hiçbir şey girmeyin. İleride gerekirse **Settings → Build → Variables and secrets** bölümüne girilir (build değişkenleri). **Settings → Variables & Secrets** (runtime) bölümüne girilen değerler build sırasında görünmez; lab statik olduğu için runtime değişkeninin de bir işlevi yoktur (Worker kodu yok, yalnızca static assets).

## 5. Custom domain

1. `gokturkfulser-lab` → **Settings → Domains & Routes → Add → Custom domain**.
2. `lab.gokturkfulser.com` yazın, onaylayın. DNS kaydını Cloudflare kendisi oluşturur (zone Cloudflare'de olmalı).
3. İsteğe bağlı: `workers.dev` alt alan adını ve preview URL'lerini erişime kapatın.

## 6. İlk deploy sonrası doğrulama

```powershell
curl.exe -sI https://lab.gokturkfulser.com/              # content-security-policy: frame-ancestors 'self' https://gokturkfulser.com
curl.exe -sI https://lab.gokturkfulser.com/kelime-avi/   # iki CSP header'ı: frame-ancestors + app'in kendi CSP'si
curl.exe -s -o NUL -w "%{http_code}`n" https://lab.gokturkfulser.com/yok/   # 404
```

Sonra `https://gokturkfulser.com/projeler/kelime-avi/` sayfasında "Oyna"ya basıp oyunun iframe içinde açıldığını doğrulayın. Başka bir sitede `<iframe src="https://lab.gokturkfulser.com/kelime-avi/">` denerseniz tarayıcı çerçevelemeyi engellemeli.

## 7. Bilmeniz gerekenler

- **Header'lar** `lab/public/_headers` içindedir ve her build'de `lab/dist/_headers`'a kopyalanır. `frame-ancestors 'self' https://gokturkfulser.com` `/*` altındadır, yani bütün app'ler yalnızca bu sitede gömülebilir; `<meta>` ile çalışmadığı için header'dır. Aynı header birden çok kuralla eşleşirse değerler virgülle birleşir (ezilmez), bu yüzden `Cache-Control` `/*` altında değildir. Sınırlar (dokümandan): 100 header kuralı, satır başına 2.000 karakter, dosya başına 25 MiB, Free planda sürüm başına 20.000 dosya.
- **Her yeni app'in CSP'si:** yalnızca `kelime-avi`'nin (`/kelime-avi/*`) sıkı CSP'si var. Yeni app için `lab/public/_headers`'a kendi `/<slug>/*` kuralı eklenir ya da app kendi araçlarının gerektirdiği izinlerle çalışır (ör. Phaser `blob:`/`wasm`).
- **Yönlendirme yok:** Worker kodu olmadığı için `/<slug>/yol` gibi path fallback'i çalışmaz; SPA'lar hash routing (`#/…`) kullanmalı.
- **Site tarafı:** `gokturkfulser.com`'un CSP'sinde `frame-src https://lab.gokturkfulser.com` izinlidir. Başka bir alt alan adından gömme gerekirse `site/astro.config.mjs` → `security.csp.directives` güncellenir.
