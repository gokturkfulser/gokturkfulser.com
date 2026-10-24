#!/usr/bin/env bash
# Ubuntu 24.04 (x86_64 veya arm64) VPS ilk kurulumu. root olarak çalıştır. Idempotent.
#
#   sudo DEPLOY_SSH_PUBKEY="ssh-ed25519 AAAA... kullanici" ./bootstrap.sh
#
# Ortam değişkenleri (hepsi isteğe bağlı):
#   DEPLOY_USER        deploy kullanıcı adı            (varsayılan: deploy)
#   DEPLOY_SSH_PUBKEY  deploy'a yetkilendirilecek açık anahtar. Verilmezse root'un
#                      authorized_keys dosyası (Hetzner'in eklediği anahtar) kopyalanır.
#   SSH_PORT           SSH portu                       (varsayılan: 22)
#   TIMEZONE           saat dilimi                     (varsayılan: Europe/Istanbul)
#   INFRA_PATH         repo/infra'nın konacağı dizin   (varsayılan: /opt/gokturkfulser)
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
DEPLOY_SSH_PUBKEY="${DEPLOY_SSH_PUBKEY:-}"
SSH_PORT="${SSH_PORT:-22}"
TIMEZONE="${TIMEZONE:-Europe/Istanbul}"
INFRA_PATH="${INFRA_PATH:-/opt/gokturkfulser}"

export DEBIAN_FRONTEND=noninteractive

log() { printf '\n==> %s\n' "$*"; }
die() { printf 'HATA: %s\n' "$*" >&2; exit 1; }

# Dosyayı yalnızca içerik değiştiyse yazar; değiştiyse 0, aynıysa 1 döner.
write_if_changed() {
  local path="$1" mode="$2" tmp
  tmp="$(mktemp)"
  cat >"$tmp"
  if [[ -f "$path" ]] && cmp -s "$tmp" "$path"; then
    rm -f "$tmp"
    return 1
  fi
  install -D -m "$mode" "$tmp" "$path"
  rm -f "$tmp"
  return 0
}

[[ $EUID -eq 0 ]] || die "root olarak çalıştır (sudo ./bootstrap.sh)."
# shellcheck source=/dev/null
[[ -r /etc/os-release ]] && . /etc/os-release
[[ "${ID:-}" == "ubuntu" ]] || die "yalnızca Ubuntu için yazıldı (algılanan: ${ID:-bilinmiyor})."
[[ "$SSH_PORT" =~ ^[0-9]+$ ]] || die "SSH_PORT sayı olmalı."
[[ "$DEPLOY_USER" =~ ^[a-z_][a-z0-9_-]*$ ]] || die "geçersiz DEPLOY_USER."

log "Paketler"
apt-get update -y
apt-get install -y --no-install-recommends \
  ca-certificates curl gnupg ufw fail2ban unattended-upgrades apt-listchanges \
  openssh-server

log "Saat dilimi: $TIMEZONE"
timedatectl set-timezone "$TIMEZONE"

log "Kullanıcı: $DEPLOY_USER"
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
fi
usermod -aG sudo "$DEPLOY_USER"
# Parolasız hesap olduğu için sudo parolası yok. docker grubu zaten root-eşdeğeri;
# NOPASSWD ek bir yetki açmaz.
write_if_changed "/etc/sudoers.d/90-$DEPLOY_USER" 0440 <<SUDO || true
$DEPLOY_USER ALL=(ALL) NOPASSWD:ALL
SUDO
visudo -cf "/etc/sudoers.d/90-$DEPLOY_USER" >/dev/null

ssh_dir="/home/$DEPLOY_USER/.ssh"
auth_keys="$ssh_dir/authorized_keys"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$ssh_dir"
touch "$auth_keys"
if [[ -n "$DEPLOY_SSH_PUBKEY" ]]; then
  grep -qxF "$DEPLOY_SSH_PUBKEY" "$auth_keys" || printf '%s\n' "$DEPLOY_SSH_PUBKEY" >>"$auth_keys"
elif [[ -s /root/.ssh/authorized_keys ]]; then
  while IFS= read -r key; do
    [[ -n "$key" ]] && { grep -qxF "$key" "$auth_keys" || printf '%s\n' "$key" >>"$auth_keys"; }
  done </root/.ssh/authorized_keys
fi
chown "$DEPLOY_USER:$DEPLOY_USER" "$auth_keys"
chmod 600 "$auth_keys"

# Kilitlenmeyi önle: anahtar yoksa SSH'ı sertleştirme.
[[ -s "$auth_keys" ]] || die "$auth_keys boş. DEPLOY_SSH_PUBKEY ver; SSH sertleştirilmedi."

log "SSH sertleştirme"
# 00- öneki: cloud-init'in 50-cloud-init.conf'u (PasswordAuthentication yes) gibi
# dosyalardan önce okunur; sshd'de ilk eşleşen değer kazanır.
write_if_changed /etc/ssh/sshd_config.d/00-gokturkfulser.conf 0644 <<SSHD || true
Port $SSH_PORT
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AllowUsers $DEPLOY_USER
MaxAuthTries 3
X11Forwarding no
SSHD
sshd -t
systemctl reload ssh

log "ufw (yalnızca SSH)"
ufw default deny incoming
ufw default allow outgoing
ufw limit "${SSH_PORT}/tcp" comment 'SSH'
ufw --force enable
# Not: Docker yayımlanan portları ufw'yi atlayarak açar. Bu yapıda hiçbir port yayımlanmaz.

log "fail2ban"
write_if_changed /etc/fail2ban/jail.d/sshd.local 0644 <<JAIL || true
[sshd]
enabled = true
port = $SSH_PORT
backend = systemd
maxretry = 5
findtime = 10m
bantime = 1h
JAIL
systemctl enable --now fail2ban
systemctl restart fail2ban

log "unattended-upgrades"
write_if_changed /etc/apt/apt.conf.d/20auto-upgrades 0644 <<'APT' || true
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
APT
systemctl enable --now unattended-upgrades

log "Docker"
if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  arch="$(dpkg --print-architecture)"
  echo "deb [arch=${arch} signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    >/etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

# Docker log rotasyonu (yeni konteynerler için geçerli).
docker_restart=0
if write_if_changed /etc/docker/daemon.json 0644 <<'JSON'; then
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
JSON
  docker_restart=1
fi
systemctl enable --now docker
if [[ $docker_restart -eq 1 ]]; then
  systemctl restart docker
fi
usermod -aG docker "$DEPLOY_USER"

log "Çalışma dizini: $INFRA_PATH"
install -d -m 755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$INFRA_PATH"

cat <<DONE

Bootstrap tamam. Bu oturumu KAPATMADAN yeni bir terminalde dene:
  ssh -p $SSH_PORT $DEPLOY_USER@<sunucu-ip>
Çalışıyorsa root girişi artık kapalıdır.

Sıradaki adımlar (deploy kullanıcısıyla):
  1. Repo'yu $INFRA_PATH altına al (infra/README.md > "VPS alındığı gün").
  2. cp infra/.env.example infra/.env   # GHCR_TOKEN (yalnızca read:packages)
     infra/scripts/ghcr-login.sh
  3. cp infra/core/.env.example infra/core/.env   # TUNNEL_TOKEN
     infra/scripts/core-up.sh
  4. infra/scripts/app-up.sh monitoring ; infra/scripts/app-up.sh ornek
  5. sudo infra/backup/install-timer.sh
DONE
