# infra

Tek bir Hetzner VPS'in (Ubuntu 24.04; x86 CX23 ya da ARM CAX11) altyapı kodu. Tüm imajlar çok mimarilidir
(amd64 + arm64), yani iki sunucu tipinde de aynı dosyalar çalışır.

```
internet ──▶ Cloudflare ──▶ tunnel gokturkfulser-vps ──▶ cloudflared ──▶ Traefik ──▶ servisler
                 (TLS burada biter; VPS'te hiçbir port açık değil)        (edge ağı)
```

| Yol | Amaç |
| --- | --- |
| `bootstrap.sh` | Sunucu ilk kurulumu (kullanıcı, SSH, ufw, fail2ban, otomatik güncelleme, Docker) |
| `core/` | Traefik + cloudflared + docker-socket-proxy; `edge` ağını oluşturur |
| `apps/_template/` | Yeni servis şablonu; `apps/ornek/` traefik/whoami örneği |
| `monitoring/` | Uptime Kuma (`status.gokturkfulser.com`) |
| `backup/` | restic → R2 (`gokturkfulser-backup`), systemd timer, restore |
| `templates/` | Servis şablonları: `fastapi-service/` (+ ayrı repolar için `templates/README.md`) |
| `scripts/` | VPS komutları: `core-up.sh`, `app-up.sh <ad>`, `app-down.sh <ad>`, `ghcr-login.sh`; `validate.sh` (CI) |
| `local.env` | Yerel test değişkenleri (`DOMAIN=localhost`; gizli bilgi yok) |

Gizli bilgiler yalnızca `.env.example` şablonlarındadır; gerçek `.env` dosyaları git'e girmez.

## Yerelde test (Windows + Docker Desktop/WSL2)

Kök dizinden, PowerShell'de:

```powershell
pnpm infra:up      # core (cloudflared kapalı) + ornek + monitoring
pnpm infra:logs    # core loglarını izle
pnpm infra:down    # hepsini kapat (volume'lar silinmez)
```

Traefik `127.0.0.1:80`'de dinler; host kuralları `<app>.localhost`. Windows'ta `*.localhost` çözümlemesine
güvenme, `Host` başlığıyla dene:

```powershell
curl.exe -i -H "Host: ornek.localhost"  http://localhost   # whoami çıktısı (200)
curl.exe -i -H "Host: status.localhost" http://localhost   # Uptime Kuma (302 /setup-database)
curl.exe -i -H "Host: yok.localhost"    http://localhost   # 404 (Traefik'te kural yok)
```

Doğrulama (LF satır sonu, shellcheck, actionlint, `docker compose config`): `pnpm infra:check`
(bash gerekir: Git Bash/WSL; shellcheck/actionlint yoksa Docker imajıyla çalışır). CI de aynısını çalıştırır.

