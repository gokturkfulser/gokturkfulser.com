import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { AYAR, sozluk, type Dil } from '../i18n';
import { bolumYazilari, tumYazilar, yaziUrl } from './content';
import type { Bolum } from '../i18n/yollar';

/**
 * Feed, liste sayfalarıyla aynı mantıkta: iki dilin yazılarını da içerir (`bolum` yoksa tüm yazılar, varsa o bölüm).
 * `dil` yalnızca feed'in kanal bilgisini (başlık, açıklama, <language>) belirler; her öğe kendi dilini `dc:language` ile taşır
 * ve kendi dilinin adres ağacına bağlanır.
 */
export async function yaziFeed(context: APIContext, dil: Dil, bolum?: Bolum) {
  const s = sozluk(dil).rss[bolum ?? 'ana'];
  const yazilar = bolum ? await bolumYazilari(bolum) : await tumYazilar();
  return rss({
    title: s.baslik,
    description: s.aciklama,
    site: context.site!,
    xmlns: { dc: 'http://purl.org/dc/elements/1.1/' },
    customData: `<language>${AYAR[dil].rss}</language>`,
    items: yazilar.map((yazi) => ({
      title: yazi.entry.data.baslik,
      description: yazi.entry.data.ozet,
      pubDate: yazi.entry.data.tarih,
      link: yaziUrl(yazi),
      categories: yazi.entry.data.etiketler,
      customData: `<dc:language>${AYAR[yazi.entry.data.dil].rss}</dc:language>`,
    })),
  });
}
