// YouTube Data API v3: NBA kanalının "uploads" oynatma listesinden son videolar (playlistItems.list, 1 kota birimi; search.list 100 birimdir).
// Anahtar yalnızca `key=` parametresiyle gider ve hiçbir hata iletisine/loga yazılmaz. `fetchFn` enjekte edilir (testte ağ yok).
import { EN_COK_SAYFA, EN_COK_SAYFA_ARALIK, KANAL_ID, YOUTUBE_API_TABANI, YOUTUBE_ZAMAN_ASIMI_MS, YUKLEMELER_LISTESI } from './ayarlar.ts';
import { baslikCoz } from './baslik.ts';

export type FetchFn = typeof fetch;
export type Video = { id: string; baslik: string; yayin: string };

const temizle = (metin: string, anahtar: string) => (anahtar ? metin.split(anahtar).join('***') : metin);

async function getir(fetchFn: FetchFn, yol: string, parametreler: Record<string, string>, anahtar: string): Promise<any> {
  const url = new URL(`${YOUTUBE_API_TABANI}/${yol}`);
  for (const [k, v] of Object.entries(parametreler)) url.searchParams.set(k, v);
  url.searchParams.set('key', anahtar);
  let yanit: Response;
  try {
    yanit = await fetchFn(url, { signal: AbortSignal.timeout(YOUTUBE_ZAMAN_ASIMI_MS) });
  } catch (hata) {
    throw new Error(`YouTube API isteği başarısız (${yol}): ${temizle(hata instanceof Error ? hata.message : String(hata), anahtar)}`);
  }
  const metin = await yanit.text();
  if (!yanit.ok) {
    throw Object.assign(new Error(`YouTube API ${yanit.status} (${yol}): ${temizle(metin.slice(0, 300), anahtar)}`), { durum: yanit.status });
  }
  return JSON.parse(metin);
}

/** Sabit uploads listesi bulunamazsa (404) kanaldan çözer: channels.list → contentDetails.relatedPlaylists.uploads. */
export async function yuklemelerListesiBul(fetchFn: FetchFn, anahtar: string): Promise<string> {
  const veri = await getir(fetchFn, 'channels', { part: 'contentDetails', id: KANAL_ID }, anahtar);
  const liste = veri.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (typeof liste !== 'string') throw new Error(`Kanalın uploads listesi bulunamadı (kanal ${KANAL_ID}).`);
  return liste;
}

/**
 * Oynatma listesinin en yeni videoları (yeniden eskiye). `kadar`tan eski bir videoya gelince durur; en çok EN_COK_SAYFA sayfa okunur.
 * Özel/silinmiş kayıtlar atlanır.
 */
export async function sonVideolar(secenek: { anahtar: string; fetchFn: FetchFn; kadar: Date }): Promise<Video[]> {
  const { kadar } = secenek;
  const r = await videolariTara({ anahtar: secenek.anahtar, fetchFn: secenek.fetchFn, enCokSayfa: EN_COK_SAYFA, dur: (sayfa) => sayfa.some((v) => v.yayin && new Date(v.yayin) < kadar) && 'pencere' });
  return r.videolar;
}

/** Aralık taraması sonucu: videolar (yeniden eskiye), okunan playlistItems sayfası ve durma nedeni. */
export type TaramaSonucu = { videolar: Video[]; sayfaSayisi: number; neden: string };

/**
 * Geçmiş gece doldurma: oynatma listesini (playlistItems.list, sayfa başına en çok 50) en eski istenen tarihin videosu bulunana, başlıktaki tarih
 * aralığın gerisine düşene ya da (başlıksız önlem olarak) yükleme tarihi `baslangic`ın 3 gün gerisine inene kadar sayfalar; en çok EN_COK_SAYFA_ARALIK sayfa.
 * Durma kararı sayfa tamamlandıktan sonra verilir (aynı sayfadaki tüm videolar işlenir).
 */
export async function aralikVideolari(secenek: { anahtar: string; fetchFn: FetchFn; baslangic: string }): Promise<TaramaSonucu> {
  const gerisi = Date.parse(`${secenek.baslangic}T00:00:00Z`) - 3 * 24 * 60 * 60 * 1000;
  return videolariTara({
    anahtar: secenek.anahtar,
    fetchFn: secenek.fetchFn,
    enCokSayfa: EN_COK_SAYFA_ARALIK,
    dur: (sayfa) => {
      const tarihler = sayfa.map((v) => baslikCoz(v.baslik)?.tarih).filter((t): t is string => t !== undefined);
      if (tarihler.some((t) => t === secenek.baslangic)) return 'en eski istenen tarihin videosu bulundu';
      if (tarihler.some((t) => t < secenek.baslangic)) return 'başlıktaki tarih aralığın gerisine düştü';
      if (sayfa.some((v) => v.yayin && Date.parse(v.yayin) < gerisi)) return 'yükleme tarihi aralığın çok gerisinde';
      return false;
    },
  });
}

