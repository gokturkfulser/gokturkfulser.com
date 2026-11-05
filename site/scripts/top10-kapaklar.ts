// Top 10 gecelerinin video kapaklarını her build'den önce YouTube'dan indirir. Çalıştırma: `pnpm --filter site top10-kapaklar` (`build` bunu otomatik çalıştırır).
// - Kaynak: src/content/top10/<sezon>/*.yaml içindeki `video:` adresleri; en yeni EN_YENI gece (kapak yalnızca son gecenin 1 numara bloğunda kullanılır).
// - Önce maxresdefault.jpg, yoksa hqdefault.jpg (i.ytimg.com herkese açık video kapağı). Dosyalar src/data/top10/kapak/ altına gider; klasör .gitignore'dadır.
// - Hiçbir durumda build'i düşürmez: indirilemezse uyarı yazıp 0 ile çıkar; sayfa kapaksız çizilir. Anahtar gerekmez.
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { videoKimligi } from '../src/lib/top10.ts';

const EN_YENI = 3;
const kok = join(dirname(fileURLToPath(import.meta.url)), '..');
const icerik = join(kok, 'src/content/top10');
const klasor = join(kok, 'src/data/top10/kapak');
const TABAN = process.env.TOP10_KAPAK_TABANI ?? 'https://i.ytimg.com/vi';
const taslakGorunur = process.env.SHOW_DRAFTS === 'true';

async function geceler(): Promise<{ tarih: string; id: string }[]> {
  const sonuc: { tarih: string; id: string }[] = [];
  for (const sezon of await readdir(icerik, { withFileTypes: true })) {
    if (!sezon.isDirectory()) continue;
    for (const dosya of await readdir(join(icerik, sezon.name))) {
      const e = /^(\d{4}-\d{2}-\d{2})\.yaml$/.exec(dosya);
      if (!e) continue;
      const metin = await readFile(join(icerik, sezon.name, dosya), 'utf8');
      if (!taslakGorunur && /^taslak:\s*true\s*$/m.test(metin)) continue;
      const adres = /^video:\s*["']?(\S+?)["']?\s*$/m.exec(metin)?.[1];
      const id = adres ? videoKimligi(adres) : undefined;
      if (id) sonuc.push({ tarih: e[1]!, id });
    }
  }
  return sonuc.sort((a, b) => b.tarih.localeCompare(a.tarih)).slice(0, EN_YENI);
}

async function indir(id: string): Promise<Buffer> {
  for (const ad of ['maxresdefault', 'hqdefault']) {
    const r = await fetch(`${TABAN}/${id}/${ad}.jpg`, { signal: AbortSignal.timeout(20_000) });
    if (!r.ok) continue;
    const b = Buffer.from(await r.arrayBuffer());
    if (b.length > 2_000) return b; // JPEG imzası ve makul boyut: boş yer tutucu gelmişse sıradaki boyuta geç
  }
  throw new Error('kapak bulunamadı');
}

async function calis() {
  await mkdir(klasor, { recursive: true });
  const liste = await geceler();
  const gerekli = new Set(liste.map((g) => `${g.id}.jpg`));
  for (const dosya of await readdir(klasor)) if (dosya.endsWith('.jpg') && !gerekli.has(dosya)) await rm(join(klasor, dosya), { force: true });
  let indirilen = 0;
  for (const g of liste) {
    try {
      await writeFile(join(klasor, `${g.id}.jpg`), await indir(g.id));
      indirilen++;
    } catch (e) {
      console.warn(`top10-kapaklar: ${g.tarih} (${g.id}) atlandı (${(e as Error).message})`);
    }
  }
  console.log(`top10-kapaklar: ${indirilen}/${liste.length} kapak indirildi.`);
}

try {
  await calis();
} catch (e) {
  console.warn(`top10-kapaklar: ${(e as Error).message}; sayfa kapaksız çizilecek.`);
}