Yedek akışını yerelde denemek için `backup/.env` içine `RESTIC_REPOSITORY=/repo`, `RESTIC_PASSWORD=...` ve
`RESTIC_LOCAL_VOLUME=restic-local-test` yazıp `bash infra/backup/backup.sh` çalıştır (R2'ye gitmez).

## Cloudflare DNS: wildcard kaydı mevcut kayıtları ezmez

Cloudflare DNS belgesine göre ([Wildcard DNS records](https://developers.cloudflare.com/dns/manage-dns-records/reference/wildcard-dns-records/)):

- "A wildcard record applies only when no exact record exists at the queried name." Yani `*.gokturkfulser.com`
  yalnızca **tanımsız** isimleri yakalar. Açıkça tanımlı apex, `www` (AAAA `100::`), `lab` (Worker) ve diğer
  kayıtların kendi içerikleri geçerli kalır. Belge e-postadan özel olarak söz etmez; aynı kural gereği tam
  eşleşen MX/TXT kayıtları (apex'teki Email Routing kayıtları, `_dmarc`, DKIM vb.) da etkilenmez.
- Bir isimde kayıt varsa wildcard o isim ve altı için uygulanmaz.
- Wildcard ilk etikette çalışır ve varsayılan olarak çok seviyelidir: `a.b.gokturkfulser.com` da yakalanır.
  Universal SSL yalnızca `*.gokturkfulser.com` (ilk seviye) için sertifika verir; bu yüzden uygulamaları
  tek seviyede tut (`ornek.gokturkfulser.com`), `x.ornek.gokturkfulser.com` kullanma.
- Tüm planlarda oluşturulabilir ve proxy'lenebilir (turuncu bulut).

Bunun doğrudan sonucu: wildcard açıldığı andan itibaren **her tanımsız subdomain tunnel'a düşer** (Traefik'te
kural yoksa 404). Bu yüzden yeni servis için DNS kaydı gerekmez, ama yönetim panelleri (status) Access ile
korunmadan yayına alınmamalıdır (aşağıya bak).

Tunnel yönlendirme kaydı: panelde eklenen tekil "published application" rotası için Cloudflare CNAME'i
kendisi oluşturur. Joker (`*`) rota için kaydın otomatik oluştuğunu belgelerden doğrulayamadım; oluşmazsa elle
ekle: **DNS → Records → Add record**: `CNAME`, ad `*`, hedef `<TUNNEL_UUID>.cfargotunnel.com`, **Proxied**.
Bu `*` kaydı dışında mevcut hiçbir kaydı değiştirme/silme.

## VPS alındığı gün

### 1. Hetzner sunucusu ve firewall

1. Hetzner Console → proje → **Add Server**. Konum: sana yakın (ör. Falkenstein/Nuremberg/Helsinki).
   Image: **Ubuntu 24.04**. Tip: **CX23** (x86) ya da **CAX11** (ARM); ikisi de olur. Networking: IPv4 + IPv6.
2. **SSH key** ekle (kendi açık anahtarın). Parola ile giriş açma.
3. **Firewall** oluştur ve sunucuya ata (Console → Firewalls):
   - Inbound: yalnızca **TCP 22** (mümkünse kaynak olarak kendi IP'n). HTTP/HTTPS açma; trafik tunnel ile gelir.
   - Outbound: hepsi açık kalsın (cloudflared Cloudflare'e giden 7844 bağlantısı, apt, GHCR, R2 için).
   - Bu, sunucudaki ufw'ye ek ikinci katmandır.
4. Sunucu IP'sini not et.

### 2. Bootstrap

```bash
ssh root@<ip>
apt-get update && apt-get install -y git
# repo private: önce deploy anahtarını koyacağın dizini hazırla (3. adım) ya da bootstrap.sh'i scp ile kopyala
scp infra/bootstrap.sh root@<ip>:/root/        # yerelden (Git Bash/WSL/PowerShell scp)
sudo DEPLOY_SSH_PUBKEY="$(cat ~/.ssh/id_ed25519.pub)" bash /root/bootstrap.sh
```

`DEPLOY_SSH_PUBKEY` verilmezse root'un `authorized_keys` dosyası (Hetzner'in eklediği anahtar) `deploy`a
kopyalanır. Script yapılanları: `deploy` kullanıcısı (+docker grubu), SSH yalnızca anahtarla ve root girişi
kapalı (`/etc/ssh/sshd_config.d/00-gokturkfulser.conf`), ufw (yalnızca SSH, hız sınırlı), fail2ban,
unattended-upgrades, Docker + Compose eklentisi, Docker log rotasyonu (10 MB × 3), saat dilimi
`Europe/Istanbul`. Tekrar çalıştırmak güvenlidir.

**Root oturumunu kapatmadan** yeni terminalde `ssh deploy@<ip>` ile girişi doğrula.

### 3. Repo'yu sunucuya al (private repo)

`deploy` olarak:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N "" -C "gokturkfulser-vps"
cat ~/.ssh/github_deploy.pub
```

GitHub → repo `gokturkfulser/gokturkfulser.com` → Settings → Deploy keys → Add (salt-okunur, "Allow write
access" işaretleme). Sonra:

```bash
printf 'Host github.com\n  IdentityFile ~/.ssh/github_deploy\n  IdentitiesOnly yes\n' >> ~/.ssh/config
chmod 600 ~/.ssh/config
git clone git@github.com:gokturkfulser/gokturkfulser.com.git /opt/gokturkfulser
cd /opt/gokturkfulser/infra
```

### 4. GHCR girişi (private image'lar)

Repo private olduğu için GHCR image'ları da private. VPS'in çekebilmesi için **yalnızca `read:packages`**
yetkili bir token kullan (GHCR için **classic** PAT gerekir; fine-grained token'lar GitHub Packages'i
desteklemez). GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → yalnızca
`read:packages`.

```bash
cp .env.example .env && chmod 600 .env && nano .env     # GHCR_TOKEN=...
./scripts/ghcr-login.sh                                  # docker login ghcr.io
```

Token yalnızca sunucudaki `infra/.env`'dedir; repo'ya girmez. Bu token write yetkisi taşımaz; image
yayınlamak için kullanılmaz (o iş GitHub Actions'ta `GITHUB_TOKEN` ile yapılır).

### 5. Cloudflare Tunnel (gokturkfulser-vps) ve wildcard hostname

1. Cloudflare Zero Trust → **Networking → Tunnels → Create a tunnel** → ad: `gokturkfulser-vps`.
2. Ortam olarak **Docker**'ı seç; komutu **çalıştırma**, yalnızca token'ı (`eyJ...`) kopyala.
3. Tunnel → **Published application routes → Add**: Subdomain `*`, Domain `gokturkfulser.com`, Service
   **HTTP**, URL `traefik:80`.
4. DNS'te `*` CNAME'inin (proxied, `<UUID>.cfargotunnel.com`) olduğunu kontrol et; yoksa yukarıdaki gibi ekle.
5. **Mevcut kayıtları kontrol et** (wildcard sonrası): apex, `www`, `lab` ve e-posta kayıtları değişmemiş
   olmalı; siteleri aç ve bir test e-postası gönder.

### 6. Çekirdeği başlat

```bash
cd /opt/gokturkfulser/infra
cp core/.env.example core/.env && chmod 600 core/.env && nano core/.env   # TUNNEL_TOKEN=eyJ...
./scripts/core-up.sh
docker compose -f core/compose.yml ps        # üçü de healthy
```

Tunnel'ın Cloudflare panelinde **Healthy** görünmesini bekle.

### 7. Uptime Kuma ve Access koruması

Wildcard açık olduğu için `status.gokturkfulser.com` Uptime Kuma'yı başlatır başlatmaz internete açılır ve ilk
kurulum ekranı (admin hesabı oluşturma) ilk gelene verilir. **Önce Access'i kur, sonra servisi başlat.**

1. Zero Trust → **Access controls → Applications → Add an application → Self-hosted**.
2. Ad: `status`. Destination: public hostname `status.gokturkfulser.com` (Path boş: tüm trafik).
3. Policy → **Add a policy**: Action **Allow**; Include selector **Cloudflare Account Member**
   (arayüzde "Cloudflare account"), hesap boş = bu hesap. Bu seçici yalnızca Cloudflare kimlik sağlayıcısı
   etkinse görünür; Settings → Authentication → Login methods bölümünden **Cloudflare**'i ekle (yeni hesaplarda
   varsayılandır).
4. Kaydet. Tarayıcıda `https://status.gokturkfulser.com` Cloudflare giriş ekranına yönlenmeli (gizli
   pencerede dene). Politikada Include → Everyone **olmamalı**; o herkese açar.
5. Şimdi servisi başlat ve ilk kurulumu tamamla (admin hesabı, ardından 2FA aç):
   ```bash
   ./scripts/app-up.sh monitoring
   ./scripts/app-up.sh ornek      # isteğe bağlı: https://ornek.gokturkfulser.com
   ```
6. Kuma'da izlenecek monitörleri ekle (gokturkfulser.com, lab.gokturkfulser.com). Herkese açık bir durum
   sayfası istersen yalnızca `status.gokturkfulser.com/status/*` yolu için ayrı bir Access uygulaması + Bypass
   politikası oluştur; yönetim paneli korumalı kalsın.

`ornek` herkese açıktır; işin bitince `./scripts/app-down.sh ornek`.

### 8. Yedek kurulumu ve doğrulama

1. Cloudflare → **R2** → bucket `gokturkfulser-backup` (yoksa oluştur). **Manage API tokens** → Object
   Read & Write, yalnızca bu bucket'a kısıtlı token; Access Key ID/Secret'ı kaydet.
2. `cp backup/.env.example backup/.env && nano backup/.env`: `<CLOUDFLARE_ACCOUNT_ID>`, anahtarlar ve güçlü bir
   `RESTIC_PASSWORD` (parola yöneticisine de kaydet; kaybedersen yedekler açılmaz). Değerleri tırnaksız yaz.
3. İlk yedeği elle al: `./backup/backup.sh` (repoyu kendisi `init` eder, sonda `restic check` çalışır).
4. Zamanlayıcıyı kur: `sudo ./backup/install-timer.sh`; her gün ~03:30 (+0–15 dk rastgele), kaçırılan çalışma
   açılışta yapılır. Kontrol: `systemctl list-timers gokturkfulser-backup.timer`,
   `journalctl -u gokturkfulser-backup.service -n 50`.
5. Doğrula: `./backup/restore.sh list` snapshot göstermeli; R2 panelinde bucket dolu olmalı.
6. Geri yükleme tatbikatı (bir kez, sonra aralıklı): `./scripts/app-down.sh monitoring`, ardından
   `./backup/restore.sh gokturkfulser-monitoring_uptime-kuma-data` (veya `... <volume> <snapshot-id>`), sonra
   `./scripts/app-up.sh monitoring`. Script, volume'u çalışan bir konteyner kullanıyorsa reddeder.

Kapsam ve saklama: yalnızca `com.gokturkfulser.backup=true` etiketli volume'lar yedeklenir (Uptime Kuma'nınki
etiketli; yeni servislerde volume'a bu etiketi ekle). Saklama: 7 günlük, 4 haftalık, 6 aylık
(`backup/.env` içindeki `KEEP_*`).

#### Yedek tutarlılığı: veritabanı dump'ı (`com.gokturkfulser.backup.pre`)

Yedek çalışan servisten alınır; açık bir SQLite/Postgres dosyasını doğrudan kopyalamak bozuk yedek verebilir.
Veritabanı kullanan servis, yedekten **önce** konteynerinde çalışacak dump komutunu label ile bildirir:

```yaml
services:
  db:
    labels:
      # SQLite (python imajında sqlite3 CLI yok; standart kütüphane yeter). ">-" satırları birleştirir.
      com.gokturkfulser.backup.pre: >-
        python -c "import sqlite3;
        sqlite3.connect('/data/app.db').backup(sqlite3.connect('/data/dump.sqlite'))"
      # Postgres: "pg_dump -U $$POSTGRES_USER -Fc -f /backups/db.dump $$POSTGRES_DB"  (compose'ta $ için $$)
    volumes:
      - data:/data
volumes:
  data:
    labels:
      com.gokturkfulser.backup: "true"   # dump'ın yazıldığı volume yedeklenenler arasında olmalı
```

`backup.sh`, `com.gokturkfulser.backup.pre` etiketli **çalışan** konteynerlerde komutu `sh -c` ile çalıştırır
(zaman aşımı `BACKUP_PRE_TIMEOUT`, varsayılan 600 sn), sonra volume'ları yedekler; dump böylece yedeğe girer.
Kurallar: komut dump'ı her çalışmada **üzerine yazmalı**; dump, yedeklenen (etiketli) bir volume'a yazılmalı;
komut konteynerin kendi imajında çalışabilmeli. Komut başarısız olursa yedek yine alınır (diğer servisler ve önceki
dump korunur) ama script sonda `exit 1` verir, yani `gokturkfulser-backup.service` "failed" görünür. Geri
yüklemede dump'ı kullan (`restore.sh` volume'u geri koyar; Postgres için `pg_restore`, SQLite için `dump.sqlite`'ı
`app.db` yap). Şablonlardaki compose.yml'lerde bu etiket yorum satırı olarak örneklenir; `ornek`/`ornek-api` kullanmaz.

### 9. GitHub secret/variable'ları

- **Şu an gerekmez.** `infra.yml` yalnızca doğrulama yapar; secret kullanmaz.
- Servis image'larını `ghcr.io/gokturkfulser/gokturkfulser-<app>` olarak yayınlayan workflow'lar
  (`services/` görevi) `GITHUB_TOKEN` ile (`permissions: packages: write`) push eder; ek secret gerekmez.
- Servis workflow'larındaki (`service-<app>.yml`) deploy job'u yalnızca repo variable'ı `DEPLOY_TARGET` = `vps`
  ise çalışır; tanımlı değilken atlanır ve workflow yeşil kalır. Açmak için (Settings → Secrets and variables →
  Actions): variables `DEPLOY_TARGET=vps`, `VPS_HOST`, `VPS_USER` (= `deploy`); secrets `VPS_SSH_KEY` (yalnızca bu
  iş için üretilmiş, `deploy`a yetkilendirilmiş ayrı anahtar), `VPS_KNOWN_HOSTS` (`ssh-keyscan <ip>` çıktısı).
  Deploy sunucuda `git pull --ff-only` + `IMAGE_TAG=sha-<7> app-up.sh <app>` çalıştırır. Elle `app-up.sh`
  yeniden çalıştırılırsa `IMAGE_TAG` yoksa `latest` (aynı image) kullanılır.
- Sunucudaki gizliler GitHub'a girmez: `infra/.env` (GHCR_TOKEN), `infra/core/.env` (TUNNEL_TOKEN),
  `infra/backup/.env` (R2 + restic).

## Yeni servis ekleme

Aynı repoda FastAPI servisi (kök dizinden):

```powershell
pnpm service:new skor-api
```

Komut `infra/templates/fastapi-service/`'i `services/skor-api/` altına kopyalar, `infra/apps/skor-api/compose.yml`
ve `.github/workflows/service-skor-api.yml`'yi üretir (geçersiz ya da var olan ad anlaşılır hatayla durur).
Yerelde çalıştırma/test, Python sürüm gerekçesi ve CI akışı: `services/skor-api/README.md` (kaynağı
`templates/fastapi-service/README.md`). Ayrı repodaki projeler için: [templates/README.md](templates/README.md).

VPS'te, image GHCR'a yayınlandıktan sonra (ya da CI deploy'u açıksa otomatik):

```bash
cd /opt/gokturkfulser && git pull --ff-only
cp infra/apps/skor-api/.env.example infra/apps/skor-api/.env   # gerekiyorsa doldur
./scripts/app-up.sh skor-api     # https://skor-api.gokturkfulser.com, DNS kaydı gerekmez (wildcard)
```

Hazır image'lı (kendi kodumuz olmayan) uygulamalar için elle: `cp -r apps/_template apps/<ad>` ve `sablon` → `<ad>`.
Yerelde denemek için compose'u `docker compose --env-file infra/local.env -f infra/apps/<ad>/compose.yml up -d`
ile (core ayakta olmalı) çalıştır; adres `http://<ad>.localhost`.

## Güvenlik notları

- Docker, yayımlanan portları ufw'yi atlayarak açar. Bu yapıda **hiçbir servis `ports:` ile port yayımlamaz**
  (yalnızca yerel override'da Traefik `127.0.0.1:80`).
- Traefik Docker soketine doğrudan değil, salt-okunur `docker-socket-proxy` üzerinden erişir; proxy ağı
  `internal`dir. Traefik dashboard'u kapalıdır.
- `docker` grubu root eşdeğeridir; `deploy` hesabının SSH anahtarını koru.
- Tüm konteynerler `no-new-privileges`, CPU/RAM limitli ve log boyutu sınırlıdır.
