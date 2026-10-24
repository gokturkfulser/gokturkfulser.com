// Tahmin doğrulaması için sözlük üretir: src/sozluk.txt (beş harfli, küçük harfli, Türk alfabesi).
// Kaynak: dictionary-tr (MIT, bkz. KAYNAK.md). Kullanım: pnpm --filter lab-kelime-avi sozluk
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import dictionary from 'dictionary-tr';
import nspell from 'nspell';

const CIKTI = fileURLToPath(new URL('../src/sozluk.txt', import.meta.url));
const ALFABE = 'abcçdefgğhıijklmnoöprsştuüvyz';
const desen = new RegExp(`^[${ALFABE}]{5}$`, 'u');

const baslangic = Date.now();
const dizgi = nspell(dictionary);
// nspell, ek kurallarını yükleme sırasında uygulayıp çekimli biçimleri `data`'ya koyar.
const tumu = Object.keys(dizgi.data);
console.log(`Toplam biçim (çekimliler dahil): ${tumu.length} (${((Date.now() - baslangic) / 1000).toFixed(1)} sn)`);

const secilen = new Set();
for (const w of tumu) {
  // Yalnızca tamamen küçük harfli biçimler: özel isimler (Ankara), kısaltmalar (AA) ve noktalı/tireli girdiler elenir.
  if (w !== w.toLocaleLowerCase('tr')) continue;
  if (!desen.test(w)) continue;
  secilen.add(w);
}
const sirali = [...secilen].sort((a, b) => a.localeCompare(b, 'tr'));
writeFileSync(CIKTI, sirali.join('\n') + '\n');
console.log(`5 harfli, küçük harfli, Türk alfabesi: ${sirali.length} kelime → src/sozluk.txt`);
