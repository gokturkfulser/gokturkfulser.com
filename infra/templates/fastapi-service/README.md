# sablon

FastAPI servisi (Python 3.14, uv). Prod adresi `https://sablon.gokturkfulser.com`, yerelde
`http://sablon.localhost`. Image: `ghcr.io/gokturkfulser/gokturkfulser-sablon`.

Bu dizin `pnpm service:new <ad>` ile `infra/templates/fastapi-service/`'ten üretilir; compose dosyası
`infra/apps/sablon/compose.yml`'de, CI `.github/workflows/service-sablon.yml`'dedir.

## Python sürümü

`.python-version` = **3.14**. Gerekçe (endoflife.date, 2026-10): 3.14 bir yıllık olgun sürüm (en son yama 3.14.9),
hata düzeltme desteği 2027-10'a, güvenlik desteği 2030-10'a kadar; ekosistem wheel'leri hazır. 3.15 yalnızca iki
haftalık (2026-10-09), kütüphane/taban image desteği henüz oturmadı; 3.13'ün hata düzeltme desteği 2026-10'da bitti.
Yükseltmek için sırayla `.python-version`, `pyproject.toml` (`requires-python`, ruff `target-version`),
`Dockerfile` taban etiketi; sonra `uv lock` ve testler.

## Yerelde çalıştırma ve test

Gerekenler: [uv](https://docs.astral.sh/uv/) (`winget install astral-sh.uv`), Docker Desktop.

```powershell
cd services/sablon
uv sync                                  # .venv + kilit dosyasındaki sürümler
uv run uvicorn app.main:app --reload     # http://127.0.0.1:8000/health
uv run pytest                            # testler
uv run ruff check .                      # lint
uv run ruff format .                     # biçimlendirme (CI: ruff format --check)
```

Ortam değişkenleri `app/config.py`'deki `Settings`'ten okunur (`APP_NAME`, `ENVIRONMENT`, `LOG_LEVEL`, ...); yerelde
`.env` dosyası da okunur (git'e girmez). Loglar stdout'a tek satır JSON'dur.

### Docker ile ve Traefik arkasında

```powershell
docker build -t ghcr.io/gokturkfulser/gokturkfulser-sablon:latest services/sablon
pnpm infra:up                             # core + ornek + monitoring (bir kez)
docker compose --env-file infra/local.env -p gokturkfulser-sablon -f infra/apps/sablon/compose.yml up -d --wait
curl.exe -H "Host: sablon.localhost" http://localhost/health
docker compose --env-file infra/local.env -p gokturkfulser-sablon -f infra/apps/sablon/compose.yml down
```

Yerelde image GHCR'dan çekilmez, yukarıda build ettiğin etiket kullanılır (compose yalnızca image yoksa çeker).

## Image

Çok aşamalı: `builder` (uv ile kilit dosyasından bağımlılıklar) → `runtime` (yalnızca `.venv` + `app/`),
root olmayan kullanıcı (uid 10001), `HEALTHCHECK` (`python -m app.healthcheck`, curl/wget gerekmez),
`read_only` + `/tmp` tmpfs ile çalışır. Sürüm: `--build-arg APP_VERSION=<sha>` → `/health` yanıtında.

**Taban image: `python:3.14-slim-trixie` (varsayılan, ~205 MB).** Gerekçe: glibc tabanlıdır, PyPI'daki
`manylinux` wheel'lerinin hepsi hazır gelir (numpy, pandas, torch, cryptography, psycopg ...); derleme
gerektiren bir bağımlılık eklenince sürpriz çıkmaz, `apt` ve standart araçlar vardır, hata ayıklaması kolaydır,
e-car gibi ağır projelerle aynı tabanı paylaşırız. Tek dezavantajı boyut.

**Alpine (isteğe bağlı, ~101 MB):** `docker build --build-arg PYTHON_IMAGE=python:3.14-alpine ...`. Boyut yarıya
iner; ama musl libc kullanır: bağımlılıkların `musllinux` wheel'i yoksa derleme araçları gerekir (build uzar,
builder aşaması değişir), bazı paketler yavaş ya da farklı davranabilir. Bu şablonun mevcut bağımlılıkları
(fastapi, uvicorn, pydantic-settings) alpine'da amd64 ve arm64'te denendi ve çalışır. CI'da kullanmak için
workflow'daki `build-args` satırına `PYTHON_IMAGE=python:3.14-alpine` ekle.

## CI/CD

`.github/workflows/service-sablon.yml` (yalnızca `services/sablon/**` ve kendi dosyası değişince):

1. **test**: `uv sync --locked`, `ruff check`, `ruff format --check`, `pytest`.
2. **image**: PR'da yalnızca `linux/amd64`, push yok, smoke test; `main`'de `linux/amd64,linux/arm64` build edip
   GHCR'a `sha-<7 karakter>` ve `latest` etiketleriyle push eder (yalnızca `GITHUB_TOKEN`, `packages: write`;
   buildx cache'i GitHub Actions cache'inde).
