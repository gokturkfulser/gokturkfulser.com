#!/usr/bin/env bash
# VPS: GHCR'ye (private image'lar için) docker login. deploy kullanıcısıyla çalıştır.
# infra/.env içindeki GHCR_USER ve GHCR_TOKEN (yalnızca read:packages) okunur.
set -euo pipefail

infra_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="$infra_dir/.env"

if [[ ! -f "$env_file" ]]; then
  echo "HATA: $env_file yok. 'cp .env.example .env' yapıp GHCR_TOKEN'ı doldur." >&2
  exit 1
fi

# .env'i source etmek yerine yalnızca gereken anahtarları oku.
read_key() {
  grep -E "^$1=" "$env_file" | head -n1 | cut -d= -f2- | tr -d '"'"'"' \r' || true
}
user="$(read_key GHCR_USER)"
token="$(read_key GHCR_TOKEN)"

if [[ -z "$user" || -z "$token" ]]; then
  echo "HATA: $env_file içinde GHCR_USER / GHCR_TOKEN boş." >&2
  exit 1
fi

printf '%s' "$token" | docker login ghcr.io --username "$user" --password-stdin
