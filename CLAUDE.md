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
- servis image'ları: `ghcr.io/gokturkfulser/gokturkfulser-<app>`, adresleri `<app>.gokturkfulser.com`
- tunnel: gokturkfulser-vps
- yedek bucket: gokturkfulser-backup

## Repo yapısı

| Klasör | Amaç | Deploy |
| --- | --- | --- |
| `site/` | Ana site (Astro) | Cloudflare Worker `gokturkfulser-site` → gokturkfulser.com |
| `lab/` | Lab sitesi/Worker'ı | Cloudflare Worker `gokturkfulser-lab` → lab.gokturkfulser.com |
| `lab/apps/` | Lab'ın alt uygulamaları (her biri ayrı pnpm paketi) | `lab` ile birlikte |
| `services/` | VPS'te konteyner olarak çalışan servisler | Image `ghcr.io/gokturkfulser/gokturkfulser-<app>`, `<app>.gokturkfulser.com` (tunnel `gokturkfulser-vps` üzerinden) |
| `infra/` | VPS altyapısı (compose, script'ler, yedekleme) | VPS; yedekler `gokturkfulser-backup` bucket'ına |
| `infra/templates/` | Yeni servis için şablonlar | — |

pnpm workspace: `site`, `lab`, `lab/apps/*`. Kök `package.json` kısayolları: `site:dev`, `site:build`, `lab:dev`, `lab:build`, `infra:up`, `infra:down` (şimdilik yer tutucu).

CI: `.github/workflows/{site,lab,infra}.yml` yalnızca kendi klasörlerindeki ve kendi workflow dosyalarındaki değişikliklerde çalışır.

## Kurallar

- İçerik ve arayüz dili Türkçe.
- Geliştirme ortamı Windows + PowerShell; script'ler buna uygun olmalı. Linux'ta çalışacak dosyalar (bash, compose, `infra/**`) LF satır sonuyla yazılır (`.gitattributes` zorlar).
- Git işlemlerine (add, commit, push, stash, checkout, branch) dokunulmaz; bunları kullanıcı yapar.
- Astro konularında astro-docs MCP'si, Cloudflare/Wrangler konularında cloudflare-docs MCP'si ve Cloudflare skill'leri kullanılır; eğitim verisindeki bilgiye güvenilmez.
- Bir alt klasörde çalışırken o klasörün CLAUDE.md'si de bağlayıcıdır.
- Gizli bilgiler asla repo'ya girmez; yalnızca `.env.example` şablonları eklenir.
