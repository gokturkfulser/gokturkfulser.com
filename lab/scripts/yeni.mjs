// pnpm lab:new <slug>  →  lab/apps/<slug>/ altında Vite + TypeScript (vanilla) şablonundan yeni app açar.
import { cpSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { APPS, LAB, SLUG_DESENI, pnpm } from './ortak.mjs';

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
Kural: çıktı statik ve base /${slug}/; SPA yönlendirmesi varsa hash routing (#/…) kullanın.`);
