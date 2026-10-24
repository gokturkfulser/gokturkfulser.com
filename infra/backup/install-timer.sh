#!/usr/bin/env bash
# systemd yedek servisini ve timer'ını kurar. root ile çalıştır: sudo infra/backup/install-timer.sh
# Servis, repo'nun sahibi kullanıcı (deploy) olarak çalışır; docker grubunda olmalı.
set -euo pipefail

[[ $EUID -eq 0 ]] || { echo "HATA: root olarak çalıştır (sudo)." >&2; exit 1; }

backup_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
infra_dir="$(dirname "$backup_dir")"
deploy_user="${DEPLOY_USER:-$(stat -c '%U' "$infra_dir")}"

[[ -f "$backup_dir/.env" ]] || { echo "HATA: $backup_dir/.env yok (bkz. .env.example)." >&2; exit 1; }
chmod 600 "$backup_dir/.env"
chown "$deploy_user" "$backup_dir/.env"

for unit in gokturkfulser-backup.service gokturkfulser-backup.timer; do
  sed -e "s|@INFRA_DIR@|$infra_dir|g" -e "s|@DEPLOY_USER@|$deploy_user|g" \
    "$backup_dir/$unit" >"/etc/systemd/system/$unit"
done

systemctl daemon-reload
systemctl enable --now gokturkfulser-backup.timer
systemctl list-timers gokturkfulser-backup.timer --no-pager
