// pnpm lab:build: tüm app'leri build eder, lab/dist/<slug>/ altında toplar, liste sayfasını üretir.
// Çıktı tamamen statiktir (Workers static assets).
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LAB, pnpm, uygulamalariOku } from './ortak.mjs';
import { indexSayfasi, lab404, labCss } from './sayfalar.mjs';

const DIST = join(LAB, 'dist');
const uygulamalar = uygulamalariOku();

if (uygulamalar.length === 0) {
  console.error('lab/apps altında app yok. Yeni app için: pnpm lab:new <slug>');
  process.exit(1);
}

// 1) Her app'i kendi aracıyla build et (çıktı: lab/apps/<slug>/dist)
for (const u of uygulamalar) {
  console.log(`\n▶ lab-${u.slug} build ediliyor…`);
  rmSync(join(u.dizin, 'dist'), { recursive: true, force: true });
  const sonuc = pnpm(['--filter', `lab-${u.slug}`, 'build']);
  if (sonuc.status !== 0) {
    console.error(`lab-${u.slug} build başarısız.`);
    process.exit(sonuc.status ?? 1);
  }
  const index = join(u.dizin, 'dist', 'index.html');
  if (!existsSync(index)) {
    console.error(`lab/apps/${u.slug}/dist/index.html yok: app "dist" klasörüne statik çıktı üretmeli.`);
    process.exit(1);
  }
  // base path doğrulaması: kök-mutlak (/assets/…) bağlantı varsa app /<slug>/ ile build edilmemiştir.
  const html = readFileSync(index, 'utf8');
  const kokMutlak = [...html.matchAll(/(?:src|href)="(\/[^"/][^"]*)"/g)]
    .map((m) => m[1])
    .filter((y) => !y.startsWith(`/${u.slug}/`));
  if (kokMutlak.length > 0) {
    console.error(
      `lab/apps/${u.slug}: index.html /${u.slug}/ dışında kök-mutlak yollar içeriyor (${kokMutlak.join(', ')}). ` +
        `Vite'te base: '/${u.slug}/' olmalı.`,
    );
    process.exit(1);
  }
}

// 2) dist'i sıfırdan kur: public/ (headers, favicon) + app'ler + liste sayfası
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
cpSync(join(LAB, 'public'), DIST, { recursive: true });
for (const u of uygulamalar) {
  cpSync(join(u.dizin, 'dist'), join(DIST, u.slug), { recursive: true });
}

// Liste sayfasının yazı tipleri (DESIGN.md: Big Shoulders Display 800 + Literata 400; latin + latin-ext)
const yaziDizini = join(DIST, '_lab', 'yazi');
mkdirSync(yaziDizini, { recursive: true });
const fontDosyalari = [
  ['big-shoulders-display', 'big-shoulders-display-latin-800-normal.woff2'],
  ['big-shoulders-display', 'big-shoulders-display-latin-ext-800-normal.woff2'],
  ['literata', 'literata-latin-400-normal.woff2'],
  ['literata', 'literata-latin-ext-400-normal.woff2'],
  ['literata', 'literata-latin-700-normal.woff2'],
  ['literata', 'literata-latin-ext-700-normal.woff2'],
];
for (const [paket, dosya] of fontDosyalari) {
  const kaynak = join(LAB, 'node_modules', '@fontsource', paket, 'files', dosya);
  if (!existsSync(kaynak)) {
    console.error(`Yazı tipi bulunamadı: ${kaynak} (pnpm install çalıştırın).`);
    process.exit(1);
  }
  cpSync(kaynak, join(yaziDizini, dosya));
}

writeFileSync(join(DIST, '_lab', 'lab.css'), labCss(fontDosyalari.map(([, d]) => d)));
writeFileSync(join(DIST, 'index.html'), indexSayfasi(uygulamalar));
writeFileSync(join(DIST, '404.html'), lab404());

const klasorler = readdirSync(DIST, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
console.log(`\n✔ lab/dist hazır: ${uygulamalar.map((u) => `/${u.slug}/`).join(', ')} (klasörler: ${klasorler.join(', ')})`);
