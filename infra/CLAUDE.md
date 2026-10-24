# infra/

Tek Hetzner VPS'in altyapı kodu. Adlar kök CLAUDE.md'den okunur (tunnel `gokturkfulser-vps`, bucket
`gokturkfulser-backup`, image `ghcr.io/gokturkfulser/gokturkfulser-<app>`, `<app>.gokturkfulser.com`).
Kullanım ve VPS günü adımları: [README.md](README.md).

## Yapı

| Yol | Amaç |
| --- | --- |
| `bootstrap.sh` | Ubuntu 24.04 ilk kurulum (root, idempotent) |
| `core/compose.yml`, `core/compose.local.yml` | docker-socket-proxy + Traefik + cloudflared; `edge` ağını core oluşturur. Local override: cloudflared kapalı (`profiles`), Traefik `127.0.0.1:80` |
| `apps/_template/`, `apps/<ad>/` | Servis compose'ları; `edge` ağına **external** katılır |
| `monitoring/compose.yml` | Uptime Kuma (`status.`) |
| `backup/` | `backup.sh`, `restore.sh`, systemd service/timer, `install-timer.sh` |
| `scripts/` | VPS: `core-up.sh`, `app-up.sh <ad>`, `app-down.sh <ad>`, `ghcr-login.sh`; CI/yerel: `validate.sh` |
| `local.env` | Yalnızca `DOMAIN=localhost`; gizli bilgi içermez |
| `templates/` | Kök CLAUDE.md'deki şablon klasörü; servis şablonu şu an `apps/_template/` |

Yerel komutlar kök `package.json`'da: `infra:up`, `infra:down`, `infra:logs`, `infra:check`. Her stack ayrı
compose projesidir (`gokturkfulser-core`, `-ornek`, `-monitoring`); sıra: core önce, uygulamalar sonra.

## Kurallar

- Satır sonu **LF** (`.gitattributes`: `*.sh`, `infra/**`). Bash script'leri `#!/usr/bin/env bash`,
  `set -euo pipefail`, shellcheck'ten temiz; PowerShell'e özel kod burada olmaz.
- Gizli bilgi repo'ya girmez; yalnızca `.env.example`. Gerçek `.env`'ler (`infra/.env`, `core/.env`,
  `backup/.env`, `apps/<ad>/.env`) gitignore'dadır.
- Hiçbir servis `ports:` ile host'a port yayımlamaz (Docker ufw'yi atlar). Dışa açılış tunnel + Traefik
  label'larıyla olur. Tek istisna: `core/compose.local.yml` içindeki `127.0.0.1:80`.
- Traefik'te `exposedByDefault=false`; her servis `traefik.enable=true`, `traefik.docker.network=edge`,
  `entrypoints=web` ve bir `Host(...)` kuralı (`<ad>.${DOMAIN:-gokturkfulser.com}`) taşır. Dashboard kapalı kalır.
- Her servis: pinli imaj etiketi (`latest` yalnızca kendi imajlarımızda `IMAGE_TAG` ile), çok mimarili
  (amd64+arm64) olmalı, `restart: unless-stopped`, `deploy.resources.limits` (cpus+memory), healthcheck
  (imaj imkân vermiyorsa gerekçesiyle birlikte `disable: true`), `json-file` log `max-size`/`max-file`,
  `no-new-privileges`.
- Yedeklenecek volume'a `com.gokturkfulser.backup: "true"` etiketi konur.
- Cloudflare tarafı (DNS, Access, Tunnel) cloudflare-docs MCP'siyle doğrulanır; eğitim verisine güvenilmez.
  Wildcard `*` yalnızca tanımsız isimleri yakalar; mevcut apex/www/lab/e-posta kayıtlarına dokunulmaz.
- Panel niteliğindeki servisler (ör. status) Cloudflare Access ile korunmadan yayına alınmaz.
- Git işlemleri kullanıcıya aittir.

## Her görev sonunda

1. `bash infra/scripts/validate.sh` (= `pnpm infra:check`): LF, shellcheck, actionlint, `docker compose config`.
2. Compose veya script değiştiyse: `pnpm infra:up`, ardından
   `curl.exe -H "Host: ornek.localhost" http://localhost` (200) ve `-H "Host: status.localhost"` (302/200);
   `docker ps` hepsi `healthy`. Windows'ta `*.localhost` çözümlemesine güvenme, `Host` başlığı kullan.
3. Backup/restore değiştiyse: yerel restic repo ile (`RESTIC_LOCAL_VOLUME`) backup → veriyi boz → restore →
   doğrula.
4. `pnpm infra:down` ile ortamı kapat; testte oluşturduğun geçici dosya/volume'ları temizle.
5. Yeni `.sh`/yml dosyalarının LF olduğunu doğrula (`validate.sh` yapar) ve `.gitignore`'un `.env`'leri
   kapsadığını, `git status`'ta `.env` görünmediğini kontrol et.
6. README ve bu dosyayı değişen yapıyla güncel tut; kök CLAUDE.md'deki ilgili satırlar değiştiyse onu da.
7. Yapamadığını (ör. gerçek VPS/Cloudflare/R2 gerektiren adım) çalıştırılmış gibi raporlama; ne test edildi,
   ne edilmedi açıkça yaz.
