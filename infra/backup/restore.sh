#!/usr/bin/env bash
# Bir volume'u restic yedeğinden geri yükler.
#   restore.sh list                      -> snapshot'ları listeler
#   restore.sh <volume> [snapshot=latest] -> volume içeriğini yedekteki haline getirir
# Volume'u kullanan konteynerler önce durdurulmalı (app-down.sh <ad>); aksi halde script reddeder.
set -euo pipefail

infra_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="${BACKUP_ENV_FILE:-$infra_dir/backup/.env}"
restic_image="restic/restic:0.18.1"

[[ -f "$env_file" ]] || { echo "HATA: $env_file yok (bkz. .env.example)." >&2; exit 1; }
# Git Bash'te docker.exe için Windows biçimli yol (VPS'te etkisiz).
docker_env_file="$env_file"
if command -v cygpath >/dev/null 2>&1; then
  docker_env_file="$(cygpath -m "$env_file")"
fi
[[ $# -ge 1 ]] || { echo "Kullanım: $0 list | $0 <volume> [snapshot]" >&2; exit 2; }

local_volume="$(grep -E '^RESTIC_LOCAL_VOLUME=' "$env_file" | head -n1 | cut -d= -f2- | tr -d '"'"'"' \r' || true)"
base_args=(--rm --env-file "$docker_env_file" --hostname gokturkfulser-vps -v restic-cache:/root/.cache/restic)
if [[ -n "$local_volume" ]]; then
  base_args+=(-v "$local_volume:/repo" -e RESTIC_REPOSITORY=/repo)
fi

if [[ "$1" == "list" ]]; then
  docker run "${base_args[@]}" "$restic_image" snapshots --tag volumes
  exit 0
fi

volume="$1"
snapshot="${2:-latest}"

if [[ ! "$volume" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]]; then
  echo "HATA: geçersiz volume adı '$volume'." >&2
  exit 2
fi

users="$(docker ps --quiet --filter "volume=$volume")"
if [[ -n "$users" ]]; then
  echo "HATA: '$volume' çalışan konteynerlerce kullanılıyor; önce durdur (app-down.sh)." >&2
  exit 1
fi

docker volume inspect "$volume" >/dev/null 2>&1 || docker volume create "$volume" >/dev/null

echo "Geri yükleniyor: $volume <- snapshot '$snapshot'"
docker run "${base_args[@]}" -v "$volume:/volumes/$volume" "$restic_image" \
  restore "$snapshot" --tag volumes --include "/volumes/$volume" --target /
echo "Tamam. Servisi yeniden başlat: infra/scripts/app-up.sh <ad>"
