// pnpm lab:new <slug>  →  lab/apps/<slug>/ altında Vite + TypeScript (vanilla) şablonundan yeni app açar
// ve lab/public/_headers'a o app için sıkı bir CSP kuralı ekler.
import { appendFileSync, cpSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { APPS, LAB, SIKI_CSP, SLUG_DESENI, pnpm } from './ortak.mjs';

const slug = process.argv[2];
if (!slug || !SLUG_DESENI.test(slug)) {
  console.error('Kullanım: pnpm lab:new <slug>   (slug: küçük harf, rakam, tire; örn. yilan, kelime-avi)');
  process.exit(1);
}
if (slug === 'assets') {
  console.error('"assets" adı lab için ayrılmış (Vite çıktı klasörü).');
  process.exit(1);
}
const hedef = join(APPS, slug);
if (existsSync(hedef)) {
  console.error(`lab/apps/${slug} zaten var.`);
  process.exit(1);
}

// "kelime-avi" → "Kelime Avi" (başlangıç adı; meta.json'da Türkçe karakterlerle düzeltin)
const ad = slug
  .split('-')
  .map((p) => p.charAt(0).toLocaleUpperCase('tr') + p.slice(1))
  .join(' ');

cpSync(join(LAB, 'templates', 'vanilla-ts'), hedef, { recursive: true });

function doldur(dizin) {
  for (const girdi of readdirSync(dizin)) {
    const yol = join(dizin, girdi);
    if (statSync(yol).isDirectory()) {
      doldur(yol);
    } else if (/\.(json|ts|html|css|svg|md)$/.test(girdi)) {
      const metin = readFileSync(yol, 'utf8').replaceAll('__SLUG__', slug).replaceAll('__AD__', ad);
      writeFileSync(yol, metin);
    }
  }
}
doldur(hedef);

// lab/public/_headers'a bu app için sıkı CSP kuralı ekle (zaten varsa dokunma). Dosya LF satır sonuyla yazılır.
const basliklar = join(LAB, 'public', '_headers');
const mevcut = existsSync(basliklar) ? readFileSync(basliklar, 'utf8') : '';
const kuralVar = mevcut.split(/\r?\n/).some((satir) => satir.trim() === `/${slug}/*`);
if (kuralVar) {
  console.log(`lab/public/_headers: /${slug}/* kuralı zaten var, dokunulmadı.`);
} else {
  const onek = mevcut === '' || mevcut.endsWith('\n') ? '' : '\n';
  appendFileSync(
    basliklar,
    `${onek}\n# ${slug}: sıkı CSP (pnpm lab:new ekledi). App'e özel ihtiyaçlar (harici kaynak, blob:, wasm…) elle gevşetilir.\n` +
      `/${slug}/*\n  Content-Security-Policy: ${SIKI_CSP}\n`,
  );
  console.log(`lab/public/_headers: /${slug}/* için sıkı CSP kuralı eklendi.`);
}

console.log(`lab/apps/${slug} oluşturuldu. Bağımlılıklar kuruluyor (pnpm install)…`);
const kurulum = pnpm(['install']);
if (kurulum.status !== 0) {
  console.error('pnpm install başarısız; elle çalıştırın.');
  process.exit(kurulum.status ?? 1);
}
console.log(`
Hazır. Sıradaki adımlar:
  1. lab/apps/${slug}/meta.json içinde ad, ozet, tur ve kapak (public/ içindeki dosya) alanlarını doldurun.
  2. pnpm lab:dev ${slug}   →  http://localhost:5173/${slug}/
  3. pnpm lab:build        →  lab/dist/${slug}/
  4. CSP gevşetmek gerekirse lab/public/_headers içindeki /${slug}/* kuralını düzenleyin.
Kural: çıktı statik ve base /${slug}/; SPA yönlendirmesi varsa hash routing (#/…) kullanın.`);
