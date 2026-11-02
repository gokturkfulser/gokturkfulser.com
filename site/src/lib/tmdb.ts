// TMDB verisi build'de API'den değil, `src/data/tmdb-cache.json`'dan okunur.
// Cache `pnpm site:tmdb` (scripts/tmdb-fetch.ts) ile doldurulur; başlık ve türler iki dilde (tr-TR, en-US) çekilir.
import type { ImageMetadata } from 'astro';
import type { Dil } from '../i18n';
import cacheDosyasi from '../data/tmdb-cache.json';

export type TmdbKayit = {
  tmdbId: number;
  /** Dile göre başlık. */
  baslik: Record<Dil, string>;
  orijinalBaslik: string;
  yil?: number;
  sure?: number;
  yonetmenler: string[];
  /** Dile göre türler. */
  turler: Record<Dil, string[]>;
  afis?: string;
  arkaplan?: string;
  surum?: number;
  cekildi: string;
};

const cache = cacheDosyasi as unknown as Record<string, TmdbKayit>;

const afisler = import.meta.glob<ImageMetadata>('../data/tmdb/afis/*.jpg', {
  eager: true,
  import: 'default',
});

const arkaplanlar = import.meta.glob<ImageMetadata>('../data/tmdb/arkaplan/*.jpg', {
  eager: true,
  import: 'default',
});

/** Dile göre çözülmüş kayıt: `baslik` ve `turler` istenen dilde (yoksa diğer dil), orijinal ad ayrı. */
export function tmdbKaydi(tmdbId: number | undefined, dil: Dil) {
  if (tmdbId === undefined) return undefined;
  const kayit = cache[String(tmdbId)];
  if (!kayit) return undefined;
  const diger: Dil = dil === 'en' ? 'tr' : 'en';
  const afis = kayit.afis ? afisler[`../data/tmdb/afis/${kayit.afis}`] : undefined;
  const arkaplan = kayit.arkaplan ? arkaplanlar[`../data/tmdb/arkaplan/${kayit.arkaplan}`] : undefined;
  return {
    ...kayit,
    baslik: kayit.baslik[dil] || kayit.baslik[diger],
    turler: kayit.turler[dil]?.length ? kayit.turler[dil] : (kayit.turler[diger] ?? []),
    afisGorsel: afis,
    arkaplanGorsel: arkaplan,
  };
}

export const tmdbVarMi = () => Object.keys(cache).length > 0;
export const tmdbUrl = (tmdbId: number) => `https://www.themoviedb.org/movie/${tmdbId}`;
