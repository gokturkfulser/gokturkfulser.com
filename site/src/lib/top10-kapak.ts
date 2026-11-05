// Top 10 gecelerinin video kapakları: build'den önce scripts/top10-kapaklar.ts indirir (src/data/top10/kapak/<videoKimligi>.jpg, repo'ya girmez).
// Harici görsel adresi sayfaya girmez (CSP img-src 'self'): dosyalar astro:assets ile kendi alan adımızdan servis edilir. Dosya yoksa undefined (kapaksız çizilir).
import type { ImageMetadata } from 'astro';
import { videoKimligi } from './top10.ts';

const kapaklar = import.meta.glob<ImageMetadata>('../data/top10/kapak/*.jpg', { eager: true, import: 'default' });

export const top10Kapagi = (videoAdresi: string): ImageMetadata | undefined => {
  const id = videoKimligi(videoAdresi);
  return id ? kapaklar[`../data/top10/kapak/${id}.jpg`] : undefined;
};
