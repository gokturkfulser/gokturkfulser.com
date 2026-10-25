// Letterboxd RSS'inden son izlenenler. Yalnızca build sırasında çalışır; hata olursa boş döner
// (build kırılmaz, şerit hiç render edilmez).
// Afişler Letterboxd'dan (ltrbxd.com) değil, RSS'teki `tmdb:movieId` ile TMDB'den alınır: `scripts/letterboxd-afis.ts`
// her build'den önce indirir (repo'ya girmez), `letterboxd-afis.ts` yerel dosyadan okur. TMDB kimliği olmayan öğeler atlanır.
import { get as httpGet } from 'node:http';
import { get as httpsGet } from 'node:https';
import { XMLParser } from 'fast-xml-parser';

export type Izlenen = {
  film: string;
  yil?: number;
  puan?: number;
  tarih?: Date;
  link: string;
  tmdbId: number;
};

const ayrisan = new XMLParser({ ignoreAttributes: false, processEntities: true });
let onbellek: Promise<Izlenen[]> | undefined;

// Not: global fetch (undici) Windows'ta Node 24 + Astro build'inde süreç çıkışında çöküyordu
// (UV_HANDLE_CLOSING). Bağlantıyı kendimiz kapatan node:http(s) kullanılır.
function metinAl(adres: string, yonlendirme = 3): Promise<string> {
  return new Promise((coz, reddet) => {
    const get = adres.startsWith('https:') ? httpsGet : httpGet;
    const istek = get(adres, { agent: false, timeout: 10_000, headers: { Connection: 'close' } }, (yanit) => {
      const kod = yanit.statusCode ?? 0;
      if (kod >= 300 && kod < 400 && yanit.headers.location && yonlendirme > 0) {
        yanit.resume();
        coz(metinAl(new URL(yanit.headers.location, adres).href, yonlendirme - 1));
        return;
      }
      if (kod >= 300) {
        yanit.resume();
        reddet(new Error(`${yanit.statusCode} ${yanit.statusMessage}`));
        return;
      }
      const parcalar: Buffer[] = [];
      yanit.on('data', (p: Buffer) => parcalar.push(p));
      yanit.on('end', () => coz(Buffer.concat(parcalar).toString('utf8')));
      yanit.on('error', reddet);
    });
    istek.on('timeout', () => istek.destroy(new Error('zaman aşımı')));
    istek.on('error', reddet);
  });
}

async function cek(adres: string): Promise<Izlenen[]> {
  try {
    const kanal = ayrisan.parse(await metinAl(adres))?.rss?.channel;
    const ogeler: any[] = [kanal?.item ?? []].flat();
    return ogeler
      .filter((o) => o['letterboxd:filmTitle'] && Number.isInteger(Number(o['tmdb:movieId'])))
      .map((o) => {
        const puan = Number(o['letterboxd:memberRating']);
        const tarih = o['letterboxd:watchedDate'] ? new Date(o['letterboxd:watchedDate']) : undefined;
        return {
          film: String(o['letterboxd:filmTitle']),
          yil: o['letterboxd:filmYear'] ? Number(o['letterboxd:filmYear']) : undefined,
          puan: Number.isFinite(puan) && o['letterboxd:memberRating'] !== undefined ? puan : undefined,
          tarih,
          link: String(o.link),
          tmdbId: Number(o['tmdb:movieId']),
        };
      });
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    console.warn(`[letterboxd] RSS alınamadı, şerit atlandı: ${err.code ?? err.message}`);
    return [];
  }
}

/** LETTERBOXD_RSS tanımlı değilse boş döner; tanımlıysa akış build başına bir kez çekilir. */
function akis(adres: string | undefined): Promise<Izlenen[]> {
  if (!adres) return Promise.resolve([]);
  onbellek ??= cek(adres);
  return onbellek;
}

export async function sonIzlenenler(adres: string | undefined, adet = 6): Promise<Izlenen[]> {
  return (await akis(adres)).slice(0, adet);
}
