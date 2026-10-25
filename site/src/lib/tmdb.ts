// TMDB verisi build'de API'den değil, `src/data/tmdb-cache.json`'dan okunur.
// Cache `pnpm site:tmdb` (scripts/tmdb-fetch.ts) ile doldurulur.
import type { ImageMetadata } from 'astro';
import cacheDosyasi from '../data/tmdb-cache.json';

export type TmdbKayit = {
  tmdbId: number;
  baslik: string;
  orijinalBaslik: string;
  yil?: number;
  sure?: number;
  yonetmenler: string[];
  turler: string[];
  afis?: string;
  arkaplan?: string;
  surum?: number;
  cekildi: string;
};

const cache = cacheDosyasi as Record<string, TmdbKayit>;

const afisler = import.meta.glob<ImageMetadata>('../data/tmdb/afis/*.jpg', {
  eager: true,
  import: 'default',
});

const arkaplanlar = import.meta.glob<ImageMetadata>('../data/tmdb/arkaplan/*.jpg', {
  eager: true,
  import: 'default',
});

export function tmdbKaydi(tmdbId: number | undefined) {
  if (tmdbId === undefined) return undefined;
  const kayit = cache[String(tmdbId)];
  if (!kayit) return undefined;
  const afis = kayit.afis ? afisler[`../data/tmdb/afis/${kayit.afis}`] : undefined;
  const arkaplan = kayit.arkaplan ? arkaplanlar[`../data/tmdb/arkaplan/${kayit.arkaplan}`] : undefined;
  return { ...kayit, afisGorsel: afis, arkaplanGorsel: arkaplan };
}

export const tmdbVarMi = () => Object.keys(cache).length > 0;
export const tmdbUrl = (tmdbId: number) => `https://www.themoviedb.org/movie/${tmdbId}`;
