#!/usr/bin/env bash
# VPS: apps/<ad> (veya "monitoring") servisini durdurur. Volume'lara dokunmaz.
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Kullanım: $0 <ad>" >&2
  exit 2
fi
app="$1"
if [[ ! "$app" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
  echo "HATA: geçersiz ad '$app' (küçük harf, rakam, tire)." >&2
  exit 2
fi

infra_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "$infra_dir/apps/$app/compose.yml" ]]; then
  compose_file="$infra_dir/apps/$app/compose.yml"
elif [[ "$app" == "monitoring" ]]; then
  compose_file="$infra_dir/monitoring/compose.yml"
else
  echo "HATA: $infra_dir/apps/$app/compose.yml bulunamadı." >&2
  exit 1
fi

docker compose -f "$compose_file" down --remove-orphans
