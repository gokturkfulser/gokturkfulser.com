#!/usr/bin/env bash
# VPS: çekirdek stack'i (socket-proxy, Traefik, cloudflared) ayağa kaldırır. Idempotent.
set -euo pipefail

infra_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
compose_file="$infra_dir/core/compose.yml"
env_file="$infra_dir/core/.env"

if [[ ! -f "$env_file" ]]; then
  echo "HATA: $env_file yok. 'cp core/.env.example core/.env' yapıp TUNNEL_TOKEN'ı doldur." >&2
  exit 1
fi

token="$(grep -E '^TUNNEL_TOKEN=' "$env_file" | head -n1 | cut -d= -f2- | tr -d '"'"'"' \r' || true)"
if [[ -z "$token" ]]; then
  echo "HATA: $env_file içinde TUNNEL_TOKEN boş." >&2
  exit 1
fi

docker compose -f "$compose_file" pull
docker compose -f "$compose_file" up -d --remove-orphans --wait
docker compose -f "$compose_file" ps
