// lab script'lerinin ortak yardımcıları (Windows + Linux).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const LAB = fileURLToPath(new URL('..', import.meta.url));
export const APPS = join(LAB, 'apps');
export const SLUG_DESENI = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Yeni app'lerin başlangıç CSP'si (sıkı). App'e özel ihtiyaçlar lab/public/_headers'ta elle gevşetilir. */
export const SIKI_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; " +
  "base-uri 'self'; object-src 'none'; form-action 'none'";

/** pnpm'i verilen argümanlarla çalıştırır; `shell` Windows'ta pnpm.cmd'yi bulmak içindir. */
export function pnpm(args, secenekler = {}) {
  return spawnSync(['pnpm', ...args].join(' '), { cwd: LAB, stdio: 'inherit', shell: true, ...secenekler });
}

/** lab/apps altındaki her app'i okur ve meta.json'u doğrular; hata varsa açıklayıcı bir Error atar. */
export function uygulamalariOku() {
  if (!existsSync(APPS)) return [];
  const sonuc = [];
  for (const d of readdirSync(APPS, { withFileTypes: true })) {
    if (!d.isDirectory() || d.name.startsWith('.')) continue;
    const slug = d.name;
    const dizin = join(APPS, slug);
    const hata = (m) => new Error(`lab/apps/${slug}: ${m}`);

    if (!SLUG_DESENI.test(slug)) throw hata('klasör adı küçük harf, rakam ve tire içermeli (slug)');
    if (!existsSync(join(dizin, 'package.json'))) throw hata('package.json yok');
    const paket = JSON.parse(readFileSync(join(dizin, 'package.json'), 'utf8'));
    if (paket.name !== `lab-${slug}`) throw hata(`paket adı "lab-${slug}" olmalı (şu an "${paket.name}")`);
    if (!paket.scripts?.build) throw hata('"build" script\'i yok');

    if (!existsSync(join(dizin, 'meta.json'))) throw hata('meta.json yok');
    const meta = JSON.parse(readFileSync(join(dizin, 'meta.json'), 'utf8'));
    for (const alan of ['ad', 'ozet', 'tur', 'kapak']) {
      if (typeof meta[alan] !== 'string' || !meta[alan].trim()) throw hata(`meta.json "${alan}" alanı dolu bir metin olmalı`);
    }
    if (!existsSync(join(dizin, 'public', meta.kapak))) {
      throw hata(`kapak dosyası public/${meta.kapak} bulunamadı (meta.json "kapak" public/ içindeki dosya adıdır)`);
    }
    sonuc.push({ slug, dizin, meta });
  }
  return sonuc.sort((a, b) => a.meta.ad.localeCompare(b.meta.ad, 'tr'));
}