3. **deploy**: yalnızca `main`'de ve repo variable'ı `DEPLOY_TARGET == 'vps'` ise; sunucuda
   `infra/scripts/app-up.sh sablon` çalıştırır. Variable tanımlı değilken job atlanır, workflow yeşil kalır.

Deploy'u açmak için (Settings → Secrets and variables → Actions): variables `DEPLOY_TARGET=vps`, `VPS_HOST`,
`VPS_USER=deploy`; secrets `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS` (ayrıntı: `infra/README.md`).

İlk kez yayından sonra GHCR paketini repo'ya bağla (Package settings → Manage Actions access) ve private bırak.

### Actions dakika kullanımı (private repo)

Private repo'da Actions dakikası sınırlıdır ve her job dakikaya yukarı yuvarlanarak faturalanır. Bu yüzden:

- **arm64 yalnızca `main`'de, amd64 her PR'da.** arm64 imajı x86 runner'da QEMU emülasyonuyla build edilir ve
  amd64'ten belirgin yavaştır; PR'da yalnızca amd64 build + smoke test yeterlidir (kod mimariden bağımsız, arm64
  uyumluluğunu `main` build'i yakalar). Sunucu arm64 (CAX11) olsa da yalnızca `main` image'ı deploy edilir.
- Aynı PR'daki eski çalışmalar iptal edilir (`concurrency`); workflow yalnızca `services/<app>/**` ve kendi dosyası
  değişince çalışır; buildx katman cache'i (`type=gha`) ve uv cache'i açıktır.

Tahmini süreler (GitHub runner'da **ölçülmedi**; yerelde ölçülen: bu şablonun amd64 build'i ~6–18 sn, QEMU ile arm64
build'i ~20 sn, ikisi de cache'siz ve hızlı ağda; Actions'ta checkout, cache ve QEMU kurulumu eklenir):

| Çalışma | Job'lar | Yaklaşık faturalanan dakika |
| --- | --- | --- |
| PR (test + amd64 + smoke) | test ~1 dk, image ~1–2 dk | ~2–3 |
| `main` (test + amd64+arm64 + push) | test ~1 dk, image ~3–6 dk (arm64 emülasyonu) | ~4–7 |

Aylık ~100 PR çalışması + ~30 `main` çalışması kabaca 400–700 dakikadır. GitHub Free planın private repo kotası
(2.000 dk/ay, Linux 1×) benim doğrulayamadığım bir bilgidir; planındaki kotayı Settings → Billing'den kontrol et.
Ağır bağımlılıklı projelerde (ör. e-car) arm64 emülasyonu çok yavaşlarsa seçenekler: yerel derlemesiz wheel'ler,
arm64 için yerel (native) runner (GitHub'ın standart arm64 runner'ı belgelenmiş dakika ücretiyle sunulur; private
repo'da kullanılabilirliğini planında doğrula), ya da yalnızca sunucu tipine uyan mimariyi build etmek.