/** Ortak sayfalama: `dur(sayfadakiVideolar)` bir neden dizgesi döndürürse (ya da liste biterse / sayfa sınırına gelinirse) durur. */
async function videolariTara(secenek: { anahtar: string; fetchFn: FetchFn; enCokSayfa: number; dur: (sayfa: Video[]) => string | false }): Promise<TaramaSonucu> {
  const { anahtar, fetchFn, enCokSayfa, dur } = secenek;
  let liste = YUKLEMELER_LISTESI;
  const videolar: Video[] = [];
  let sayfa: string | undefined;
  let sayfaSayisi = 0;
  let neden = 'sayfa üst sınırı';
  for (let i = 0; i < enCokSayfa; i++) {
    const parametreler: Record<string, string> = { part: 'snippet', playlistId: liste, maxResults: '50' };
    if (sayfa) parametreler.pageToken = sayfa;
    let veri: any;
    try {
      veri = await getir(fetchFn, 'playlistItems', parametreler, anahtar);
    } catch (hata) {
      if (i === 0 && (hata as { durum?: number }).durum === 404) {
        liste = await yuklemelerListesiBul(fetchFn, anahtar);
        i = -1;
        continue;
      }
      throw hata;
    }
    sayfaSayisi += 1;
    const buSayfa: Video[] = [];
    for (const oge of veri.items ?? []) {
      const s = oge.snippet;
      const id = s?.resourceId?.videoId;
      if (typeof id !== 'string' || typeof s?.title !== 'string' || /^(Private|Deleted) video$/i.test(s.title)) continue;
      const yayin = String(s.publishedAt ?? '');
      buSayfa.push({ id, baslik: s.title, yayin });
    }
    videolar.push(...buSayfa);
    sayfa = veri.nextPageToken;
    const durNedeni = dur(buSayfa);
    if (durNedeni) {
      neden = durNedeni === 'pencere' ? 'pencerenin gerisine inildi' : durNedeni;
      break;
    }
    if (!sayfa) {
      neden = 'oynatma listesi bitti';
      break;
    }
  }
  return { videolar, sayfaSayisi, neden };
}

/** ISO 8601 süre (PT1H2M3S) → saniye; geçersizse undefined. */
export function sureSaniye(iso: string): number | undefined {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m || iso === 'P' || iso === 'PT') return undefined;
  return Number(m[1] ?? 0) * 86400 + Number(m[2] ?? 0) * 3600 + Number(m[3] ?? 0) * 60 + Number(m[4] ?? 0);
}

export type VideoMeta = {
  id: string;
  baslik: string;
  aciklama: string;
  /** contentDetails.duration (saniye); alınamadıysa undefined. */
  sureSn?: number;
  /** status.privacyStatus: public | unlisted | private. Gemini yalnızca herkese açık videoyu işler. */
  gizlilik?: string;
};

/** Videoların meta verisi: başlık, açıklama, süre, gizlilik (videos.list; 50 kimliğe kadar tek çağrı = 1 kota birimi). Bulunamayan kimlik haritada yoktur. */
export async function videoMeta(fetchFn: FetchFn, anahtar: string, idler: readonly string[]): Promise<Map<string, VideoMeta>> {
  const sonuc = new Map<string, VideoMeta>();
  for (let i = 0; i < idler.length; i += 50) {
    const veri = await getir(fetchFn, 'videos', { part: 'snippet,contentDetails,status', id: idler.slice(i, i + 50).join(',') }, anahtar);
    for (const oge of veri.items ?? []) {
      if (typeof oge?.id !== 'string') continue;
      const sure = oge.contentDetails?.duration;
      sonuc.set(oge.id, {
        id: oge.id,
        baslik: typeof oge.snippet?.title === 'string' ? oge.snippet.title : '',
        aciklama: typeof oge.snippet?.description === 'string' ? oge.snippet.description : '',
        sureSn: typeof sure === 'string' ? sureSaniye(sure) : undefined,
        gizlilik: typeof oge.status?.privacyStatus === 'string' ? oge.status.privacyStatus : undefined,
      });
    }
  }
  return sonuc;
}

/** Kabul edilen adres biçimleri: youtube.com/watch?v=<kimlik>, youtu.be/<kimlik>, youtube.com/shorts/<kimlik>; kimlik 11 karakter [A-Za-z0-9_-]. */
export const VIDEO_KIMLIGI = /^[A-Za-z0-9_-]{11}$/;

export function videoKimligi(girdi: string): string | undefined {
  let u: URL;
  try {
    u = new URL(girdi.trim());
  } catch {
    return undefined;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return undefined;
  const sunucu = u.hostname.replace(/^(?:www|m)\./, '');
  let id: string | null | undefined;
  if (sunucu === 'youtube.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else id = /^\/shorts\/([^/]+)\/?$/.exec(u.pathname)?.[1];
  } else if (sunucu === 'youtu.be') {
    id = /^\/([^/]+)\/?$/.exec(u.pathname)?.[1];
  }
  return id && VIDEO_KIMLIGI.test(id) ? id : undefined;
}

export const videoAdresi = (id: string) => `https://www.youtube.com/watch?v=${id}`;
