// pnpm service:new <ad>  →  FastAPI servis şablonundan yeni servis üretir (Windows + Linux):
//   services/<ad>/                       servis kodu, Dockerfile, testler
//   infra/apps/<ad>/compose.yml          VPS/yerel compose (+ .env.example)
//   .github/workflows/service-<ad>.yml   test + image + (isteğe bağlı) deploy
// Şablondaki "sablon" sözcüğü <ad> ile değiştirilir. Git'e dokunmaz.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = fileURLToPath(new URL('../..', import.meta.url));
const SABLON = join(KOK, 'infra', 'templates', 'fastapi-service');
const AD_DESENI = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const EN_FAZLA = 40;
// Tanımlı DNS kayıtları, altyapı bileşenleri ve diğer ayrılmış adlar.
const AYRILMIS = new Set([
  'www', 'lab', 'status', 'monitoring', 'core', 'edge', 'socket', 'traefik', 'cloudflared',
  'backup', 'mail', 'smtp', 'imap', 'ftp', 'api', 'admin', 'site', 'services', 'infra',
]);
// Servis klasörüne kopyalanmayanlar: üretilen/geçici dosyalar ve başka yere giden dosyalar.
const ATLA = new Set(['.venv', '.pytest_cache', '.ruff_cache', '__pycache__', 'compose.yml', 'workflow.yml', '.env.example']);

function hata(mesaj) {
  console.error(`HATA: ${mesaj}`);
  process.exit(1);
}

const ad = process.argv[2];
if (!ad) {
  hata('ad verilmedi.\nKullanım: pnpm service:new <ad>   (küçük harf, rakam, tire; örn. skor-api)');
}
if (!AD_DESENI.test(ad) || ad.length > EN_FAZLA) {
  hata(
    `geçersiz ad "${ad}". Kurallar: küçük harfle başlar; yalnızca küçük harf, rakam ve tek tire; en fazla ${EN_FAZLA} karakter ` +
      '(örn. skor-api). Büyük harf, alt çizgi, boşluk, baştaki/sondaki/çift tire olmaz.',
  );
}
if (AYRILMIS.has(ad) || ad.startsWith('_')) {
  hata(`"${ad}" ayrılmış bir ad (tanımlı DNS kaydı ya da altyapı bileşeni). Başka bir ad seç.`);
}

const hedefler = {
  servis: join(KOK, 'services', ad),
  uygulama: join(KOK, 'infra', 'apps', ad),
  workflow: join(KOK, '.github', 'workflows', `service-${ad}.yml`),
};
const var_ = Object.entries(hedefler).filter(([, yol]) => existsSync(yol));
if (var_.length > 0) {
  hata(
    `"${ad}" zaten var; hiçbir dosya yazılmadı:\n` + var_.map(([, yol]) => `  - ${relative(KOK, yol)}`).join('\n'),
  );
}
if (!existsSync(SABLON)) {
  hata(`şablon bulunamadı: ${relative(KOK, SABLON)}`);
}

const doldur = (metin) => metin.replace(/\r\n/g, '\n').replaceAll('sablon', ad);
const oku = (yol) => doldur(readFileSync(yol, 'utf8'));

/** Önce belleğe topla (bir şey eksikse diske hiç yazma), sonra yaz. */
function topla(dizin, cikti = []) {
  for (const girdi of readdirSync(dizin)) {
    if (ATLA.has(girdi)) continue;
    const yol = join(dizin, girdi);
    if (statSync(yol).isDirectory()) topla(yol, cikti);
    else cikti.push(yol);
  }
  return cikti;
}

const yazilacaklar = topla(SABLON).map((yol) => [join(hedefler.servis, relative(SABLON, yol)), oku(yol)]);
yazilacaklar.push([join(hedefler.uygulama, 'compose.yml'), oku(join(SABLON, 'compose.yml'))]);
yazilacaklar.push([join(hedefler.uygulama, '.env.example'), oku(join(SABLON, '.env.example'))]);
yazilacaklar.push([hedefler.workflow, oku(join(SABLON, 'workflow.yml'))]);

const olusturulan = [];
try {
  for (const [yol, icerik] of yazilacaklar) {
    mkdirSync(dirname(yol), { recursive: true });
    writeFileSync(yol, icerik, 'utf8'); // LF; şablon zaten LF'e çevrildi
    olusturulan.push(yol);
  }
} catch (e) {
  // Yarım kalmasın: yalnızca bu çalıştırmanın oluşturduğu (yukarıda var olmadığı doğrulanan) hedefleri geri al.
  rmSync(hedefler.servis, { recursive: true, force: true });
  rmSync(hedefler.uygulama, { recursive: true, force: true });
  rmSync(hedefler.workflow, { force: true });
  hata(`yazma başarısız, geri alındı: ${e.message}`);
}

console.log(`"${ad}" oluşturuldu (${olusturulan.length} dosya):`);
console.log(`  services/${ad}/                      kod, Dockerfile, testler`);
console.log(`  infra/apps/${ad}/compose.yml         + .env.example`);
console.log(`  .github/workflows/service-${ad}.yml`);
console.log(`
Sıradaki adımlar:
  1. cd services/${ad} ; uv sync ; uv run pytest           (uv: winget install astral-sh.uv)
  2. Yerelde Docker: services/${ad}/README.md > "Docker ile ve Traefik arkasında"
  3. İlk main push'tan sonra GHCR paketini repo'ya bağla (README > CI/CD); VPS'te: infra/scripts/app-up.sh ${ad}
Not: ${ad}.gokturkfulser.com için DNS kaydı gerekmez (wildcard tunnel).`);
