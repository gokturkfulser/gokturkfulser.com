// schema.org JSON-LD üreticileri. Çıktı `<script type="application/ld+json">` içine yazılır
// (çalıştırılabilir JS değil, veri); `<` kaçışlanır.
export const SITE_URL = 'https://gokturkfulser.com';
export const YAZAR = { '@type': 'Person', name: 'Göktürk Fulser', url: SITE_URL } as const;

export const jsonLdMetni = (veri: unknown) => JSON.stringify(veri).replace(/</g, '\\u003c');

type MakaleGirdi = {
  baslik: string;
  ozet: string;
  tarih: Date;
  url: string;
  gorsel: string;
  bolumAdi: string;
  etiketler: string[];
  kelime: number;
  dakika: number;
};

export function makaleLd(g: MakaleGirdi) {
  return {
    '@type': 'Article',
    headline: g.baslik,
    description: g.ozet,
    datePublished: g.tarih.toISOString(),
    dateModified: g.tarih.toISOString(),
    inLanguage: 'tr-TR',
    author: YAZAR,
    publisher: YAZAR,
    image: [g.gorsel],
    mainEntityOfPage: { '@type': 'WebPage', '@id': g.url },
    articleSection: g.bolumAdi,
    keywords: g.etiketler.join(', '),
    wordCount: g.kelime,
    timeRequired: `PT${g.dakika}M`,
  };
}

type FilmYorumuGirdi = {
  baslik: string;
  ozet: string;
  tarih: Date;
  url: string;
  film: { ad: string; orijinalAd?: string; yil: number; yonetmen: string };
  puan: number;
  afis?: string;
  tmdbUrl?: string;
};

export function filmYorumuLd(g: FilmYorumuGirdi) {
  return {
    '@type': 'Review',
    name: g.baslik,
    reviewBody: g.ozet,
    datePublished: g.tarih.toISOString(),
    inLanguage: 'tr-TR',
    author: YAZAR,
    url: g.url,
    itemReviewed: {
      '@type': 'Movie',
      name: g.film.ad,
      ...(g.film.orijinalAd && g.film.orijinalAd !== g.film.ad ? { alternateName: g.film.orijinalAd } : {}),
      dateCreated: String(g.film.yil),
      director: { '@type': 'Person', name: g.film.yonetmen },
      ...(g.afis ? { image: g.afis } : {}),
      ...(g.tmdbUrl ? { sameAs: g.tmdbUrl } : {}),
    },
    reviewRating: { '@type': 'Rating', ratingValue: g.puan, bestRating: 5, worstRating: 0 },
  };
}

export const grafLd = (...ogeler: unknown[]) => ({ '@context': 'https://schema.org', '@graph': ogeler });
