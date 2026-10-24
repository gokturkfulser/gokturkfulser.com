// Letterboxd RSS'inden son izlenenler. Yalnızca build sırasında çalışır; hata olursa boş döner
// (build kırılmaz, şerit hiç render edilmez).
import { get as httpGet } from 'node:http';
import { get as httpsGet } from 'node:https';
import { XMLParser } from 'fast-xml-parser';

export type Izlenen = {
  film: string;
  yil?: number;
  puan?: number;
  tarih?: Date;
  link: string;
  afis?: string;
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

async function cek(adres: string, adet: number): Promise<Izlenen[]> {
  try {
    const kanal = ayrisan.parse(await metinAl(adres))?.rss?.channel;
    const ogeler: any[] = [kanal?.item ?? []].flat();
    return ogeler
      .filter((o) => o['letterboxd:filmTitle'])
      .slice(0, adet)
      .map((o) => {
        const afis = String(o.description ?? '').match(/<img[^>]+src=["']([^"']+)["']/)?.[1];
        const puan = Number(o['letterboxd:memberRating']);
        const tarih = o['letterboxd:watchedDate'] ? new Date(o['letterboxd:watchedDate']) : undefined;
        return {
          film: String(o['letterboxd:filmTitle']),
          yil: o['letterboxd:filmYear'] ? Number(o['letterboxd:filmYear']) : undefined,
          puan: Number.isFinite(puan) && o['letterboxd:memberRating'] !== undefined ? puan : undefined,
          tarih,
          link: String(o.link),
          afis,
        };
      });
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    console.warn(`[letterboxd] RSS alınamadı, şerit atlandı: ${err.code ?? err.message}`);
    return [];
  }
}

/** LETTERBOXD_RSS tanımlı değilse boş döner; tanımlıysa build başına bir kez çeker. */
export function sonIzlenenler(adres: string | undefined, adet = 6): Promise<Izlenen[]> {
  if (!adres) return Promise.resolve([]);
  onbellek ??= cek(adres, adet);
  return onbellek;
}
