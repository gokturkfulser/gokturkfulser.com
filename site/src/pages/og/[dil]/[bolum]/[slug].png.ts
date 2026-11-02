import type { APIRoute, GetStaticPaths } from 'astro';
import { tumYazilar } from '../../../../lib/content';
import { sozluk, tarihYaz } from '../../../../i18n';
import { ogPng } from '../../../../lib/og';

// Her yazı için build sırasında 1200×630 PNG üretilir, yazının dilinde: /og/<dil>/<bolum>/<slug>.png
export const getStaticPaths = (async () => {
  return (await tumYazilar()).map((yazi) => ({
    params: { dil: yazi.entry.data.dil, bolum: yazi.bolum, slug: yazi.entry.id },
    props: { dunya: yazi.bolum, baslik: yazi.entry.data.baslik, tarih: yazi.entry.data.tarih, dil: yazi.entry.data.dil },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const png = await ogPng({
    dunya: props.dunya,
    baslik: props.baslik,
    bolumAdi: sozluk(props.dil).bolum[props.dunya as 'sinema' | 'basketbol'],
    altBilgi: tarihYaz(props.tarih, props.dil),
  });
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
};
