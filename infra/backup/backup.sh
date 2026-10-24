#!/usr/bin/env bash
# Docker volume'larını restic ile R2'ye (gokturkfulser-backup) yedekler ve saklama politikasını uygular.
# Yalnızca com.gokturkfulser.backup=true etiketli volume'lar yedeklenir.
# restic, resmi imajıyla konteynerde çalışır (host'a kurulum gerekmez).
set -euo pipefail

infra_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="${BACKUP_ENV_FILE:-$infra_dir/backup/.env}"
restic_image="restic/restic:0.18.1"
label="com.gokturkfulser.backup=true"
pre_label="com.gokturkfulser.backup.pre"
pre_timeout="${BACKUP_PRE_TIMEOUT:-600}"
# Git Bash'te docker exec argümanlarındaki /yol ifadeleri Windows yoluna çevrilmesin (VPS'te etkisiz).
export MSYS_NO_PATHCONV=1

[[ -f "$env_file" ]] || { echo "HATA: $env_file yok (bkz. .env.example)." >&2; exit 1; }
# Git Bash'te docker.exe için Windows biçimli yol (VPS'te etkisiz).
docker_env_file="$env_file"
if command -v cygpath >/dev/null 2>&1; then
  docker_env_file="$(cygpath -m "$env_file")"
fi

read_key() {
  grep -E "^$1=" "$env_file" | head -n1 | cut -d= -f2- | tr -d '"'"'"' \r' || true
}
keep_daily="$(read_key KEEP_DAILY)"
keep_weekly="$(read_key KEEP_WEEKLY)"
keep_monthly="$(read_key KEEP_MONTHLY)"
local_volume="$(read_key RESTIC_LOCAL_VOLUME)"
keep_daily="${keep_daily:-7}"
keep_weekly="${keep_weekly:-4}"
keep_monthly="${keep_monthly:-6}"

mapfile -t volumes < <(docker volume ls --quiet --filter "label=$label")
if [[ ${#volumes[@]} -eq 0 ]]; then
  echo "Yedeklenecek volume yok ('$label' etiketli). Çıkılıyor." >&2
  exit 0
fi

# Yedek öncesi komutlar: servis, veritabanı dump'ını yedeklenen bir volume'a yazan komutu
# `com.gokturkfulser.backup.pre` etiketiyle bildirir; konteynerde `sh -c` ile çalıştırılır.
# Komut başarısız olursa yedek yine alınır (diğer servisler ve önceki dump korunur) ama script
# sonda hata koduyla çıkar; böylece systemd servisi "failed" görünür.
pre_failed=0
mapfile -t pre_containers < <(docker ps --quiet --filter "label=$pre_label")
for c in "${pre_containers[@]}"; do
  [[ -n "$c" ]] || continue
  name="$(docker inspect --format '{{.Name}}' "$c")"
  name="${name#/}"
  cmd="$(docker inspect --format "{{ index .Config.Labels \"$pre_label\" }}" "$c")"
  echo "Yedek öncesi komut [$name]: $cmd"
  if ! timeout "$pre_timeout" docker exec "$c" sh -c "$cmd"; then
    echo "HATA: [$name] yedek öncesi komutu başarısız oldu." >&2
    pre_failed=1
  fi
done

run_args=(--rm --env-file "$docker_env_file" --hostname gokturkfulser-vps -v restic-cache:/root/.cache/restic)
if [[ -n "$local_volume" ]]; then
  run_args+=(-v "$local_volume:/repo" -e RESTIC_REPOSITORY=/repo)
fi
for v in "${volumes[@]}"; do
  run_args+=(-v "$v:/volumes/$v:ro")
done

restic() {
  docker run "${run_args[@]}" "$restic_image" "$@"
}

echo "Yedeklenen volume'lar: ${volumes[*]}"

# Repo yoksa oluştur (R2'de ilk çalıştırma).
if ! restic cat config >/dev/null 2>&1; then
  echo "Repo bulunamadı, başlatılıyor..."
  restic init
fi

restic backup /volumes --tag volumes --exclude-caches
restic forget --tag volumes --group-by host,tags \
  --keep-daily "$keep_daily" --keep-weekly "$keep_weekly" --keep-monthly "$keep_monthly" --prune
restic check
restic snapshots --tag volumes --compact

if [[ $pre_failed -ne 0 ]]; then
  echo "UYARI: en az bir yedek öncesi komut başarısız; ilgili servisin dump'ı güncel olmayabilir." >&2
  exit 1
fi
