// Statik varlıkları üretir: public/stil.css (yazı tipi tanımları + sitenin tokens.css'i + kontrol/src/stil.css), public/uygulama.js, public/fonts/.
// Token'lar paylaşılır (site/src/styles/tokens.css), kopyalanmaz: her build'de yeniden birleştirilir. public/ repoya girmez (.gitignore).
// Workers Builds wrangler'ın `build.command` ayarını uygulamaz; bu betik Build command içinde çalışır (pnpm --filter kontrol build).
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const burasi = dirname(fileURLToPath(import.meta.url));
const kok = resolve(burasi, '..');
const cikti = join(kok, 'public');
rmSync(cikti, { recursive: true, force: true });
mkdirSync(join(cikti, 'fonts'), { recursive: true });

// Yazı tipi: Hanken Grotesk (sitenin gövde fontu), yerel woff2 dosyaları (harici kaynak yok).
const gerekli = createRequire(join(kok, 'package.json'));
const fontKlasoru = dirname(gerekli.resolve('@fontsource/hanken-grotesk/package.json'));
const agirliklar = [400, 500, 600, 700, 800];
const alt = [
  ['latin', 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'],
  ['latin-ext', 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF'],
];
let fontCss = '';
for (const w of agirliklar) {
  for (const [ad, aralik] of alt) {
    const dosya = `hanken-grotesk-${ad}-${w}-normal.woff2`;
    copyFileSync(join(fontKlasoru, 'files', dosya), join(cikti, 'fonts', dosya));
    fontCss += `@font-face{font-family:'Hanken Grotesk';font-style:normal;font-display:swap;font-weight:${w};src:url('/fonts/${dosya}') format('woff2');unicode-range:${aralik}}\n`;
  }
}

const tokens = readFileSync(resolve(kok, '../site/src/styles/tokens.css'), 'utf8');
const stil = readFileSync(join(kok, 'src/stil.css'), 'utf8');
writeFileSync(join(cikti, 'stil.css'), `${fontCss}\n/* site/src/styles/tokens.css (paylaşılan) */\n${tokens}\n/* kontrol/src/stil.css */\n${stil}`);
copyFileSync(join(kok, 'src/istemci.js'), join(cikti, 'uygulama.js'));
console.log('kontrol: varlıklar üretildi (public/stil.css, uygulama.js, fonts/).');
