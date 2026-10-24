import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { yaziUrl, type Yazi } from './content';

export function yaziFeed(context: APIContext, baslik: string, aciklama: string, yazilar: Yazi[]) {
  return rss({
    title: baslik,
    description: aciklama,
    site: context.site!,
    customData: '<language>tr-TR</language>',
    items: yazilar.map(({ bolum, entry }) => ({
      title: entry.data.baslik,
      description: entry.data.ozet,
      pubDate: entry.data.tarih,
      link: yaziUrl(bolum, entry.id),
      categories: entry.data.etiketler,
    })),
  });
}
