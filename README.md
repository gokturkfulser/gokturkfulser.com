# gokturkfulser.com

Kişisel sitenin monoreposu (marka: gokturkfulser). Adların tam listesi için [CLAUDE.md](CLAUDE.md) dosyasındaki "Adlar" bölümüne bakın.

## Yapı

| Klasör | İçerik | Nereye gider |
| --- | --- | --- |
| `site/` | Ana site (Astro) | Cloudflare Worker `gokturkfulser-site` → gokturkfulser.com |
| `lab/` | Lab sitesi | Cloudflare Worker `gokturkfulser-lab` → lab.gokturkfulser.com |
| `lab/apps/` | Lab alt uygulamaları | `lab` ile birlikte |
| `services/` | VPS servisleri (konteyner) | `ghcr.io/gokturkfulser/gokturkfulser-<app>` image'ı, `<app>.gokturkfulser.com` |
| `infra/` | VPS altyapısı, compose, yedekleme | VPS (tunnel `gokturkfulser-vps`), yedekler `gokturkfulser-backup` |
| `infra/templates/` | Servis şablonları | — |

## Geliştirme ortamı

- Windows + PowerShell
- Node.js 24.21.0 (`.nvmrc`; `nvm install` ile aynı sürüm)
- pnpm 11.1.2 (`packageManager` alanında sabit)
- Docker (servisler ve infra için)

```powershell
pnpm install
pnpm site:dev     # geliştirme sunucusu (taslaklar için SHOW_DRAFTS=true)
pnpm lab:dev      # yer tutucu
```

Linux'ta çalışacak dosyalar (bash script'leri, compose, `infra/**`) LF satır sonuyla tutulur.

## CI

`site.yml`, `lab.yml` ve `infra.yml` yalnızca kendi klasörleri ve kendi workflow dosyaları değiştiğinde çalışır.
