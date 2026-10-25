// "Son izlediklerim" şeridinin afişlerini her build'den önce TMDB'den indirir. Çalıştırma: `pnpm --filter site afisler`
// (`build` betiği bunu otomatik çalıştırır). İndirilenler `src/data/letterboxd/afis/<tmdbId>.jpg` altına gider; klasör
// .gitignore'dadır, repo'ya girmez. Sinema yazılarının TMDB verisi ise ayrıdır: `pnpm site:tmdb` ve repo'da kalır.
// - Kaynak: LETTERBOXD_RSS'teki `tmdb:movieId`'ler (TMDB kimliği olmayan öğeler atlanır). Anahtar: TMDB_API_KEY (build değişkeni).
// - Hiçbir durumda build'i düşürmez: anahtar/akış yoksa ya da TMDB'ye ulaşılamazsa uyarı yazıp 0 ile çıkar;
//   şerit o filmler için afişsiz (yalnızca metin) çizilir.
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Şerit akışın ilk 6 filmini gösterir; birkaçı TMDB'de bulunmazsa diye bir miktar fazlası indirilir. */
const ADET = 12;

const klasor = join(dirname(fileURLToPath(import.meta.url)), '../src/data/letterboxd/afis');
const API = process.env.TMDB_API_TABANI ?? 'https://api.themoviedb.org/3';
const GORSEL = process.env.TMDB_GORSEL_TABANI ?? 'https://image.tmdb.org/t/p';
const rss = process.env.LETTERBOXD_RSS;
const anahtar = process.env.TMDB_API_KEY;

async function temizle() {
  await mkdir(klasor, { recursive: true });
  for (const dosya of await readdir(klasor)) if (dosya.endsWith('.jpg')) await rm(join(klasor, dosya), { force: true });
}

async function calis() {
  await temizle();
  if (!rss) return console.log('letterboxd-afis: LETTERBOXD_RSS yok, atlandı.');
  if (!anahtar) return console.warn('letterboxd-afis: TMDB_API_KEY yok, şerit afişsiz çizilecek.');

  const yanit = await fetch(rss, { signal: AbortSignal.timeout(15_000) });
  if (!yanit.ok) throw new Error(`Letterboxd ${yanit.status} ${yanit.statusText}`);
  const xml = await yanit.text();
  const idler = [...new Set([...xml.matchAll(/<tmdb:movieId>\s*(\d+)\s*<\/tmdb:movieId>/g)].map((m) => Number(m[1])))].slice(0, ADET);

  // v4 token JWT'dir (eyJ...); v3 anahtar 32 karakterlik hex.
  const bearer = anahtar.startsWith('eyJ');
  let indirilen = 0;
  for (const id of idler) {
    try {
      const url = new URL(`${API}/movie/${id}`);
      if (!bearer) url.searchParams.set('api_key', anahtar);
      const film = await fetch(url, { headers: bearer ? { Authorization: `Bearer ${anahtar}` } : {}, signal: AbortSignal.timeout(15_000) });
      if (!film.ok) throw new Error(`${film.status} ${film.statusText}`);
      const yol = ((await film.json()) as { poster_path?: string }).poster_path;
      if (!yol) continue;
      const resim = await fetch(`${GORSEL}/w500${yol}`, { signal: AbortSignal.timeout(30_000) });
      if (!resim.ok) throw new Error(`afiş ${resim.status}`);
      await writeFile(join(klasor, `${id}.jpg`), Buffer.from(await resim.arrayBuffer()));
      indirilen++;
    } catch (e) {
      console.warn(`letterboxd-afis: ${id} atlandı (${(e as Error).message})`);
    }
  }
  console.log(`letterboxd-afis: ${indirilen}/${idler.length} afiş indirildi.`);
}

try {
  await calis();
} catch (e) {
  console.warn(`letterboxd-afis: ${(e as Error).message}; şerit afişsiz çizilecek.`);
}
process.exit(0);
