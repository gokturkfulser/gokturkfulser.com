// Oyuncu fotoğrafları: scripts/top10-oyuncular.ts Wikimedia Commons'tan indirir (src/data/top10/oyuncu/<slugify(ad)>.jpg + .json atıf bilgisi; repo'ya girmez).
// Dosyalar astro:assets ile kendi alan adımızdan servis edilir (CSP img-src 'self'; harici adres sayfaya girmez). Fotoğraf ya da atıf yoksa undefined (baş harf kutusu çizilir).
import type { ImageMetadata } from 'astro';
import { slugify } from './slug.ts';

export interface OyuncuAtfi {
  ad: string;
  yazar: string;
  lisans: string;
  lisansAdresi?: string;
  sayfa: string;
}

const gorseller = import.meta.glob<ImageMetadata>('../data/top10/oyuncu/*.jpg', { eager: true, import: 'default' });
const atiflar = import.meta.glob<OyuncuAtfi>('../data/top10/oyuncu/*.json', { eager: true, import: 'default' });

/** Fotoğraf ve atfı birlikte döner: atfı olmayan fotoğraf (lisans koşulu) gösterilmez. */
export const oyuncuGorseli = (ad: string): { gorsel: ImageMetadata; atif: OyuncuAtfi } | undefined => {
  const slug = slugify(ad);
  const gorsel = gorseller[`../data/top10/oyuncu/${slug}.jpg`];
  const atif = atiflar[`../data/top10/oyuncu/${slug}.json`];
  return gorsel && atif ? { gorsel, atif } : undefined;
};

/** Fotoğrafı olmayan oyuncu için baş harfler: ilk ve son sözcüğün ilk harfi ("Victor Wembanyama" → "VW"). */
export const basHarfler = (ad: string): string => {
  const parcalar = ad.trim().split(/\s+/).filter(Boolean);
  const al = (p: string) => [...p][0]?.toLocaleUpperCase() ?? '';
  return parcalar.length <= 1 ? al(parcalar[0] ?? '') : al(parcalar[0]!) + al(parcalar.at(-1)!);
};
