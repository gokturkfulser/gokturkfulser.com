// TMDB künye ve afiş çekici. Çalıştırma: `pnpm site:tmdb` (kökten) ya da `pnpm --filter site tmdb`.
// - Yalnızca film.tmdbId'si olan sinema yazılarını işler.
// - Cache'te olanı yeniden çekmez (`--yenile` ile hepsini yeniler).
// - Anahtar: TMDB_API_KEY (v3 anahtarı ya da v4 "API Read Access Token"). Anahtar repo'ya girmez.
// - Test için TMDB_API_TABANI ve TMDB_GORSEL_TABANI ortam değişkenleriyle sahte sunucuya yönlendirilebilir.
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

type Kayit = {
  tmdbId: number;
  baslik: string;
  orijinalBaslik: string;
  yil?: number;
  sure?: number;
  yonetmenler: string[];
  turler: string[];
  afis?: string;
  cekildi: string;
};

const kok = join(dirname(fileURLToPath(import.meta.url)), '..');
const sinemaKlasoru = join(kok, 'src/content/sinema');
const cacheYolu = join(kok, 'src/data/tmdb-cache.json');
const afisKlasoru = join(kok, 'src/data/tmdb/afis');

const API = process.env.TMDB_API_TABANI ?? 'https://api.themoviedb.org/3';
const GORSEL = process.env.TMDB_GORSEL_TABANI ?? 'https://image.tmdb.org/t/p';
const anahtar = process.env.TMDB_API_KEY;
const yenile = process.argv.includes('--yenile');

if (!anahtar) {
  console.error('TMDB_API_KEY tanımlı değil. site/.env.example dosyasına bakın.');
  process.exit(1);
}

// v4 token JWT'dir (eyJ...); v3 anahtar 32 karakterlik hex.
const bearerMi = anahtar.startsWith('eyJ');

async function tmdb(yol: string, parametreler: Record<string, string> = {}) {
  const url = new URL(`${API}${yol}`);
  for (const [k, v] of Object.entries(parametreler)) url.searchParams.set(k, v);
  if (!bearerMi) url.searchParams.set('api_key', anahtar!);
  const yanit = await fetch(url, {
    headers: bearerMi ? { Authorization: `Bearer ${anahtar}` } : {},
    signal: AbortSignal.timeout(15_000),
  });
  if (!yanit.ok) throw new Error(`TMDB ${yol} → ${yanit.status} ${yanit.statusText}`);
  return yanit.json() as Promise<any>;
}

async function tmdbIdleri(): Promise<number[]> {
  const idler = new Set<number>();
  for (const klasor of await readdir(sinemaKlasoru, { withFileTypes: true })) {
    if (!klasor.isDirectory()) continue;
    for (const dosya of ['index.mdx', 'index.md']) {
      let metin: string;
      try {
        metin = await readFile(join(sinemaKlasoru, klasor.name, dosya), 'utf8');
      } catch {
        continue;
      }
      const eslesme = metin.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!eslesme) continue;
      const id = parse(eslesme[1]!)?.film?.tmdbId;
      if (Number.isInteger(id)) idler.add(id);
    }
  }
  return [...idler].sort((a, b) => a - b);
}

async function oku(): Promise<Record<string, Kayit>> {
  try {
    return JSON.parse(await readFile(cacheYolu, 'utf8'));
  } catch {
    return {};
  }
}

const idler = await tmdbIdleri();
const cache = await oku();
await mkdir(afisKlasoru, { recursive: true });

let cekilen = 0;
let hata = 0;

for (const id of idler) {
  if (cache[id] && !yenile) continue;
  try {
    const film = await tmdb(`/movie/${id}`, { language: 'tr-TR', append_to_response: 'credits' });
    const yonetmenler: string[] = (film.credits?.crew ?? [])
      .filter((k: { job: string }) => k.job === 'Director')
      .map((k: { name: string }) => k.name);

    let afis: string | undefined;
    if (film.poster_path) {
      const yanit = await fetch(`${GORSEL}/w500${film.poster_path}`, { signal: AbortSignal.timeout(30_000) });
      if (!yanit.ok) throw new Error(`Afiş indirilemedi: ${yanit.status}`);
      afis = `${id}.jpg`;
      await writeFile(join(afisKlasoru, afis), Buffer.from(await yanit.arrayBuffer()));
    }

    cache[id] = {
      tmdbId: id,
      baslik: film.title,
      orijinalBaslik: film.original_title,
      yil: film.release_date ? Number(String(film.release_date).slice(0, 4)) : undefined,
      sure: film.runtime || undefined,
      yonetmenler,
      turler: (film.genres ?? []).map((g: { name: string }) => g.name),
      afis,
      cekildi: new Date().toISOString().slice(0, 10),
    };
    cekilen++;
    console.log(`✓ ${id} ${film.title}`);
  } catch (e) {
    hata++;
    console.error(`✗ ${id}: ${(e as Error).message}`);
  }
}

// Artık hiçbir yazıda kullanılmayan kayıtları ve afişlerini temizle.
for (const anahtarId of Object.keys(cache)) {
  if (idler.includes(Number(anahtarId))) continue;
  const afis = cache[anahtarId]?.afis;
  if (afis) await rm(join(afisKlasoru, afis), { force: true });
  delete cache[anahtarId];
  console.log(`− ${anahtarId} (kullanılmıyor, silindi)`);
}

const sirali = Object.fromEntries(Object.entries(cache).sort(([a], [b]) => Number(a) - Number(b)));
await writeFile(cacheYolu, JSON.stringify(sirali, null, 2) + '\n');
console.log(`${idler.length} film, ${cekilen} çekildi, ${hata} hata.`);
process.exit(hata > 0 ? 1 : 0);
