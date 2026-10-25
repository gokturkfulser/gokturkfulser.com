// Letterboxd şeridinin afişleri: `scripts/letterboxd-afis.ts` her build'den önce TMDB'den indirir
// (`src/data/letterboxd/afis/<tmdbId>.jpg`, .gitignore'da). Dosya yoksa undefined döner ve şerit afişsiz çizilir.
import type { ImageMetadata } from 'astro';

const afisler = import.meta.glob<ImageMetadata>('../data/letterboxd/afis/*.jpg', { eager: true, import: 'default' });

export const letterboxdAfisi = (tmdbId: number): ImageMetadata | undefined => afisler[`../data/letterboxd/afis/${tmdbId}.jpg`];
