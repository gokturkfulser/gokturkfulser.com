# infra/templates

Yeni servisler için şablonlar. Aynı repoda yeni servis açmak için kök dizinden:

```powershell
pnpm service:new skor-api
```

Bu komut `fastapi-service/` şablonunu `services/skor-api/` altına kopyalar, `.github/workflows/service-skor-api.yml`
ile `infra/apps/skor-api/compose.yml`'yi üretir. Şablon içeriği ve Python sürüm gerekçesi:
[fastapi-service/README.md](fastapi-service/README.md).

## Ayrı repodaki büyük proje (ör. e-car FastAPI servisi) → aynı VPS

Servis kendi repo'sunda yaşar; bu repo (gokturkfulser.com) yalnızca sunucu tarafını (Traefik, tunnel, compose)
tutar. Aşağıdaki `<app>` örneğin `ecar-api`, `<repo>` ayrı reponun adıdır.

### 1. Şablonu ayrı repoya al

`fastapi-service/` içeriğini (compose.yml ve workflow.yml hariç) ayrı repoya kopyala; mevcut bir projeyse yalnızca
`Dockerfile`, `.dockerignore`, `app/healthcheck.py` ve `/health` endpoint'ini uyarla. Metindeki `sablon` sözcüğünü
`<app>` ile değiştir (`pyproject.toml` ve `uv.lock` içindeki `name` dahil). Gereksinimler: `/health` 200 dönmeli,
image `linux/amd64` + `linux/arm64` için build olmalı, konteyner root olmayan kullanıcıyla çalışmalı.

### 2. Workflow

`workflow.yml`'yi ayrı reponun `.github/workflows/<app>.yml` dosyası olarak kopyala ve düzenle:

- `paths:` ve `working-directory`/`context` yollarını (`services/sablon`) o reponun düzenine uydur (kökteyse `.`).
- `IMAGE` her zaman `ghcr.io/gokturkfulser/gokturkfulser-<app>` kalır (adlandırma kuralı kök CLAUDE.md'de).
- Push için yalnızca `GITHUB_TOKEN` + `permissions: packages: write` yeter; ek secret koyma.
- Deploy job'u bu repoda tanımlı `VPS_*` değerlerini kullanır; ayrı repoda aynı variable/secret'ları
  (`DEPLOY_TARGET`, `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS`) o repoya da ekle.
  Sunucuda `git pull` bu (gokturkfulser.com) repo'yu günceller; compose değişmedikçe yeni image yalnızca
  `IMAGE_TAG` ile çekilir.

### 3. GHCR erişimi

- İlk push'tan sonra paket **private** olur. VPS zaten `scripts/ghcr-login.sh` ile `read:packages` yetkili bir
  **classic** PAT'le giriş yapmıştır; bu token paketi görebilmeli. Ayrı repo başka bir kullanıcı/organizasyondaysa
  token sahibine paket erişimi ver. Aynı kullanıcının (`gokturkfulser`) paketleri için ek iş gerekmez.
- Paketi ayrı repoya bağla: GitHub → Packages → paket → Package settings → **Manage Actions access** →
  o repoyu "Write" ile ekle (aksi halde `GITHUB_TOKEN` push edemeyebilir).

### 4. Sunucu tarafı: compose'u bu repoya ekle

Bu repoda (`gokturkfulser.com`) `infra/apps/<app>/compose.yml` oluştur: `fastapi-service/compose.yml`'yi kopyalayıp
`sablon` → `<app>` değiştir (image adı `ghcr.io/gokturkfulser/gokturkfulser-<app>`, host `<app>.gokturkfulser.com`,
Traefik label'ları, port). Gerekirse `infra/apps/<app>/.env.example` ekle. Sonra:

```bash
# VPS'te (deploy kullanıcısı)
cd /opt/gokturkfulser && git pull --ff-only
cp infra/apps/<app>/.env.example infra/apps/<app>/.env   # değerleri doldur (git'e girmez)
infra/scripts/app-up.sh <app>
```

DNS kaydı gerekmez (`*.gokturkfulser.com` wildcard tunnel'a gider). Bir yönetim arayüzü/paneli sunuyorsa yayına
almadan önce Cloudflare Access ile koru (bkz. `infra/README.md`). Veritabanı varsa volume'a
`com.gokturkfulser.backup: "true"` etiketini ekle; SQLite/Postgres gibi bir veritabanı kullanıyorsa dump komutunu
`com.gokturkfulser.backup.pre` label'ıyla bildir (`infra/README.md` > Yedek tutarlılığı).

### 5. Doğrula

Ayrı repoda main'e push → Actions'ta `test` ve `image` yeşil, GHCR'da `latest` ve `sha-…` etiketleri;
`DEPLOY_TARGET=vps` ise deploy job'u çalışır. Elle: VPS'te `infra/scripts/app-up.sh <app>`, sonra
`curl https://<app>.gokturkfulser.com/health`.
